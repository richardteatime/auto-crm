import { NextResponse } from "next/server";
import { Client, Account, Users } from "node-appwrite";

export const dynamic = "force-dynamic";

export async function GET() {
  const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "http://localhost:80/v1";
  const projectId = process.env.APPWRITE_PROJECT_ID || "";
  const apiKey = process.env.APPWRITE_API_KEY || "";

  const results: Record<string, string> = {};

  // 1. Check env vars
  results.endpoint = endpoint;
  results.projectId = projectId ? "configured" : "MISSING";
  results.apiKey = apiKey ? "configured" : "MISSING";

  // 2. Test server-to-Appwrite connection (with API key — Users API)
  try {
    const client = new Client()
      .setEndpoint(endpoint)
      .setProject(projectId)
      .setKey(apiKey);
    const users = new Users(client);
    const list = await users.list({ queries: ["limit(1)"] });
    results.serverConnection = `OK — ${list.total} users found`;
  } catch (e: unknown) {
    results.serverConnection = `FAIL — ${e instanceof Error ? e.message : String(e)}`;
  }

  // 3. Test Account API endpoint (without API key — simulates login path)
  try {
    const client = new Client()
      .setEndpoint(endpoint)
      .setProject(projectId);
    const account = new Account(client);
    await account.get(); // Will fail (no session), but proves connectivity
    results.accountApi = "Unexpected success";
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    // "Invalid session" or auth error means endpoint responded — connectivity OK
    if (msg.includes("session") || msg.includes("authorization") || msg.includes("401") || msg.includes("403") || msg.includes("Auth")) {
      results.accountApi = "OK — endpoint reachable (no session, expected)";
    } else {
      results.accountApi = `FAIL — ${msg}`;
    }
  }

  const allOk =
    results.serverConnection.startsWith("OK") &&
    results.accountApi.startsWith("OK");

  return NextResponse.json(results, { status: allOk ? 200 : 503 });
}
