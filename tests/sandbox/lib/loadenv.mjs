// Minimal .env.test loader (no dependency). Populates process.env from tests/.env.test
// if present, without overriding anything already set in the real environment. Imported
// for its side effect by clients.mjs so seed/reset and vitest all see the same config.
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
for (const path of [join(here, "..", "..", ".env.test"), join(here, "..", ".env.test")]) {
  if (!existsSync(path)) continue;
  for (const raw of readFileSync(path, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
      val = val.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
