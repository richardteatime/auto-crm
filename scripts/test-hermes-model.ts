import { spawn } from "child_process";

async function testModel(model: string) {
  const args = [
    "chat",
    "-q",
    "Crea un contatto di test chiamato POC-Hermes-Test3 con email test3@hermes.com",
    "-Q",
    "-m",
    model,
  ];

  console.log(`[test] Testing model: ${model}`);
  const start = Date.now();

  const child = spawn(
    "C:\\Users\\franc\\AppData\\Local\\hermes\\hermes-agent\\venv\\Scripts\\hermes.exe",
    args,
    { env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" } },
  );

  let stdout = "";
  let stderr = "";

  child.stdout.on("data", (d) => { stdout += d; });
  child.stderr.on("data", (d) => { stderr += d; });

  return new Promise<void>((resolve) => {
    child.on("close", (code) => {
      const elapsed = Date.now() - start;
      console.log(`[test] Model: ${model} | Code: ${code} | Time: ${elapsed}ms`);
      console.log(`[test] stdout:`, stdout.trim());
      resolve();
    });
  });
}

async function main() {
  await testModel("anthropic/claude-sonnet-4");
  await testModel("google/gemini-2.0-flash-001");
}

main().catch(console.error);
