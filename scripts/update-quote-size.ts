import { Client, Databases } from "node-appwrite";

const client = new Client()
  .setEndpoint("https://appwrite.app.easlydev.online/v1")
  .setProject("69eea3cf0019d4aa1ab0")
  .setKey("standard_0f632ed288bf9d8dec3486e1d22b7862c91b307140bfd5242cf42ca787b8691f900590a751cb80b3c97d3098aa4a15a6cbe9131b18f9fb62a65a4be2b4536b0ab000e8270dc76d1eb041c633ad29400eb41f08e18a95c724b97f57caed5c1e235043e8452939bde83f2feb83ba1e36e87f1c0f5780bc683bec96ed0fbd9db33c");

const db = new Databases(client);
const DB_ID = "crm";

async function main() {
  try {
    await db.updateStringAttribute(DB_ID, "quotes", "notes", false, null, 100000);
    console.log("✅ quotes.notes aggiornato a 100000 chars");
  } catch (e: unknown) {
    console.error("❌ Errore quotes.notes:", e instanceof Error ? e.message : e);
  }

  try {
    await db.updateStringAttribute(DB_ID, "quotes", "items", true, null, 100000);
    console.log("✅ quotes.items aggiornato a 100000 chars");
  } catch (e: unknown) {
    console.error("❌ Errore quotes.items:", e instanceof Error ? e.message : e);
  }
}

main();
