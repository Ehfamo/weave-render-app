import { readFile } from "node:fs/promises";
import { fixture as commerce, publisher, buyer, stranger } from "./fi5-fixture.mjs";
import { GovernanceService } from "../../src/lib/governance/service.ts";
export { publisher, buyer, stranger };
export async function fixture() {
  const f = await commerce();
  await f.db.exec("RESET ROLE");
  await f.db.exec(
    await readFile(
      new URL(
        "../../supabase/migrations/20260930120826_fi6_enterprise_governance.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const governance = (who) =>
    new GovernanceService({
      async command(action, data) {
        await f.actor(who);
        return f.scalar("SELECT xeomx_governance($1,$2)", [action, data]);
      },
    });
  return { ...f, governance };
}
