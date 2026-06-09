// The seed writes a manifest of everything it created (org ids, users by role, project
// ids, and one sample record id per entity per org). The isolation/RBAC tests read it so
// they can attempt cross-org access by real ids without re-querying as admin. Git-ignored.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
export const MANIFEST_PATH = join(here, "..", ".manifest.json");

export const hasManifest = () => existsSync(MANIFEST_PATH);
export const readManifest = () => JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
export const writeManifest = (m) =>
  writeFileSync(MANIFEST_PATH, JSON.stringify(m, null, 2));
