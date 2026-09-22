#!/usr/bin/env node
import {execFileSync} from "node:child_process";
import path from "node:path";
import {fileURLToPath} from "node:url";

const DATABASE = "bmp-terbuka-bot-v2";
const EXPECTED_MIGRATIONS = [
  "0001_bot_v2.sql",
  "0002_activation_ledger.sql",
  "0003_media_analytics.sql"
];

const REQUIRED_TABLES = new Map([
  ["users", ["telegram_user_id","created_at","referral_code","referred_by","updated_at","first_activated_at","last_activated_at","activation_count"]],
  ["referrals", ["referral_id","referrer_user_id","referred_user_id","attributed_at","qualified_at","qualification_ref","status","rejection_reason"]],
  ["supporter_state", ["user_id","supporter_until","referral_entitlement_total","activation_until","activation_bonus_pending_days","total_stars","payment_count","last_payment_at","last_package_id","wall_mode","tag_applied","updated_at"]],
  ["supporter_events", ["event_id","user_id","source","days_delta","source_ref","created_at"]],
  ["payments", ["payment_event_id","telegram_charge_ref","user_id","package_id","stars","processed_at","status"]],
  ["referral_rewards", ["reward_event_id","user_id","valid_referral_count","entitlement_total_days","credited_delta_days","source_ref","created_at"]],
  ["processed_updates", ["update_id","type","processed_at"]],
  ["telemetry_actor", ["actor_hash","first_seen","last_seen"]],
  ["telemetry_daily", ["date","metric","channel","extension_version","count"]],
  ["telemetry_daily_actor", ["date","actor_hash","channel","extension_version","opened","job_started","ad_seen"]],
  ["community_daily", ["date","subscribers","members","captured_at"]]
]);

const REQUIRED_INDEXES = new Set([
  "idx_referrals_referrer",
  "idx_referrals_status",
  "idx_supporter_events_user",
  "idx_payments_user",
  "idx_referral_rewards_user",
  "idx_users_first_activated",
  "idx_telemetry_actor_last_seen",
  "idx_telemetry_daily_actor_actor"
]);

const SAFE_INDEX_REPAIRS = new Map([
  ["idx_users_first_activated",
   "CREATE INDEX IF NOT EXISTS idx_users_first_activated ON users(first_activated_at);"]
]);

function rowsFromWranglerJson(parsed){
  const batches = Array.isArray(parsed) ? parsed : [parsed];
  const rows = [];
  for(const batch of batches){
    if(Array.isArray(batch?.results)) rows.push(...batch.results);
    else if(Array.isArray(batch?.result)) rows.push(...batch.result);
    else if(Array.isArray(batch?.results?.results)) rows.push(...batch.results.results);
  }
  return rows;
}

function runSql(sql){
  const wranglerBin = fileURLToPath(new URL("../node_modules/wrangler/bin/wrangler.js", import.meta.url));
  const out = execFileSync(
    process.execPath,
    [wranglerBin,"d1","execute",DATABASE,"--remote","--json","--command",sql],
    {encoding:"utf8",stdio:["ignore","pipe","inherit"]}
  );
  return rowsFromWranglerJson(JSON.parse(out));
}

export function assess({objects=[],columns=[],ledger=[]}){
  const names = new Map(objects.map(row => [String(row.name), String(row.type)]));
  const byTable = new Map();
  for(const row of columns){
    const table = String(row.table_name || "");
    if(!byTable.has(table)) byTable.set(table,new Set());
    byTable.get(table).add(String(row.name || ""));
  }

  const problems = [];
  if(names.get("d1_migrations") !== "table") problems.push("missing table d1_migrations");

  for(const [table, requiredColumns] of REQUIRED_TABLES){
    if(names.get(table) !== "table"){
      problems.push("missing table "+table);
      continue;
    }
    const actual = byTable.get(table) || new Set();
    for(const column of requiredColumns){
      if(!actual.has(column)) problems.push("missing column "+table+"."+column);
    }
  }
  for(const index of REQUIRED_INDEXES){
    if(names.get(index) !== "index") problems.push("missing index "+index);
  }

  const applied = new Set(ledger.map(row => String(row.name || "")));
  const unknown = [...applied].filter(name => !EXPECTED_MIGRATIONS.includes(name));
  const missingLedger = EXPECTED_MIGRATIONS.filter(name => !applied.has(name));

  const safeRepairProblems = problems.filter(problem =>
    problem.startsWith("missing index ") &&
    SAFE_INDEX_REPAIRS.has(problem.slice("missing index ".length))
  );
  const unsafeProblems = problems.filter(problem => !safeRepairProblems.includes(problem));

  return {
    ok: problems.length === 0,
    problems,
    safeRepairProblems,
    unsafeProblems,
    unknownLedgerEntries: unknown,
    missingLedger,
    canBaseline: problems.length === 0 && unknown.length === 0 && missingLedger.length > 0
  };
}

