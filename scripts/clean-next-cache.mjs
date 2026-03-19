import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";

const cacheDir = join(process.cwd(), ".next", "cache");

if (existsSync(cacheDir)) {
  rmSync(cacheDir, { recursive: true, force: true });
  console.log("Removed .next/cache to keep deploy artifacts small.");
}
