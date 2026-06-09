// Within-org ROLE-BASED ACCESS. Even inside one org, lower/restricted roles must not see
// records outside their remit. Encodes the spec's role rules: client and field staff must
// not read internal commercial records; a subcontractor sees only their own POs.
//
// EXPECTED TODAY: several of these FAIL — current RLS gates on project-membership/global
// role, not on the finer role rules. Failures here are the RBAC hardening checklist
// (report R5/R6). Auto-skips without env/manifest.
import { describe, it, expect, beforeAll } from "vitest";
import { haveTestEnv, userClient } from "./lib/clients.mjs";
import { hasManifest, readManifest } from "./lib/manifest.mjs";

const ready = haveTestEnv() && hasManifest();
const d = ready ? describe : describe.skip;

d("role-based access within one org (org A)", () => {
  let A, client, worker, subbie, subbieId;

  beforeAll(async () => {
    const m = readManifest();
    A = m.orgs[0];
    client = (await userClient(A.users.client[0].email, m.password)).client;
    worker = (await userClient(A.users.worker[0].email, m.password)).client;
    subbie = (await userClient(A.users.subbie[0].email, m.password)).client;
    subbieId = A.users.subbie[0].id;
  });

  describe("client must not see internal records", () => {
    for (const table of ["tasks", "hazards", "purchase_orders", "variations"])
      it(`client reads 0 ${table}`, async () => {
        const { data } = await client.from(table).select("id");
        expect((data || []).length, `client read ${table}`).toBe(0);
      });
  });

  describe("field staff must not see commercial records", () => {
    for (const table of ["purchase_orders", "variations"])
      it(`worker reads 0 ${table}`, async () => {
        const { data } = await worker.from(table).select("id");
        expect((data || []).length, `field worker read commercial ${table}`).toBe(0);
      });
  });

  it("subcontractor sees only their own purchase orders", async () => {
    const { data } = await subbie.from("purchase_orders").select("id, subbie_id");
    const foreign = (data || []).filter((r) => r.subbie_id !== subbieId);
    expect(foreign.length, "subbie saw POs not issued to them").toBe(0);
  });
});
