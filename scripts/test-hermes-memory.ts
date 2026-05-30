import { spawn } from "child_process";

async function hermesChat(message: string, sessionId?: string) {
  const args = ["chat", "-q", message, "-Q", "--source", "tool"];
  if (sessionId) args.push("--resume", sessionId);

  return new Promise<{ reply: string; sessionId?: string }>((resolve, reject) => {
    const child = spawn(
      "C:\\Users\\franc\\AppData\\Local\\hermes\\hermes-agent\\venv\\Scripts\\hermes.exe",
      args,
      { env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" } },
    );

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => { stdout += d; });
    child.stderr.on("data", (d) => { stderr += d; });
    child.on("close", (code) => {
      if (code !== 0) reject(new Error("exit " + code));
      const combined = stdout + "\n" + stderr;
      const lines = combined.split("\n");
      let sid: string | undefined;
      const replyLines: string[] = [];
      for (const line of lines) {
        const t = line.trim();
        if (t.startsWith("session_id:")) {
          sid = t.replace("session_id:", "").trim();
          continue;
        }
        replyLines.push(line);
      }
      resolve({ reply: replyLines.join("\n").trim(), sessionId: sid });
    });
  });
}

async function main() {
  const r1 = await hermesChat("Mi chiamo Franc. Ricordatelo.");
  console.log("T1:", r1.reply);
  console.log("SID:", r1.sessionId);

  if (r1.sessionId) {
    await new Promise((r) => setTimeout(r, 1000));
    const r2 = await hermesChat("Come mi chiamo?", r1.sessionId);
    console.log("T2:", r2.reply);
  } else {
    console.log("No session ID captured.");
  }
}

main().catch(console.error);
