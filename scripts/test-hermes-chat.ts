import { spawn } from "child_process";

async function main() {
  const args = [
    "chat",
    "-q",
    "ciao",
    "-Q",
    "--source",
    "tool",
    "--continue",
    "chatwoot-test1",
    "--max-turns",
    "30",
  ];

  console.log("[test] Spawning:", args.join(" "));

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
    console.log("[test] Exit code:", code);
    console.log("[test] stdout:", stdout);
    console.log("[test] stderr:", stderr);
  });

  child.on("error", (err) => {
    console.log("[test] Error:", err);
  });
}

main().catch(console.error);
