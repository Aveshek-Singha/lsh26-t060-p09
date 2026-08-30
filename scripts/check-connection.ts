/**
 * Connectivity smoke test: `npm run check:db`
 *
 * Verifies the Atlas credentials in .env.local actually work from this machine
 * before the app depends on them. Prints no secrets.
 */
import dns from "node:dns";
import { MongoClient } from "mongodb";

function redactUri(uri: string): string {
  return uri.replace(/\/\/([^:]+):([^@]+)@/, "//$1:****@");
}

async function main(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB ?? "lsh26_p09";

  if (!uri) {
    console.error("FAIL  MONGODB_URI is not set (expected in .env.local)");
    process.exit(1);
  }

  console.log(`URI    ${redactUri(uri)}`);
  console.log(`DB     ${dbName}`);

  const servers = process.env.MONGODB_DNS_SERVERS?.split(",").map((s) => s.trim()).filter(Boolean);
  if (servers?.length) { dns.setServers(servers); console.log(`DNS    record lookups via ${servers.join(", ")}`); }

  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10_000 });
  const startedAt = Date.now();

  try {
    await client.connect();
    const admin = client.db(dbName).admin();
    const ping = await admin.command({ ping: 1 });
    console.log(`OK     ping ${ping.ok === 1 ? "succeeded" : "returned " + JSON.stringify(ping)} in ${Date.now() - startedAt} ms`);

    const info = await client.db(dbName).command({ buildInfo: 1 }).catch(() => null);
    if (info?.version) console.log(`OK     server version ${info.version}`);

    const collections = await client.db(dbName).listCollections().toArray();
    console.log(
      collections.length === 0
        ? `OK     database "${dbName}" is empty and ready to seed`
        : `OK     collections: ${collections.map((c) => c.name).join(", ")}`,
    );

    for (const name of ["owners", "vehicles", "settings"]) {
      if (collections.some((c) => c.name === name)) {
        const count = await client.db(dbName).collection(name).countDocuments();
        console.log(`       ${name}: ${count} documents`);
      }
    }

    console.log("\nConnection test passed.");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\nFAIL   ${message}`);
    if (/IP|whitelist|not allowed/i.test(message)) {
      console.error(
        "HINT   Atlas is refusing this IP. Add your address (or 0.0.0.0/0 for a\n" +
          "       serverless deploy) under Atlas -> Network Access.",
      );
    }
    if (/auth|credentials|password/i.test(message)) {
      console.error("HINT   Check the username and password embedded in MONGODB_URI.");
    }
    process.exitCode = 1;
  } finally {
    await client.close().catch(() => undefined);
  }
}

void main();
