// A free, browser-local LSA + lexical document retriever, NOT a generative LLM.
// Every answer comes from authored project text and is accompanied by a source URL.
export const KNOWLEDGE=[
 {id:"leakage",title:"Why did 81.67% become 3.48%?",text:"The naive holdout allowed the same review event to appear in training under another product SKU. Review-event leakage affected 749 of 911 held-out users. The stricter review-event split evaluated 201 eligible users, with 3.48% Hit Rate at five for content and hybrid. The numbers are not conversion rates.",url:"https://github.com/mohit231007/recverity/blob/main/docs/MODEL_CARD.md"},
 {id:"ratings",title:"What is known about the Scaler ratings?",text:"The educational Amazon snapshot contains product-level average ratings and comma-separated sampled user IDs. It does not contain each user's own star rating, purchases, impressions or timestamps. Never turn an aggregate product rating into an individual user's preference.",url:"https://github.com/mohit231007/recverity/blob/main/docs/MODEL_CARD.md"},
 {id:"drift",title:"What do drift indicators mean?",text:"Population Stability Index for price and Jensen-Shannon distance for categories and availability compare reference and current data distributions. A Kolmogorov Smirnov D statistic gives an additional nonparametric price shift diagnostic. Alerts use heuristic thresholds, not p-values. Changes require investigation, not automatic retraining.",url:"https://github.com/mohit231007/recverity/blob/main/docs/QUALITY_GATES.md"},
 {id:"privacy",title:"Does local assistant send conversations to a server?",text:"No. The RecVerity research assistant runs entirely inside the browser using a small embedded document index and deterministic retrieval. It stores no conversation and sends no message to an LLM service. This is retrieval and templated explanations, not generative chat.",url:"https://github.com/mohit231007/recverity/blob/main/docs/LOCAL_ASSISTANT.md"},
 {id:"cold",title:"What about new users and new products?",text:"A new visitor with zero interactions gets a synthetic popularity fallback, not personalized collaborative filtering. New products without review events can still be discovered from descriptions, categories and prices using content similarity. Catalog coverage and constraints remain important.",url:"https://github.com/mohit231007/recverity/blob/main/docs/MODEL_CARD.md"},
 {id:"hybrid",title:"How does the hybrid ranker work?",text:"Default scoring combines 60 percent item co-interaction cosine and 40 percent content similarity. Scores are not calibrated purchase probabilities. A greedy diversity penalty, eligibility, inventory and price filters can change the final ranking. A 60/40 blend is a teaching parameter, not a proven optimal mix.",url:"https://github.com/mohit231007/recverity/blob/main/docs/ARCHITECTURE.md"},
 {id:"evaluation",title:"Which evaluation metrics matter?",text:"Evaluate Hit Rate, Recall and NDCG at K, catalog coverage, subgroup cold-start performance, diversity and runtime. For per-user confidence intervals, bootstrap users rather than individual interactions. Offline relevance does not establish online clicks, conversions or revenue uplift.",url:"https://github.com/mohit231007/recverity/blob/main/docs/BENCHMARK_PROTOCOL.md"},
 {id:"time",title:"Why require chronological splits?",text:"A global chronological train validation test split prevents later events from informing earlier predictions. Feature fit and popularity counts must only use training events. Duplicate event identifiers and repeated user item pairs should never straddle train and test. Item availability at prediction time must be respected.",url:"https://github.com/mohit231007/recverity/blob/main/docs/BENCHMARK_PROTOCOL.md"},
 {id:"data",title:"What authentic benchmark is supported?",text:"MovieLens 100K is a separate research benchmark with per-user star ratings and timestamps. It is a film-recommendation proxy, not proof of e-commerce accuracy. GroupLens permits research use subject to restrictions and forbids data redistribution without permission. Users fetch it themselves.",url:"https://github.com/mohit231007/recverity/blob/main/docs/BENCHMARK_PROTOCOL.md"},
 {id:"monitor",title:"What needs monitoring in production?",text:"Monitor schema validity, missing and anomalous prices, category mix, inventory status, candidate coverage, model score distribution, exposure diversity, latency, and delayed labeled outcomes. Drift alone is not concept drift or model performance decay. Human review is needed before any rollback or retraining decision.",url:"https://github.com/mohit231007/recverity/blob/main/docs/QUALITY_GATES.md"}
];
const CANON={
 leak:["leak","contamination","overlap","inflated","81","3.48","duplicate","review reuse"],
 drift:["drift","shift","distribution","psi","jensen","monitor","skew","stock"],
 ratings:["star","rating","aggregate","reviewer","label"],
 privacy:["private","offline","local","api","sent","upload","conversation"],
 cold:["guest","cold","zero","new","unseen"],
 hybrid:["hybrid","blend","fusion","weight","ranking"],
 evaluation:["accuracy","metric","ndcg","recall","confidence","coverage","precision","hit"],
 time:["chronological","future","timestamp","train","test","temporal","validation"],
 data:["movielens","license","source","download","authentic","real"],
 monitor:["quality","production","deployment","latency","availability","alerts"]
};
export const words=s=>(String(s).toLowerCase().match(/[a-z0-9]+/g)||[]).filter(w=>w.length>1&&!["the","and","what","does","with","for","why","how","are","this","that","can","there","from","have","would","which","our"].includes(w));
function expand(text){
 const w=words(text),extra=[];
 for(const [id,terms] of Object.entries(CANON))if(terms.some(t=>w.includes(t)||String(text).toLowerCase().includes(t)))extra.push(id,...terms);
 return [...w,...extra.map(x=>x.toLowerCase())];
}
export function createIndex(documents=KNOWLEDGE){
 const docs=documents.map(d=>expand(d.title+" "+d.text+" "+d.id)),df=new Map();
 docs.forEach(a=>new Set(a).forEach(w=>df.set(w,(df.get(w)||0)+1)));
 const vocabulary=[...df.keys()].sort(),idf=vocabulary.map(w=>Math.log((1+docs.length)/(1+df.get(w)))+1);
 const vector=a=>{const freq=new Map();a.forEach(w=>freq.set(w,(freq.get(w)||0)+1));
  const z=vocabulary.map((w,i)=>(freq.get(w)||0)*idf[i]);const n=Math.hypot(...z)||1;return z.map(x=>x/n);};
 const tf=docs.map(vector),k=Math.min(5,documents.length),vectors=[],eigenvalues=[];
 // Gram eigenvectors produce a low-rank latent semantic document space.
 const gram=tf.map(a=>tf.map(b=>a.reduce((s,x,i)=>s+x*b[i],0)));
 const project=x=>gram.map(row=>row.reduce((s,v,i)=>s+v*x[i],0));
 for(let j=0;j<k;j++){
  let v=Array.from({length:docs.length},(_,i)=>Math.sin((i+1)*(j+2))+.3);let lam=0;
  for(let iteration=0;iteration<90;iteration++){
   let n=project(v);
   for(const e of vectors){const dot=n.reduce((s,x,i)=>s+x*e[i],0);n=n.map((x,i)=>x-dot*e[i]);}
   const len=Math.hypot(...n);if(len<1e-10)break;v=n.map(x=>x/len);
  }
  const gv=project(v);lam=Math.max(0,v.reduce((s,x,i)=>s+x*gv[i],0));if(lam<1e-9)break;
  vectors.push(v);eigenvalues.push(lam);
 }
 return {documents,vocabulary,df,tf,vector,vectors,eigenvalues};
}
const cosine=(a,b)=>{let x=0,u=0,v=0;for(let i=0;i<a.length;i++){x+=a[i]*b[i];u+=a[i]**2;v+=b[i]**2;}return u&&v?x/Math.sqrt(u*v):0;};
export function retrieve(query,index=createIndex(),k=3){
 if(words(query).length===0)return [];
 const q=index.vector(expand(query));
 // Project the query onto the document LSA latent space, blended with lexical matches.
 const dot=index.tf.map(v=>v.reduce((s,x,i)=>s+x*q[i],0));
 const latent=index.vectors.map((e,i)=>dot.reduce((s,x,j)=>s+x*e[j],0)/Math.sqrt(index.eigenvalues[i]));
 return index.documents.map((d,i)=>{
  const emb=index.vectors.map((e,j)=>e[i]*Math.sqrt(index.eigenvalues[j]));
  const score=.72*dot[i]+.28*Math.max(0,cosine(latent,emb));
  return {...d,score};
 }).sort((a,b)=>b.score-a.score).slice(0,k);
}
export function answer(query,index=createIndex()){
 const results=retrieve(query,index);
 if(!results.length||results[0].score<.12)return {found:false,text:"I cannot ground that answer in the available RecVerity documents. Try asking about leakage, drift, recommendations, evaluation, privacy, or the MovieLens benchmark.",sources:[]};
 const chosen=results[0];
 return {found:true,text:chosen.text,sources:[{title:chosen.title,url:chosen.url,id:chosen.id}],match:chosen.score,
  disclosure:"Retrieved answer from local project notes. Similarity is not a confidence probability; no generative model or network call is involved."};
}
