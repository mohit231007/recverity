import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const path=new URL("../web/data/movielens-100k-v1.json",import.meta.url);
const report=JSON.parse(readFileSync(path,"utf-8"));
test("official-data evidence is complete, versioned and aggregate-only",()=>{
 assert.equal(report.benchmark_version,"1.0.0");
 assert.equal(report.split.train_events+report.split.validation_events+report.split.test_events,100000);
 assert.equal(report.split.train_events,80003);
 assert.equal(report.test.eligible_users,147);
 assert.equal(report.test.models.hybrid.history_free_users,96);
 assert.match(report.provenance,/grouplens\.org/);
 assert.match(report.ratings_sha256,/^[a-f0-9]{64}$/);
 assert.match(report.items_sha256,/^[a-f0-9]{64}$/);
 assert.equal(Object.hasOwn(report.test,"_internal"),false);
 assert.equal(Object.hasOwn(report.validation,"_internal"),false);
 assert.equal(JSON.stringify(report).includes('"userId"'),false);
});
test("all reported ranking scores and uncertainty bounds are valid fractions",()=>{
 for(const period of ["validation","test"]){
  for(const m of Object.values(report[period].models)){
   for(const metric of ["hr@5","hr@10","ndcg@5","ndcg@10","recall@5","recall@10","catalog_coverage_at_10"]){
    assert.ok(m[metric]>=0&&m[metric]<=1,period+" "+metric);
   }
   const [lo,hi]=m["hr@5_95pct_user_bootstrap"];
   assert.ok(lo<=m["hr@5"]&&m["hr@5"]<=hi,period+" bootstrap contains estimate");
  }
 }
});
test("publish actual observations, not an invented hybrid win",()=>{
 assert.equal(report.test.models.hybrid["hr@5"],.4422);
 assert.equal(report.test.models.popularity["hr@5"],.4626);
 assert.equal(report.test.models.content["hr@5"],.4626);
 assert.ok(report.test.models.hybrid["hr@5"]<report.test.models.popularity["hr@5"]);
});
test("measured cohort drift includes uncertainty and honest non-significance",()=>{
 for(const [model,m] of Object.entries(report.drift.models)){
  assert.ok(Number.isFinite(m.top1_score_ks_d)&&m.top1_score_ks_d>=0&&m.top1_score_ks_d<=1,model);
  assert.ok(Number.isFinite(m.top1_score_psi)&&m.top1_score_psi>=0,model);
  const ci=m["hr@5_delta_95pct_independent_user_bootstrap"];
  assert.equal(ci.length,2);
  assert.equal(m["hr@5_ci_excludes_zero"],false);
  assert.ok(ci[0]<=0&&ci[1]>=0);
 }
 assert.equal(report.drift.models.content.top1_score_psi,0);
});
