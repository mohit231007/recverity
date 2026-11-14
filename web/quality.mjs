// RecVerity quality observability: pure functions, synthetic data only.
// PSI / JS / KS are descriptive diagnostics, NOT probabilities or automatically calibrated alarms.
const isFinitePrice=x=>typeof x==="number"&&Number.isFinite(x)&&x>0;
const rate=(n,d)=>d?n/d:0;
function quantile(sorted,p){if(!sorted.length)return NaN;const n=(sorted.length-1)*p,i=Math.floor(n),f=n-i;return sorted[i]+f*(sorted[Math.min(i+1,sorted.length-1)]-sorted[i]);}
const cdf=(values,x)=>{let count=0;for(const y of values)if(y<=x)count++;return rate(count,values.length)};
export function ksStatistic(reference,current){
 const a=reference.filter(Number.isFinite).sort((x,y)=>x-y),b=current.filter(Number.isFinite).sort((x,y)=>x-y);
 if(!a.length||!b.length)return null;
 // Both samples are empirical CDFs, including ties.
 const combined=[...new Set([...a,...b])];let max=0;
 for(const x of combined)max=Math.max(max,Math.abs(cdf(a,x)-cdf(b,x)));
 return max;
}
export function psi(reference,current,bins=6){
 const a=reference.filter(Number.isFinite).sort((x,y)=>x-y),b=current.filter(Number.isFinite);
 if(a.length<bins||!b.length)return null;
 const edges=[...new Set(Array.from({length:bins-1},(_,i)=>quantile(a,(i+1)/bins)))];
 // At most bins groups; duplicate quantiles are intentionally combined.
 const group=x=>edges.findIndex(e=>x<=e)===-1?edges.length:edges.findIndex(e=>x<=e);
 const n=edges.length+1,ac=Array(n).fill(0),bc=Array(n).fill(0);
 a.forEach(x=>ac[group(x)]++);b.forEach(x=>bc[group(x)]++);
 const smooth=1e-6;
 let score=0;for(let i=0;i<n;i++){const p=Math.max(smooth,ac[i]/a.length),q=Math.max(smooth,bc[i]/b.length);score+=(q-p)*Math.log(q/p);}
 return score;
}
export function jsDistance(reference,current,selector=x=>x){
 if(!reference.length||!current.length)return null;
 const counts=x=>x.reduce((a,z)=>{const key=String(selector(z));a.set(key,(a.get(key)||0)+1);return a;},new Map());
 const a=counts(reference),b=counts(current),keys=new Set([...a.keys(),...b.keys()]);
 let divergence=0;
 for(const k of keys){
  const p=(a.get(k)||0)/reference.length,q=(b.get(k)||0)/current.length,m=(p+q)/2;
  if(p)divergence+=.5*p*Math.log2(p/m);
  if(q)divergence+=.5*q*Math.log2(q/m);
 }
 return Math.sqrt(Math.max(0,divergence)); // Jensen-Shannon distance in [0,1].
}
export function validateCatalog(items){
 let missingPrice=0,invalidPrice=0,duplicateId=0,missingCategory=0,missingRating=0;
 const ids=new Set();
 for(const p of items){
  if(p.price==null)missingPrice++;
  else if(!isFinitePrice(p.price))invalidPrice++;
  if(!p.id||ids.has(p.id))duplicateId++;
  ids.add(p.id);
  if(!p.category)missingCategory++;
  if(p.rating==null)missingRating++;
 }
 return {count:items.length,missingPrice,invalidPrice,duplicateId,missingCategory,missingRating};
}
export function simulateCurrent(reference,scenario="stable"){
 // Deterministic counterfactual changes: SAME fictional baseline, not a sampled production window.
 return reference.map((p,i)=>{
  const x={...p};
  if(scenario==="price-shock")x.price=Math.round(p.price*(i%5===0?1.4:2.2));
  if(scenario==="catalog-shift"&&i%3!==0)x.category="Mobile";
  if(scenario==="inventory-incident"&&i%4!==0)x.available=false;
  if(scenario==="schema-incident"&&i%3===0){x.price=null;x.rating=null;}
  return x;
 });
}
export function monitorCatalog(reference,current,threshold=.2){
 if(!reference.length||!current.length)throw new Error("Both reference and current datasets are required.");
 const prices=x=>x.filter(p=>isFinitePrice(p.price)).map(p=>p.price);
 const pricePsi=psi(prices(reference),prices(current));
 const priceKs=ksStatistic(prices(reference),prices(current));
 const catJs=jsDistance(reference,current,x=>x.category??"MISSING");
 const stockJs=jsDistance(reference,current,x=>x.available===true?"available":"unavailable");
 const quality=validateCatalog(current),baseline=validateCatalog(reference);
 const missingIncrease=rate(quality.missingPrice,current.length)-rate(baseline.missingPrice,reference.length);
 const checks=[
  {feature:"Price distribution",metric:"PSI",value:pricePsi,threshold,alert:pricePsi!==null&&pricePsi>=threshold},
  {feature:"Category mix",metric:"JS distance",value:catJs,threshold,alert:catJs!==null&&catJs>=threshold},
  {feature:"Availability mix",metric:"JS distance",value:stockJs,threshold,alert:stockJs!==null&&stockJs>=threshold},
  {feature:"Price completeness",metric:"Missing share delta",value:missingIncrease,threshold:.05,alert:missingIncrease>=.05}
 ];
 return {checks,priceKs,quality,baseline,anyAlert:checks.some(x=>x.alert)||quality.invalidPrice>0||quality.duplicateId>0,
  caveat:"Synthetic scenario comparison only; thresholds are configurable heuristics, not calibrated significance tests."};
}
export function auditEventSplit(train,test){
 const ids=new Set(train.map(x=>x.eventId).filter(Boolean)),pairs=new Set(train.map(x=>x.userId+"|"+x.itemId));
 const duplicates=test.filter(x=>x.eventId&&ids.has(x.eventId)),samePairs=test.filter(x=>pairs.has(x.userId+"|"+x.itemId));
 const laterTrain=train.filter(x=>Number.isFinite(x.timestamp)),earlyTest=test.filter(x=>Number.isFinite(x.timestamp));
 const maxTrain=laterTrain.length?Math.max(...laterTrain.map(x=>x.timestamp)):null;
 const minTest=earlyTest.length?Math.min(...earlyTest.map(x=>x.timestamp)):null;
 return {trainEvents:train.length,testEvents:test.length,eventOverlap:duplicates.length,userItemOverlap:samePairs.length,
  temporalInversion:maxTrain!==null&&minTest!==null&&maxTrain>=minTest,
  chronologicalKnown:maxTrain!==null&&minTest!==null,leakage:duplicates.length>0||samePairs.length>0||
  (maxTrain!==null&&minTest!==null&&maxTrain>=minTest)};
}
export function demoEventSplit(mode="clean"){
 const train=[{eventId:"evt-1",userId:"u-1",itemId:"a",timestamp:10},{eventId:"evt-2",userId:"u-2",itemId:"b",timestamp:12},
 {eventId:"evt-3",userId:"u-3",itemId:"c",timestamp:14}];
 const test=[{eventId:"evt-4",userId:"u-4",itemId:"d",timestamp:16},{eventId:"evt-5",userId:"u-1",itemId:"e",timestamp:18}];
 if(mode==="review-reuse")test[0]={eventId:"evt-2",userId:"u-2",itemId:"z",timestamp:16};
 if(mode==="pair-overlap")test[0]={eventId:"evt-4",userId:"u-1",itemId:"a",timestamp:16};
 if(mode==="time-inversion")test[0]={eventId:"evt-4",userId:"u-4",itemId:"d",timestamp:11};
 return auditEventSplit(train,test);
}
