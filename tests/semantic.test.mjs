import test from "node:test";
import assert from "node:assert/strict";
import {answer,createIndex,retrieve,KNOWLEDGE} from "../web/semantic.mjs";
const idx=createIndex();
test("knowledge index deterministic and no external fetch required",()=>{
 assert.equal(idx.documents.length,KNOWLEDGE.length);
 assert.deepEqual(retrieve("chronological splits",idx),retrieve("chronological splits",idx));
});
test("paraphrases retrieve the expected grounded note",()=>{
 for(const [q,expected] of [
 ["why 81.67% dropped to 3.48% in offline test","leakage"],
 ["is each shopper star score actually known","ratings"],
 ["does chat upload private queries to api","privacy"],
 ["how detect category mix shifting with jensen","drift"],
 ["what about zero-history guest cold-start","cold"],
 ["MovieLens real ratings dataset redistribution","data"]
 ]){
  const r=answer(q,idx);assert.equal(r.found,true,q);assert.equal(r.sources[0].id,expected,q);
 }
});
test("unknown nonsensical queries abstain without fabrication",()=>{
 const r=answer("quasarnova zeptoglyph trilonium",idx);
 assert.equal(r.found,false);assert.equal(r.sources.length,0);
});
test("responses have provenance and nonprobabilistic disclosure",()=>{
 const r=answer("hybrid 60 40 score blend",idx);
 assert.ok(r.found);assert.match(r.sources[0].url,/github.com/);
 assert.match(r.disclosure,/not a confidence probability/);
});

test("real-data research figures retrieve the documented, domain-separated result",()=>{
 const r=answer("Why did the hybrid get 44.22% versus 46.26% on MovieLens real benchmark?",idx);
 assert.equal(r.found,true);
 assert.equal(r.sources[0].id,"realbenchmark");
 assert.match(r.text,/147 eligible test users/);
});
