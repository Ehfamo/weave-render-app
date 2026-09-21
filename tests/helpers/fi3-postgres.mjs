import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
export async function postgres() {
  const db = new PGlite();
  const read = (name) =>
    readFile(new URL(`../../supabase/migrations/${name}`, import.meta.url), "utf8");
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
 CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 GRANT USAGE ON SCHEMA auth TO anon,authenticated,service_role;
 GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated,service_role;`);
  const initial = await read("20260621060717_f63c7e99-8137-4c9b-8dcc-6f9f64d46285.sql");
  await db.exec(
    initial.match(/CREATE OR REPLACE FUNCTION public\.set_updated_at\(\)[\s\S]*?\$\$;/)[0],
  );
  const base = await read("20260811000000_request_7_backend_vertical_slice.sql");
  await db.exec(base.slice(0, base.indexOf("INSERT INTO storage.buckets")) + "\nCOMMIT;");
  const createAt = base.indexOf("CREATE OR REPLACE FUNCTION public.xeomx_create_project(");
  await db.exec(
    base.slice(
      createAt,
      base.indexOf("CREATE OR REPLACE FUNCTION public.xeomx_credit_balance", createAt),
    ),
  );
  for (const file of [
    "20260814200500_stage53_project_membership_acl_hardening.sql",
    "20260814201000_stage53_agents_workflows_control_plane.sql",
    "20260912220000_p2_agent_approval_consumption.sql",
    "20260912000000_p1_memory_core.sql",
    "20260913000000_p4_automation_collaboration.sql",
    "20260915115854_fi2_project_brain_and_execution_continuity.sql",
    "20260920000000_fi3_capability_runtime.sql",
  ])
    await db.exec(await read(file));
  async function actor(id, service = false) {
    await db.exec("RESET ROLE");
    await db.query(
      "SELECT set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",
      [
        id ?? "",
        JSON.stringify({ role: service ? "service_role" : id ? "authenticated" : "anon" }),
      ],
    );
    await db.exec(`SET ROLE ${service ? "service_role" : id ? "authenticated" : "anon"}`);
  }
  const scalar = async (sql, params = []) =>
    Object.values((await db.query(sql, params)).rows[0] ?? {})[0];
  return { db, actor, scalar };
}
