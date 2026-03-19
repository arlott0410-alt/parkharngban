import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const wranglerPath = join(process.cwd(), "wrangler.toml");

if (!existsSync(wranglerPath)) {
  process.exit(0);
}

const content = readFileSync(wranglerPath, "utf8");
const blockedSections = ["[vars]", "[[secret_store_secrets]]"];

const foundBlockedSection = blockedSections.find((section) =>
  content.includes(section)
);

if (foundBlockedSection) {
  console.error(
    `Blocked ${foundBlockedSection} in wrangler.toml to protect Cloudflare dashboard Variables/Secrets.`
  );
  console.error(
    "Please keep production secrets in Cloudflare Dashboard > Workers & Pages > Settings > Variables and Secrets."
  );
  process.exit(1);
}

process.exit(0);
