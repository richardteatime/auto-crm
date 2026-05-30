import { spawn, execSync } from "child_process";

const HERMES_TIMEOUT_MS = 120_000;

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

/**
 * Send a message to Hermes Agent and return its final text response.
 *
 * Uses `hermes chat -q` in quiet mode. If a sessionId is provided,
 * attempts to resume that session; falls back to a fresh session
 * if resume fails (Hermes `-q` mode does not always support resume).
 */
export async function callHermes(
  message: string,
  conversationId: number,
  sessionId?: string,
): Promise<{ reply: string; sessionId?: string }> {
  if (sessionId) {
    try {
      const result = await runHermes(buildArgs(message, sessionId));
      return result;
    } catch {
      // Resume failed — fall through to fresh session
    }
  }
  return runHermes(buildArgs(message));
}
