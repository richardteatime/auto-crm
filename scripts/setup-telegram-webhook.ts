#!/usr/bin/env node
import { config } from "dotenv";

config({ path: ".env.local" });

function requiredEnv(key: string): string {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new Error(`${key} non configurato`);
  }
  return value;
}

function appUrl(): string {
  return requiredEnv("NEXT_PUBLIC_APP_URL").replace(/\/+$/, "");
}

async function main() {
  const token = requiredEnv("TELEGRAM_BOT_TOKEN");
  const secretToken = requiredEnv("TELEGRAM_WEBHOOK_SECRET");
  const webhookUrl = `${appUrl()}/api/telegram/webhook`;
  const dropPendingUpdates = process.env.TELEGRAM_DROP_PENDING_UPDATES === "true";

  const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: webhookUrl,
      secret_token: secretToken,
      drop_pending_updates: dropPendingUpdates,
      allowed_updates: ["message", "edited_message", "callback_query"],
    }),
  });

  const data = await res.json().catch(() => null) as {
    ok?: boolean;
    description?: string;
    result?: boolean;
  } | null;

  if (!res.ok || !data?.ok) {
    throw new Error(data?.description || `setWebhook fallito con status ${res.status}`);
  }

  console.log("Telegram webhook configurato.");
  console.log(`URL: ${webhookUrl}`);
  console.log(`Drop pending updates: ${dropPendingUpdates ? "sì" : "no"}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
