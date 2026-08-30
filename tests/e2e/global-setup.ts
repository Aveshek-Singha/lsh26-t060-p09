import { execFileSync } from "node:child_process";

/**
 * Reset the fleet to the seeded state once before the suite.
 *
 * The specs record real services against a real database, so they need a known
 * starting point. Seeding here rather than in each test keeps the suite fast
 * while still making it repeatable from a cold database.
 */
export default function globalSetup(): void {
  if (process.env.E2E_SKIP_SEED === "1") {
    console.log("[e2e] E2E_SKIP_SEED=1, leaving existing data in place");
    return;
  }

  console.log("[e2e] seeding database…");
  execFileSync("npm", ["run", "seed"], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
}
