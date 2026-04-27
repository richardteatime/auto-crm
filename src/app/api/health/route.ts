import { NextResponse } from "next/server";
import { Client, Account } from "node-appwrite";

export const dynamic = "force-dynamic";

export async function GET() {
  const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "http://localhost:80/v1";
  const projectId = process.env.APPWRITE_PROJECT_ID || "";
  const apiKey = process.env.APPWRITE_API_KEY || "";

  const results: Record<string, string> = {};

  results.endpoint = endpoint;
  results.projectId = projectId ? "configured" : "MISSING";
  results.apiKey = apiKey ? "configured" : "MISSING";

  // 2. Test server-to-Appwrite via direct REST (bypass SDK v24 query format)
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
      results.serverConnection = `OK — ${data.total ?? "?"} users found`;
    } else {
      const text = await res.text();
      results.serverConnection = `FAIL — ${res.status}: ${text.slice(0, 200)}`;
    }
  } catch (e: unknown) {
    results.serverConnection = `FAIL — ${e instanceof Error ? e.message : String(e)}`;
  }

  // 3. Test Account API endpoint reachability
  try {
    const client = new Client()
      .setEndpoint(endpoint)
      .setProject(projectId);
    const account = new Account(client);
    await account.get();
    results.accountApi = "Unexpected success";
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes("ECONNREFUSED") && !msg.includes("ENOTFOUND") && !msg.includes("fetch failed") && !msg.includes("ETIMEDOUT")) {
      results.accountApi = "OK — endpoint reachable (auth error expected without session)";
    } else {
      results.accountApi = `FAIL — ${msg}`;
    }
  }

  const allOk =
    results.serverConnection.startsWith("OK") &&
    results.accountApi.startsWith("OK");

  return NextResponse.json(results, { status: allOk ? 200 : 503 });
}
