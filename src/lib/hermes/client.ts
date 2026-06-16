import { spawn, execSync } from "child_process";

const HERMES_TIMEOUT_MS = 120_000;

const HERMES_SERVICE_URL = process.env.HERMES_SERVICE_URL;
const HERMES_API_KEY = process.env.HERMES_API_KEY;

function resolveHermesPath(): string {
  try {
    const cmd = process.platform === "win32" ? "where hermes" : "which hermes";
    const result = execSync(cmd, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "ignore"],
    });
    const lines = result.trim().split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.endsWith(".exe") || trimmed.includes("hermes")) {
        return trimmed;
      }
    }
    return lines[0].trim();
  } catch {
    return "hermes";
  }
}

const HERMES_PATH = resolveHermesPath();

function stripSessionInfo(raw: string): { reply: string; sessionId?: string } {
  const lines = raw.split("\n");
  let sessionId: string | undefined;
  const replyLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("session_id:")) {
      sessionId = trimmed.replace("session_id:", "").trim();
      continue;
    }
    replyLines.push(line);
  }

  const reply = replyLines.join("\n").trim();
  return { reply, sessionId };
}

function buildArgs(message: string, sessionId?: string): string[] {
  const args = [
    "chat",
    "-q",
    message,
    "-Q",
    "--source",
    "tool",
    "--max-turns",
    "30",
  ];
  if (sessionId) {
    args.push("--resume", sessionId);
  }
  return args;
}

function runHermes(
  args: string[],
): Promise<{ reply: string; sessionId?: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(HERMES_PATH, args, {
      env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" },
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data: Buffer) => {
      stdout += data.toString("utf-8");
    });

    child.stderr.on("data", (data: Buffer) => {
      stderr += data.toString("utf-8");
    });

    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("Hermes timed out after 120s"));
    }, HERMES_TIMEOUT_MS);

    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        reject(
          new Error(`Hermes exited with code ${code}. stderr: ${stderr.trim()}`),
        );
        return;
      }
      const combined = stdout + "\n" + stderr;
      resolve(stripSessionInfo(combined));
    });

    child.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

async function callHermesHttp(
  message: string,
  sessionId?: string,
): Promise<{ reply: string; sessionId?: string }> {
  if (!HERMES_SERVICE_URL) {
    throw new Error("HERMES_SERVICE_URL is not configured");
  }

  const url = new URL("/chat", HERMES_SERVICE_URL).toString();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (HERMES_API_KEY) {
    headers["Authorization"] = `Bearer ${HERMES_API_KEY}`;
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ message, session_id: sessionId, max_turns: 30 }),
    signal: AbortSignal.timeout(125_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Hermes service error ${res.status}: ${text.slice(0, 500)}`);
  }

  const data = (await res.json()) as { reply?: string; session_id?: string };
  return { reply: data.reply ?? "", sessionId: data.session_id };
}

/**
 * Send a message to Hermes Agent and return its final text response.
 *
 * Behavior:
 * - If HERMES_SERVICE_URL is set, calls the remote Hermes chat service via HTTP.
 * - Otherwise falls back to spawning the local `hermes chat -q` binary.
 *
 * If a sessionId is provided, attempts to resume that session; if resume fails,
 * falls back to a fresh session.
 */
export async function callHermes(
  message: string,
  _conversationId: number,
  sessionId?: string,
): Promise<{ reply: string; sessionId?: string }> {
  if (HERMES_SERVICE_URL) {
    try {
      return await callHermesHttp(message, sessionId);
    } catch (_err) {
      // Resume failed — fall back to a fresh session.
      if (sessionId) {
        return callHermesHttp(message, undefined);
      }
      throw _err;
    }
  }

  if (sessionId) {
    try {
      const result = await runHermes(buildArgs(message, sessionId));
      return result;
    } catch (_err) {
      // Resume failed — fall through to fresh session
      void _err;
    }
  }
  return runHermes(buildArgs(message));
}
