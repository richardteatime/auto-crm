import { NextResponse } from "next/server";
import { Client, Account } from "node-appwrite";

export const dynamic = "force-dynamic";

export async function GET() {
  const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "";
  const projectId = process.env.APPWRITE_PROJECT_ID || "";
  const apiKey = process.env.APPWRITE_API_KEY || "";

  const results: Record<string, string> = {};

  // Config check (no values exposed)
  results.config = projectId && apiKey ? "configured" : "incomplete";

  // Test server-to-Appwrite connectivity
  try {
    const url = endpoint.replace(/\/v1\/?$/, "") + "/v1/users";
    const res = await fetch(url, {
      headers: {
        "X-Appwrite-Project": projectId,
        "X-Appwrite-Key": apiKey,
      },
    });
    if (res.ok) {
      const data = await res.json();
      results.serverConnection = `OK — ${data.total ?? "?"} users`;
    } else {
      const text = await res.text();
      results.serverConnection = `FAIL — ${res.status}: ${text.slice(0, 100)}`;
    }
  } catch (e: unknown) {
    results.serverConnection = `FAIL — ${e instanceof Error ? e.message.slice(0, 100) : "network error"}`;
  }

  // Test Account API endpoint reachability
  try {
    const client = new Client().setEndpoint(endpoint).setProject(projectId);
    const account = new Account(client);
    await account.get();
    results.accountApi = "Unexpected success";
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes("ECONNREFUSED") && !msg.includes("ENOTFOUND") && !msg.includes("fetch failed") && !msg.includes("ETIMEDOUT")) {
      results.accountApi = "OK — endpoint reachable";
    } else {
      results.accountApi = `FAIL — ${msg.slice(0, 100)}`;
    }
  }

  const allOk =
    results.serverConnection.startsWith("OK") &&
    results.accountApi.startsWith("OK");

  return NextResponse.json(results, { status: allOk ? 200 : 503 });
}
