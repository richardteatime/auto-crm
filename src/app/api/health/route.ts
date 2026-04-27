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

  // 2. Test server-to-Appwrite connection (with API key — list users)
  try {
    const client = new Client()
      .setEndpoint(endpoint)
      .setProject(projectId)
      .setKey(apiKey);
    const users = new Users(client);
    const list = await users.list();
    results.serverConnection = `OK — ${list.total} users found`;
  } catch (e: unknown) {
    results.serverConnection = `FAIL — ${e instanceof Error ? e.message : String(e)}`;
  }

  // 3. Test Account API endpoint reachability (guest = no session, expected to fail auth)
  try {
    const client = new Client()
      .setEndpoint(endpoint)
      .setProject(projectId);
    const account = new Account(client);
    await account.get();
    results.accountApi = "Unexpected success";
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    // Any error that's NOT a network error means the endpoint is reachable
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
