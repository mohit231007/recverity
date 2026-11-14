// RecVerity: all catalog and behavior data in this browser demo are synthetic.
// Pure, deterministic functions keep ranking logic independently testable.
export const CATEGORIES=["Audio","Computing","Home","Kitchen","Wellness","Mobile"];
const WORDS={
Audio:["Wireless Headphones","Portable Speaker","Studio Microphone","Hi-Fi Earbuds"],
Computing:["Mechanical Keyboard","USB-C Hub","Ergonomic Mouse","Laptop Stand"],
Home:["Desk Lamp","Storage Organizer","Air Purifier","Reading Light"],
Kitchen:["Coffee Grinder","Insulated Bottle","Digital Scale","Blender"],
Wellness:["Yoga Mat","Fitness Band","Massage Roller","Travel Pillow"],
Mobile:["Phone Stand","Charging Dock","Power Bank","Protective Case"]
};
const TAGS=["compact","premium","travel","durable","lightweight","daily","portable","comfort"];
export const clamp=x=>Math.max(0,Math.min(1,Number(x)||0));
function rng(seed){let x=seed>>>0;return ()=>((x=(Math.imul(1664525,x)+1013904223)>>>0)/4294967296);}
export function createCatalog(){
 const rand=rng(2307),out=[];
 CATEGORIES.forEach((category,ci)=>{
  for(let j=0;j<12;j++){
   const id="RV-"+String(ci*12+j+101).padStart(4,"0");
   const base=WORDS[category][j%4];
   const tags=[TAGS[(j+ci)%8],TAGS[(2*j+ci+3)%8],category.toLowerCase()];
   const price=299+Math.round((rand()*13900+ci*210+j*75)/50)*50;
   const discount=10+(j*7+ci*3)%51;
   out.push({id,name:base+" "+["Core","Plus","Studio"][Math.floor(j/4)]+" "+(j%4+1),
    category,price,listPrice:Math.round(price/(1-discount/100)),discount,
    available:(j+ci)%9!==0,reviewCount:(j+3*ci)%13===0?0:1+Math.floor(rand()*300),
    rating:(j+3*ci)%13===0?null:Number((3.4+rand()*1.5).toFixed(1)),
    tags,description:category+" "+base+" for "+tags.join(" ")+" use."});
  }
 });
 return out;
}
export function createInteractions(items,n=400){
 const random=rng(4729),users=[];
 for(let u=0;u<n;u++){
  const favorite=CATEGORIES[u%CATEGORIES.length];
  const secondary=CATEGORIES[(u+2)%CATEGORIES.length];
  const choices=items.filter(x=>(x.category===favorite||x.category===secondary)&&x.reviewCount>0);
  const history=new Set();
  for(let t=0;t<6+(u%3);t++){const pool=random()<.85?choices:items.filter(p=>p.reviewCount>0);history.add(pool[Math.floor(random()*pool.length)].id);}
  users.push({id:"fictional-"+(u+1),history:[...history]});
 }
 return users;
}
export const tokenize=s=>String(s||"").toLowerCase().match(/[a-z0-9]+/g)||[];
export function tfidfSimilarity(items){
 const docs=items.map(p=>tokenize(p.name+" "+p.description+" "+p.tags.join(" ")));
 const df=new Map();
 docs.forEach(doc=>new Set(doc).forEach(w=>df.set(w,(df.get(w)||0)+1)));
 const vectors=docs.map(doc=>{
  const c=new Map();doc.forEach(w=>c.set(w,(c.get(w)||0)+1));
  let sq=0;const v=new Map();
  for(const [w,n] of c){const value=(1+Math.log(n))*(Math.log((1+docs.length)/(1+df.get(w)))+1);v.set(w,value);sq+=value*value;}
  const norm=Math.sqrt(sq)||1;for(const [w,x] of v)v.set(w,x/norm);return v;
 });
 const similarity=(a,b)=>{
  let s=0;const va=vectors[a],vb=vectors[b];
  for(const [w,v] of va)s+=v*(vb.get(w)||0);
  const pa=items[a],pb=items[b];
  const price=Math.exp(-Math.abs(Math.log((pa.price+1)/(pb.price+1))));
  return clamp(.8*s+.14*Number(pa.category===pb.category)+.06*price);
 };
 return items.map((_,i)=>items.map((_,j)=>i===j?1:similarity(i,j)));
}
export function collaborativeSimilarity(items,users){
 const index=new Map(items.map((p,i)=>[p.id,i]));
 const counts=Array(items.length).fill(0),pairs=Array.from({length:items.length},()=>Array(items.length).fill(0));
 users.forEach(user=>{
  const ids=[...new Set(user.history)].map(x=>index.get(x)).filter(x=>x!==undefined);
  ids.forEach(i=>counts[i]++);
  ids.forEach(i=>ids.forEach(j=>{if(i!==j)pairs[i][j]++;}));
 });
 return {counts,matrix:pairs.map((r,i)=>r.map((n,j)=>i===j?(counts[i]>0?1:0):(n/Math.sqrt(counts[i]*counts[j]||1))))};
}
export function buildLab(){
 const items=createCatalog(),users=createInteractions(items),content=tfidfSimilarity(items),cf=collaborativeSimilarity(items,users);
 const byCategory=c=>users.find(u=>u.history.filter(id=>items.find(p=>p.id===id)?.category===c).length>=2)?.history||[];
 const personas={guest:{label:"New visitor · zero history",history:[]},
 audio:{label:"Audio enthusiast",history:byCategory("Audio")},
 computing:{label:"Desk setup shopper",history:byCategory("Computing")},
 kitchen:{label:"Home chef",history:byCategory("Kitchen")},
 wellness:{label:"Wellness shopper",history:byCategory("Wellness")}};
 return {items,users,content,cf,personas};
}
function meanScore(matrix,i,indices){return indices.length?indices.reduce((s,j)=>s+matrix[i][j],0)/indices.length:0;}
export function recommend(lab,{persona="audio",method="hybrid",weight=.6,diversity=.18,budget=Infinity,category="All",inStock=true,k=5}={}){
 const buyer=lab.personas[persona]||lab.personas.guest;
 const ids=new Map(lab.items.map((p,i)=>[p.id,i]));
 const seen=new Set(buyer.history);const hist=buyer.history.map(x=>ids.get(x)).filter(x=>x!==undefined);
 const maxPop=Math.max(...lab.cf.counts,1);
 const candidates=lab.items.flatMap((product,i)=>{
  if(seen.has(product.id)||inStock&&!product.available||product.price>budget||category!=="All"&&product.category!==category)return [];
  const content=meanScore(lab.content,i,hist),collaborative=meanScore(lab.cf.matrix,i,hist),popularity=lab.cf.counts[i]/maxPop;
  const effective=hist.length?method:"popularity";
  const score=effective==="content"?content:effective==="collaborative"?collaborative:effective==="popularity"?popularity:clamp(weight)*collaborative+(1-clamp(weight))*content;
  return [{...product,content,collaborative,popularity,score,method:effective}];
 });
 const out=[],penalty=clamp(diversity);
 while(out.length<k&&candidates.length){
  candidates.sort((a,b)=>{
   const adjusted=x=>x.score-penalty*(out.length?Math.max(...out.map(p=>lab.content[ids.get(p.id)][ids.get(x.id)])):0);
   return adjusted(b)-adjusted(a)||a.id.localeCompare(b.id);
  });
  out.push(candidates.shift());
 }
 return out;
}
export function coldStartAlternatives(lab,productId,k=5){
 const idx=lab.items.findIndex(x=>x.id===productId);if(idx<0)return [];
 return lab.items.map((p,i)=>({...p,similarity:lab.content[idx][i]}))
  .filter(p=>p.id!==productId&&p.available).sort((a,b)=>b.similarity-a.similarity||a.id.localeCompare(b.id)).slice(0,k);
}
export function explainScore(p,weight=.6){
 if(p.method==="popularity")return "No behavioral history: synthetic popularity fallback.";
 if(p.method==="content")return "Metadata similarity to items in this fictional history.";
 if(p.method==="collaborative")return "Item co-interaction cosine from simulated user histories.";
 const cf=clamp(weight)*p.collaborative,ct=(1-clamp(weight))*p.content;
 return "Hybrid: "+(cf>=ct?"co-interaction":"metadata")+" contributes more ("+Math.round(cf*1000)/10+" vs "+Math.round(ct*1000)/10+" score points).";
}