export function columnProbeQueries(){
  return [...REQUIRED_TABLES.keys()].map(name => ({
    table: name,
    sql: `SELECT name FROM pragma_table_info('${name}') ORDER BY cid;`
  }));
}

function readState(){
  const objects = runSql("SELECT name,type FROM sqlite_schema WHERE type IN ('table','index') ORDER BY type,name;");
  const columns = [];
  // D1 rejects a large UNION of pragma_table_info() calls with
  // "too many terms in compound SELECT". Probe each known table separately.
  for(const probe of columnProbeQueries()){
    for(const row of runSql(probe.sql)){
      columns.push({table_name: probe.table, name: row.name});
    }
  }
  const ledger = runSql("SELECT id,name,applied_at FROM d1_migrations ORDER BY id;");
  return {objects,columns,ledger};
}

function repairSafeSchemaProblems(result){
  if(!result?.safeRepairProblems?.length) return;
  if(result.unsafeProblems?.length){
    throw new Error("unsafe schema problems remain; refusing repair");
  }
  for(const problem of result.safeRepairProblems){
    const index = problem.slice("missing index ".length);
    const sql = SAFE_INDEX_REPAIRS.get(index);
    if(!sql) throw new Error("missing safe repair SQL for "+index);
    runSql(sql);
  }
}

export function baselineStatements(){
  return EXPECTED_MIGRATIONS.map(name =>
    `INSERT INTO d1_migrations(name) SELECT '${name}' WHERE NOT EXISTS (SELECT 1 FROM d1_migrations WHERE name='${name}');`
  );
}

function writeBaseline(){
  // Cloudflare D1 rejects explicit SQL BEGIN/COMMIT through the remote query API.
  // Execute each idempotent insert independently, then verify the full ledger.
  for(const sql of baselineStatements()) runSql(sql);
}

if(process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])){
  const write = process.argv.includes("--write");
  const state = readState();
  const result = assess(state);

  if(!result.ok){
    if(write && result.unsafeProblems.length === 0 && result.safeRepairProblems.length > 0){
      console.log("Repairing safe additive schema gaps before ledger baseline:");
      for(const problem of result.safeRepairProblems) console.log(" - "+problem);
      repairSafeSchemaProblems(result);
      const repaired = assess(readState());
      if(!repaired.ok){
        console.error("REFUSE: safe schema repair did not converge.");
        for(const problem of repaired.problems) console.error(" - "+problem);
        process.exit(2);
      }
      Object.assign(result,repaired);
    }else{
      console.error("REFUSE: live schema does not prove that 0001/0002/0003 effects are present.");
      for(const problem of result.problems) console.error(" - "+problem);
      if(result.safeRepairProblems.length && result.unsafeProblems.length === 0){
        console.error("This gap is safe and additive. Re-run with --write to create it, re-check schema, then baseline.");
      }
      process.exit(2);
    }
  }
  if(result.unknownLedgerEntries.length){
    console.error("REFUSE: unexpected migration ledger entries: "+result.unknownLedgerEntries.join(", "));
    process.exit(3);
  }
  if(result.missingLedger.length === 0){
    console.log("OK: D1 migration ledger is already reconciled.");
    process.exit(0);
  }

  console.log("Schema matches the effects of 0001/0002/0003.");
  console.log("Missing ledger entries: "+result.missingLedger.join(", "));
  if(!write){
    console.log("READ-ONLY PASS. Re-run with --write to baseline only the missing ledger rows.");
    process.exit(0);
  }

  if(!result.canBaseline){
    console.error("REFUSE: baseline preconditions not satisfied.");
    process.exit(5);
  }

  writeBaseline();
  const after = assess(readState());
  if(!after.ok || after.missingLedger.length){
    console.error("FAILED: ledger reconciliation did not converge.");
    process.exit(6);
  }
  console.log("OK: D1 migration ledger reconciled without replaying schema migrations.");
}
