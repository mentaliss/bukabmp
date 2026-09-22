import test from "node:test";
import assert from "node:assert/strict";
import {assess,columnProbeQueries} from "../scripts/reconcile-d1-migration-ledger.mjs";

function fixture(){
  const tables = {
    users:["telegram_user_id","created_at","referral_code","referred_by","updated_at","member_ref","first_activated_at","last_activated_at","activation_count"],
    referrals:["referral_id","referrer_user_id","referred_user_id","attributed_at","qualified_at","qualification_ref","status","rejection_reason"],
    supporter_state:["user_id","supporter_until","referral_entitlement_total","activation_until","activation_bonus_pending_days","total_stars","payment_count","last_payment_at","last_package_id","wall_mode","tag_applied","updated_at"],
    supporter_events:["event_id","user_id","source","days_delta","source_ref","created_at"],
    payments:["payment_event_id","telegram_charge_ref","user_id","package_id","stars","processed_at","status"],
    referral_rewards:["reward_event_id","user_id","valid_referral_count","entitlement_total_days","credited_delta_days","source_ref","created_at"],
    processed_updates:["update_id","type","processed_at"],
    telemetry_actor:["actor_hash","first_seen","last_seen"],
    telemetry_daily:["date","metric","channel","extension_version","count"],
    telemetry_daily_actor:["date","actor_hash","channel","extension_version","opened","job_started","ad_seen"],
    community_daily:["date","subscribers","members","captured_at"]
  };
  const indexes=[
    "idx_referrals_referrer","idx_referrals_status","idx_supporter_events_user","idx_payments_user",
    "idx_referral_rewards_user","idx_users_first_activated","idx_telemetry_actor_last_seen","idx_telemetry_daily_actor_actor"
  ];
  return {
    objects:[
      {name:"d1_migrations",type:"table"},
      ...Object.keys(tables).map(name=>({name,type:"table"})),
      ...indexes.map(name=>({name,type:"index"}))
    ],
    columns:Object.entries(tables).flatMap(([table_name,names])=>names.map(name=>({table_name,name}))),
    ledger:[]
  };
}

test("empty ledger can be baselined only when all migration effects exist",()=>{
  const result=assess(fixture());
  assert.equal(result.ok,true);
  assert.equal(result.canBaseline,true);
  assert.deepEqual(result.missingLedger,["0001_bot_v2.sql","0002_activation_ledger.sql","0003_media_analytics.sql"]);
});

test("extra live columns such as member_ref do not block reconciliation",()=>{
  const result=assess(fixture());
  assert.equal(result.problems.length,0);
});

test("missing activation column refuses baseline",()=>{
  const f=fixture();
  f.columns=f.columns.filter(row=>!(row.table_name==="users"&&row.name==="activation_count"));
  const result=assess(f);
  assert.equal(result.ok,false);
  assert.equal(result.canBaseline,false);
  assert.match(result.problems.join("\n"),/users\.activation_count/);
});

test("unknown ledger entry refuses automatic baseline",()=>{
  const f=fixture();
  f.ledger=[{name:"9999_unknown.sql"}];
  const result=assess(f);
  assert.equal(result.ok,true);
  assert.equal(result.canBaseline,false);
  assert.deepEqual(result.unknownLedgerEntries,["9999_unknown.sql"]);
});


test("column probes avoid compound SELECT limits on D1",()=>{
  const probes=columnProbeQueries();
  assert.equal(probes.length,11);
  assert.equal(new Set(probes.map(x=>x.table)).size,11);
  for(const probe of probes){
    assert.ok(probe.sql.includes("pragma_table_info"));
    assert.equal(probe.sql.includes("UNION ALL"),false);
  }
});
