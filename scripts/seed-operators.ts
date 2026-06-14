#!/usr/bin/env node
import "./load-env";

import { upsertCrmOperator } from "@/lib/db/crm-operators";

const USERS = [
  {
    name: "Francesco Mellucci",
    appwriteUserId: "6a162ac9000920902da8",
  },
  {
    name: "Leonardo Sartori",
    appwriteUserId: "6a2dcefde095891b0300",
  },
  {
    name: "Ricardo Consuegra",
    appwriteUserId: "6a2dcc800037d83f4532",
  },
];

async function main() {
  for (const user of USERS) {
    await upsertCrmOperator({
      name: user.name,
      appwriteUserId: user.appwriteUserId,
      role: "admin",
      scopes: ["finance", "crm:*"],
      active: true,
      notes: "Created during production migration",
    });
    console.log(`crm_operator admin created/updated: ${user.name} (${user.appwriteUserId})`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
