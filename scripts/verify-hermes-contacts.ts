import { listContacts } from "@/lib/db/contacts";

async function main() {
  try {
    const contacts = await listContacts({ search: "Hermes" });
    console.log("Contatti trovati:", contacts.length);
    for (const c of contacts) {
      console.log(`- ${c.name} | ${c.email} | ${c.id}`);
    }
  } catch (err) {
    console.error("Errore:", err);
  }
}

main();
