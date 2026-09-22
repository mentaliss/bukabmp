#!/usr/bin/env node
import {execFileSync} from "node:child_process";

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
  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  const out = execFileSync(
    npx,
    ["wrangler","d1","execute",DATABASE,"--remote","--json","--command",sql],
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

  return {
    ok: problems.length === 0,
    problems,
    unknownLedgerEntries: unknown,
    missingLedger,
    canBaseline: problems.length === 0 && unknown.length === 0 && missingLedger.length > 0
  };
}

function readState(){
  const objects = runSql("SELECT name,type FROM sqlite_schema WHERE type IN ('table','index') ORDER BY type,name;");
  const union = [...REQUIRED_TABLES.keys()]
    .map(name => `SELECT '${name}' AS table_name,name FROM pragma_table_info('${name}')`)
    .join(" UNION ALL ");
  const columns = runSql(union+" ORDER BY table_name,name;");
  const ledger = runSql("SELECT id,name,applied_at FROM d1_migrations ORDER BY id;");
  return {objects,columns,ledger};
}

function writeBaseline(){
  const values = EXPECTED_MIGRATIONS.map(name =>
    `INSERT INTO d1_migrations(name) SELECT '${name}' WHERE NOT EXISTS (SELECT 1 FROM d1_migrations WHERE name='${name}');`
  ).join("\n");
  runSql("BEGIN;\n"+values+"\nCOMMIT;");
}

if(import.meta.url === `file://${process.argv[1].replaceAll("\\","/")}`){
  const write = process.argv.includes("--write");
  const state = readState();
  const result = assess(state);

  if(!result.ok){
    console.error("REFUSE: live schema does not prove that 0001/0002/0003 effects are present.");
    for(const problem of result.problems) console.error(" - "+problem);
    process.exit(2);
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
    process.exit(4);
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
