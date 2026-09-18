import { mkdir, cp, existsSync } from "node:fs";
import { promisify } from "node:util";

const mkdirAsync = promisify(mkdir);
const cpAsync = promisify(cp);

async function copyIfExists(src, dest, options = {}) {
  if (!existsSync(src)) return;
  await mkdirAsync(dest.split("/").slice(0, -1).join("/"), { recursive: true }).catch(() => {});
  await cpAsync(src, dest, { recursive: true, ...options });
}

async function main() {
  await mkdirAsync("dist", { recursive: true }).catch(() => {});
  await copyIfExists("manifest.json", "dist/manifest.json");
  await copyIfExists("icons", "dist/icons");
  await copyIfExists("logo/trapscan-mark.png", "dist/logo/trapscan-mark.png");
  await copyIfExists("demo-pages", "dist/demo-pages");
  await copyIfExists("demo.html", "dist/demo.html");
  await copyIfExists(".env.example", "dist/.env.example");
  await copyIfExists("README.md", "dist/README.md");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
