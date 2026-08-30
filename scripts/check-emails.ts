/** Confirms every seeded owner carries a demo email: `npm run check:emails` */
import { getClient } from "@/lib/db/client";
import { listOwners } from "@/lib/db/repo";

async function main(): Promise<void> {
  const owners = await listOwners();
  const withEmail = owners.filter((o) => o.email);
  const missing = owners.filter((o) => !o.email);

  console.log(`owners            ${owners.length}`);
  console.log(`with email        ${withEmail.length}`);
  console.log(`missing email     ${missing.length}`);
  console.log(`all unique        ${new Set(withEmail.map((o) => o.email)).size === withEmail.length}`);
  console.log(`all @example.com  ${withEmail.every((o) => o.email!.endsWith("@example.com"))}`);

  console.log("\nsample:");
  for (const o of owners.slice(0, 8)) {
    console.log(`  ${o.id}  ${o.name.padEnd(20)} ${o.email ?? "— MISSING —"}`);
  }

  if (missing.length > 0) {
    console.log("\nMISSING:");
    for (const o of missing) console.log(`  ${o.id} ${o.name}`);
    process.exitCode = 1;
  }
}

main()
  .catch((e: unknown) => {
    console.error("failed:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(async () => {
    const c = await getClient().catch(() => null);
    await c?.close().catch(() => undefined);
  });
