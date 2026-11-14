import test from "node:test";
import assert from "node:assert/strict";
import {parseCSV,normalizeCatalog,normalizeInteractions,DEMO_CATALOG_CSV,DEMO_TRAIN_CSV,DEMO_TEST_CSV} from "../web/csv-lab.mjs";
test("quoted cells, escaped quotes, BOM and embedded commas are supported",()=>{
 const z=parseCSV('\uFEFFid,name\r\n1,"Thing, ""Pro"""\r\n2,"Item"\r\n');
 assert.equal(z.rows[0].name,'Thing, "Pro"');assert.equal(z.rows.length,2);
});
test("inconsistent columns and duplicate headers rejected",()=>{
 assert.throws(()=>parseCSV("a,b\n1\n"),/column/);
 assert.throws(()=>parseCSV("a,a\n1,2\n"),/unique/);
 assert.throws(()=>parseCSV('a\n"never'),/unclosed/);
 assert.throws(()=>parseCSV("a\n1\n2\n3",{maxRows:2}),/exceeds/);
});
test("catalog validation and missing ratings preserve null",()=>{
 const c=normalizeCatalog(parseCSV(DEMO_CATALOG_CSV));
 assert.equal(c.items.length,3);assert.equal(c.items[2].rating,null);assert.equal(c.items[2].available,false);
});
test("interactions preserve genuine user-level ratings and event IDs",()=>{
 const t=normalizeInteractions(parseCSV(DEMO_TRAIN_CSV));
 const s=normalizeInteractions(parseCSV(DEMO_TEST_CSV));
 assert.equal(t.events[0].rating,5);assert.equal(s.events[1].eventId,"e2");
});
test("invalid values and missing time are reported",()=>{
 const c=normalizeCatalog(parseCSV("product_id,price,rating\np,-5,99\np,12,4"));
 assert.ok(c.warnings.length>=2);
 const e=normalizeInteractions(parseCSV("user_id,product_id\nu,p"));
 assert.ok(e.warnings.some(x=>/event_id/.test(x)));
});
