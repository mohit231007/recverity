import test from "node:test";
import assert from "node:assert/strict";
import {createCatalog} from "../web/engine.mjs";
import {psi,jsDistance,ksStatistic,validateCatalog,simulateCurrent,monitorCatalog,demoEventSplit,auditEventSplit} from "../web/quality.mjs";
const catalog=createCatalog();
test("identical input shows no distribution drift",()=>{
 const x=monitorCatalog(catalog,catalog);
 assert.ok(x.checks.every(y=>Math.abs(y.value||0)<1e-10&&!y.alert));
 assert.equal(x.priceKs,0);
});
test("price shock and catalog shift are flagged",()=>{
 const p=monitorCatalog(catalog,simulateCurrent(catalog,"price-shock"));
 const c=monitorCatalog(catalog,simulateCurrent(catalog,"catalog-shift"));
 assert.ok(p.checks[0].alert);assert.ok(c.checks[1].alert);
});
test("inventory and missingness have independent alarms",()=>{
 assert.ok(monitorCatalog(catalog,simulateCurrent(catalog,"inventory-incident")).checks[2].alert);
 const x=monitorCatalog(catalog,simulateCurrent(catalog,"schema-incident"));
 assert.ok(x.checks[3].alert);assert.ok(x.quality.missingPrice>0);
});
test("drift algorithms are symmetric where defined",()=>{
 assert.ok(Math.abs(jsDistance(["a","a","b"],["a","b","b"])-jsDistance(["a","b","b"],["a","a","b"]))<1e-12);
 assert.equal(jsDistance(["a"],["a"]),0);
 assert.equal(ksStatistic([1,2,3],[1,2,3]),0);
 assert.ok(psi([1,2,3,4,5,6],[3,3,4,5,6,7])>=0);
});
test("data contracts flag invalid and duplicate IDs",()=>{
 const invalid=validateCatalog([{id:"a",price:0},{id:"a",price:null},{id:null,price:5}]);
 assert.equal(invalid.invalidPrice,1);assert.equal(invalid.missingPrice,1);assert.equal(invalid.duplicateId,2);
});
test("review-event, repeated pair and temporal leakage each detected",()=>{
 assert.equal(demoEventSplit("clean").leakage,false);
 assert.equal(demoEventSplit("review-reuse").eventOverlap,1);
 assert.equal(demoEventSplit("pair-overlap").userItemOverlap,1);
 assert.equal(demoEventSplit("time-inversion").temporalInversion,true);
});
test("chronology check is unknown without timestamps",()=>{
 const result=auditEventSplit([{eventId:"1",userId:"u",itemId:"i"}],[{eventId:"2",userId:"v",itemId:"j"}]);
 assert.equal(result.chronologicalKnown,false);
});

test("partial event IDs and timestamps do not produce false-green audits",()=>{
 const train=[{eventId:"e1",userId:"u1",itemId:"p1",timestamp:1},
              {eventId:null,userId:"u2",itemId:"p2",timestamp:null}];
 const test=[{eventId:"e2",userId:"u3",itemId:"p3",timestamp:2}];
 const r=auditEventSplit(train,test);
 assert.equal(r.eventIdsComplete,false);
 assert.equal(r.chronologicalKnown,false);
});
test("repeated event IDs within a training snapshot are flagged",()=>{
 const train=[{eventId:"repeat",userId:"u1",itemId:"p1",timestamp:1},
              {eventId:"repeat",userId:"u2",itemId:"p2",timestamp:2}];
 const test=[{eventId:"new",userId:"u3",itemId:"p3",timestamp:3}];
 const r=auditEventSplit(train,test);
 assert.equal(r.withinTrainEventReuse,1);
 assert.equal(r.leakage,true);
});
