import { spawn } from "child_process";

function test(label: string, command: string, args: string[]) {
  return new Promise<void>((resolve) => {
    console.log(`[${label}] Spawning: ${command} ${args.join(" ")}`);
    const child = spawn(command, args, {
      env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" },
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (d) => { stdout += d; });
    child.stderr.on("data", (d) => { stderr += d; });

    child.on("close", (code) => {
      console.log(`[${label}] Exit code:`, code);
      console.log(`[${label}] stdout:`, stdout.slice(0, 500));
      console.log(`[${label}] stderr:`, stderr.slice(0, 500));
      resolve();
    });

    child.on("error", (err) => {
      console.log(`[${label}] Error:`, err);
      resolve();
    });
  });
}

async function main() {
  await test("hermes.exe direct", "C:\\Users\\franc\\AppData\\Local\\hermes\\hermes-agent\\venv\\Scripts\\hermes.exe", ["--version"]);
  await test("hermes via bash", "bash", ["-c", "hermes --version"]);
  await test("hermes via cmd", "cmd", ["/c", "hermes --version"]);
}

main().catch(console.error);
