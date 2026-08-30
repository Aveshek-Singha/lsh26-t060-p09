import dns from "node:dns";
import { MongoClient, type Db } from "mongodb";

/**
 * Optional escape hatch for `mongodb+srv://` on networks whose resolver refuses
 * SRV/TXT lookups (some ISP and corporate resolvers answer A records only, and
 * the driver then fails with `querySrv ECONNREFUSED`). Setting
 * MONGODB_DNS_SERVERS=1.1.1.1,8.8.8.8 points only the record lookups at a
 * public resolver; the TCP connection still uses the OS resolver as normal.
 * Unset in production, where cloud DNS handles SRV correctly.
 */
const dnsServers = process.env.MONGODB_DNS_SERVERS?.split(",")
  .map((server) => server.trim())
  .filter(Boolean);

if (dnsServers && dnsServers.length > 0) {
  dns.setServers(dnsServers);
}

/**
 * A single MongoClient shared across the process.
 *
 * Serverless functions get frozen and thawed rather than torn down, so opening
 * a client per request piles up connections until Atlas starts refusing them
 * ("connection storming"). Caching the *promise* on a module-level global means
 * warm invocations reuse the existing pool, and concurrent first-callers await
 * one connect rather than racing to open several. The same global also survives
 * dev-server hot reloads.
 */

const DB_NAME = process.env.MONGODB_DB ?? "lsh26_p09";

declare global {
  // eslint-disable-next-line no-var
  var __mongoClientPromise: Promise<MongoClient> | undefined;
}

function connect(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      "MONGODB_URI is not set. Copy .env.example to .env.local and fill in the Atlas connection string.",
    );
  }

  const client = new MongoClient(uri, {
    // Small pool per instance: many instances times a large pool exhausts the
    // Atlas connection limit long before it helps throughput.
    maxPoolSize: 10,
    minPoolSize: 0,
    maxIdleTimeMS: 60_000,
    // Fail fast with a readable error instead of hanging a page render.
    serverSelectionTimeoutMS: 8_000,
  });

  return client.connect();
}

export function getClient(): Promise<MongoClient> {
  if (!global.__mongoClientPromise) {
    global.__mongoClientPromise = connect().catch((error: unknown) => {
      // Clear the cache so a later request can retry rather than being stuck
      // awaiting a permanently rejected promise.
      global.__mongoClientPromise = undefined;
      throw error;
    });
  }
  return global.__mongoClientPromise;
}

export async function getDb(): Promise<Db> {
  const client = await getClient();
  return client.db(DB_NAME);
}

export { DB_NAME };
