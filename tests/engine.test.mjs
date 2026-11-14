import {test} from "node:test";
import assert from "node:assert/strict";
import {buildLab,createCatalog,createInteractions,recommend,coldStartAlternatives,clamp} from "../web/engine.mjs";
const lab=buildLab();
test("fictional product catalog is stable and unique",()=>{
 assert.equal(lab.items.length,72);assert.deepEqual(createCatalog(),createCatalog());
 assert.equal(new Set(lab.items.map(x=>x.id)).size,72);
});
test("synthetic behavior deterministic",()=>{
 assert.equal(lab.users.length,400);
 assert.deepEqual(createInteractions(lab.items),createInteractions(lab.items));
});
test("content scores are normalized, symmetric",()=>{
 for(let i=0;i<72;i++)for(let j=0;j<72;j++){
  assert.ok(lab.content[i][j]>=0&&lab.content[i][j]<=1.000000001);
  assert.ok(Math.abs(lab.content[i][j]-lab.content[j][i])<1e-10);
 }
});
test("collaborative cosine is bounded and symmetric",()=>{
 for(let i=0;i<72;i++)for(let j=0;j<72;j++){
  assert.ok(lab.cf.matrix[i][j]>=0&&lab.cf.matrix[i][j]<=1.000000001);
  assert.ok(Math.abs(lab.cf.matrix[i][j]-lab.cf.matrix[j][i])<1e-10);
 }
});
test("zero-history guest has popularity-only scores",()=>{
 const out=recommend(lab,{persona:"guest",diversity:0});
 assert.equal(out.length,5);assert.ok(out.every(p=>p.method==="popularity"&&p.score===p.popularity));
});
test("returning user does not see already seen products",()=>{
 const seen=new Set(lab.personas.audio.history);
 assert.ok(recommend(lab,{persona:"audio"}).every(p=>!seen.has(p.id)));
});
test("hybrid uses exactly 60/40 default score fusion",()=>{
 const out=recommend(lab,{persona:"audio",weight:.6,diversity:0});
 for(const p of out)assert.ok(Math.abs(p.score-(.6*p.collaborative+.4*p.content))<1e-12);
});
test("filters enforce category, price and synthetic availability",()=>{
 const out=recommend(lab,{category:"Audio",budget:3000,inStock:true});
 assert.ok(out.every(p=>p.price<=3000&&p.category==="Audio"&&p.available));
});
test("unrated products can be matched by metadata, independently of reviews",()=>{
 const anchors=lab.items.filter(p=>p.reviewCount===0);assert.ok(anchors.length>0);
 for(const x of anchors){
  assert.equal(x.rating,null);const recs=coldStartAlternatives(lab,x.id);
  assert.equal(recs.length,5);assert.ok(recs.every(p=>p.available&&p.id!==x.id));
 }
});
test("stable lists, no repeated IDs, and clipping",()=>{
 const r=recommend(lab,{persona:"wellness"});
 assert.equal(new Set(r.map(x=>x.id)).size,r.length);
 assert.equal(clamp(-2),0);assert.equal(clamp(5),1);
});

test("unrated cold-start products have zero synthetic co-interactions",()=>{
 for(let i=0;i<lab.items.length;i++)if(lab.items[i].reviewCount===0)assert.equal(lab.cf.counts[i],0);
});
