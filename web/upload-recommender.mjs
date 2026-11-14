// On-device recommender for user-provided CSV. Full candidate scoring avoids a dense N×N matrix.
// This is an exploratory sandbox, not deployment-grade training, and does not call external APIs.
const tokenize=s=>String(s||"").toLowerCase().match(/[a-z0-9]+/g)?.slice(0,120)||[];
const clamp=x=>Math.max(0,Math.min(1,Number(x)||0));
export function buildUploadedLab(catalog,events=[]){
 if(!Array.isArray(catalog)||!catalog.length||catalog.length>10000)throw new Error("Catalog must contain 1–10,000 products.");
 if(!Array.isArray(events)||events.length>10000)throw new Error("Interactions cannot exceed 10,000 records.");
 const byId=new Map(),itemUsers=new Map(),userEvents=new Map(),userSeen=new Map(),uniquePairs=new Set();
 for(const item of catalog){
  if(!item.id||byId.has(item.id)||!Number.isFinite(item.price)||item.price<=0)
   throw new Error("Fix duplicate/missing product IDs and invalid prices before ranking.");
  byId.set(item.id,item);itemUsers.set(item.id,new Set());
 }
 let orphans=0,duplicatePairs=0,invalidRatings=0;
 for(const e of events){
  if(!e.userId||!e.itemId)throw new Error("Interactions have missing user/product IDs.");
  if(e.rating!==null&&e.rating!==undefined&&(!Number.isFinite(e.rating)||e.rating<0||e.rating>5))invalidRatings++;
  if(!byId.has(e.itemId)){orphans++;continue;}
  const key=JSON.stringify([e.userId,e.itemId]);
  if(uniquePairs.has(key)){duplicatePairs++;continue;}
  uniquePairs.add(key);
  if(!userSeen.has(e.userId))userSeen.set(e.userId,new Set());
  userSeen.get(e.userId).add(e.itemId);
  const positive=e.rating===null||e.rating===undefined||e.rating>=4;
  if(positive){
   itemUsers.get(e.itemId).add(e.userId);
   if(!userEvents.has(e.userId))userEvents.set(e.userId,[]);
   userEvents.get(e.userId).push({id:e.itemId,t:e.timestamp??0});
  }
 }
 if(invalidRatings||duplicatePairs)throw new Error("Fix "+invalidRatings+" invalid user ratings and "+duplicatePairs+" repeated user-item pairs before ranking.");
 const df=new Map(),tokens=new Map();
 for(const item of catalog){
  const words=tokenize([item.name,item.category,item.description].join(" "));
  tokens.set(item.id,words);
  for(const w of new Set(words))df.set(w,(df.get(w)||0)+1);
 }
 const vectors=new Map();
 for(const item of catalog){
  const count=new Map();for(const w of tokens.get(item.id))count.set(w,(count.get(w)||0)+1);
  let sum=0;const vec=new Map();
  for(const [w,n] of count){
   const v=(1+Math.log(n))*(1+Math.log((1+catalog.length)/(1+df.get(w))));
   vec.set(w,v);sum+=v*v;
  }
  const norm=Math.sqrt(sum)||1;for(const [w,v] of vec)vec.set(w,v/norm);
  vectors.set(item.id,vec);
 }
 const maxPop=Math.max(1,...[...itemUsers.values()].map(s=>s.size));
 return {items:catalog,byId,userEvents,userSeen,itemUsers,vectors,maxPop,
  warnings:orphans?[orphans+" interaction rows refer to product IDs absent from the catalog; skipped."]:[]};
}
function simContent(lab,one,two){
 if(!one||!two)return 0;const a=lab.byId.get(one),b=lab.byId.get(two);
 if(!a||!b)return 0;const va=lab.vectors.get(one),vb=lab.vectors.get(two);
 let dot=0;for(const [w,v] of va)dot+=v*(vb.get(w)||0);
 const price=Math.exp(-Math.abs(Math.log((a.price+1)/(b.price+1))));
 return clamp(.8*dot+.14*Number(a.category===b.category)+.06*price);
}
export function recommendUploaded(lab,{userId="",anchorId="",method="hybrid",weight=.6,k=5,budget=Infinity,category="All"}={}){
 if(!["hybrid","content","collaborative","popularity"].includes(method))throw new Error("Unknown recommendation algorithm.");
 if(!Number.isInteger(k)||k<1||k>20)throw new Error("Top K must be 1–20.");
 const history=(lab.userEvents.get(userId)||[]).sort((a,b)=>b.t-a.t).slice(0,20).map(x=>x.id);
 const seen=new Set(lab.userSeen.get(userId)||[]);
 const anchor=lab.byId.has(anchorId)?anchorId:null;
 if(!history.length&&anchor)seen.add(anchor);
 const contentAnchors=history.length?history:anchor?[anchor]:[];
 const cooccurrence=new Map();
 if(history.length){
  for(const source of history){
   const neighbors=[...lab.itemUsers.get(source)].slice(0,200);
   for(const user of neighbors){
    for(const related of (lab.userEvents.get(user)||[]).slice(0,200)){
     if(related.id===source)continue;
     const key=source+"|"+related.id;cooccurrence.set(key,(cooccurrence.get(key)||0)+1);
    }
   }
  }
 }
 const data=[];
 for(const item of lab.items){
  if(seen.has(item.id)||item.available===false||item.price>budget||
    category!=="All"&&item.category!==category)continue;
  const popularity=lab.itemUsers.get(item.id).size/lab.maxPop;
  let content=0,collaborative=0;
  for(const past of contentAnchors)content=Math.max(content,simContent(lab,item.id,past));
  if(history.length){
   for(const past of history){
    const n=cooccurrence.get(past+"|"+item.id)||0;
    const denom=Math.sqrt(lab.itemUsers.get(past).size*lab.itemUsers.get(item.id).size)||1;
    collaborative=Math.max(collaborative,n/denom);
   }
  }
  let effective=method,score;
  if(!history.length&&anchor)effective="content";
  else if(!history.length)effective="popularity";
  if(effective==="popularity")score=popularity;
  else if(effective==="content")score=content;
  else if(effective==="collaborative")score=collaborative;
  else score=clamp(weight)*collaborative+(1-clamp(weight))*content;
  const reason=effective==="content"?"Metadata and price similarity":effective==="popularity"?"No profile: observed interactions popularity":
    effective==="collaborative"?"Shared shopper co-interactions":"Fused content + co-interaction score";
  data.push({...item,content,collaborative,popularity,score:clamp(score),method:effective,reason});
 }
 data.sort((a,b)=>b.score-a.score||b.popularity-a.popularity||a.id.localeCompare(b.id));
 return {recommendations:data.slice(0,k),context:{
  historyCount:history.length,anchorUsed:!history.length&&Boolean(anchor),
  eligibleCandidates:data.length,orphanWarnings:lab.warnings,
  limits:"Max 20 recent positive history items, max 200 co-shopper neighbors/item; heuristic ranking, not model evaluation."
 }};
}
