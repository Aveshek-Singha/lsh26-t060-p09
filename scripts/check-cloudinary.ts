/**
 * Cloudinary credential smoke test: `npm run check:cloudinary`
 *
 * This project does not use Cloudinary — nothing in the four required features
 * involves file uploads — but the event supplied credentials, so this verifies
 * they work. Uses the Admin API `ping` endpoint over plain fetch; no SDK, no
 * extra dependency. Prints no secrets.
 */

interface CloudinaryConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

/** CLOUDINARY_URL has the form cloudinary://<api_key>:<api_secret>@<cloud_name> */
function fromUrl(url: string): CloudinaryConfig | null {
  const match = /^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/.exec(url.trim().replace(/^"|"$/g, ""));
  if (!match) return null;
  return { apiKey: match[1]!, apiSecret: match[2]!, cloudName: match[3]! };
}

function resolveConfig(): CloudinaryConfig | null {
  const url = process.env.CLOUDINARY_URL;
  if (url) {
    const parsed = fromUrl(url);
    if (parsed) return parsed;
    console.warn("WARN   CLOUDINARY_URL is set but not in cloudinary://key:secret@cloud form");
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (cloudName && apiKey && apiSecret) return { cloudName, apiKey, apiSecret };

  return null;
}

async function main(): Promise<void> {
  const config = resolveConfig();
  if (!config) {
    console.error("FAIL   No Cloudinary credentials found in the environment.");
    console.error("       Expected CLOUDINARY_URL, or all three of CLOUDINARY_CLOUD_NAME,");
    console.error("       CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET.");
    process.exit(1);
  }

  console.log(`Cloud  ${config.cloudName}`);
  console.log(`Key    ${config.apiKey.slice(0, 4)}...${config.apiKey.slice(-2)} (${config.apiKey.length} chars)`);
  console.log(`Secret ****  (${config.apiSecret.length} chars)`);

  const auth = Buffer.from(`${config.apiKey}:${config.apiSecret}`).toString("base64");
  const base = `https://api.cloudinary.com/v1_1/${config.cloudName}`;
  const startedAt = Date.now();

  try {
    const response = await fetch(`${base}/ping`, {
      headers: { Authorization: `Basic ${auth}` },
      signal: AbortSignal.timeout(15_000),
    });
    const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;

    if (!response.ok) {
      const detail =
        typeof body.error === "object" && body.error !== null
          ? String((body.error as Record<string, unknown>).message ?? "")
          : JSON.stringify(body);
      console.error(`\nFAIL   HTTP ${response.status} ${response.statusText} — ${detail}`);
      if (response.status === 401) console.error("HINT   API key or secret is wrong.");
      if (response.status === 404) console.error("HINT   Cloud name is wrong.");
      process.exitCode = 1;
      return;
    }

    console.log(`OK     ping ${String(body.status ?? "ok")} in ${Date.now() - startedAt} ms`);

    // Usage is a second, more meaningful authenticated call.
    const usageResponse = await fetch(`${base}/usage`, {
      headers: { Authorization: `Basic ${auth}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (usageResponse.ok) {
      const usage = (await usageResponse.json()) as {
        plan?: string;
        credits?: { usage?: number; limit?: number };
        resources?: number;
      };
      console.log(`OK     plan ${usage.plan ?? "unknown"}, ${usage.resources ?? 0} stored assets`);
      if (usage.credits) {
        console.log(`       credits used ${usage.credits.usage ?? 0} of ${usage.credits.limit ?? "?"}`);
      }
    }

    console.log("\nCloudinary credentials are valid.");
    console.log("Note: this project does not use Cloudinary; no upload path was built.");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\nFAIL   ${message}`);
    process.exitCode = 1;
  }
}

void main();
