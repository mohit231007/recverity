// RecVerity: source-bound, non-generative static research visualization.
// All displayed data originate from a checked-in aggregate-only JSON file.
const el=id=>document.getElementById(id);
const pct=n=>Number.isFinite(n)?(n*100).toFixed(2)+"%":"N/A";
const fmt=n=>Number.isFinite(n)?n.toFixed(4):"N/A";
const named={popularity:"Popularity baseline",content:"Content / genres",collaborative:"Item co-interaction",hybrid:"60/40 hybrid"};
function node(tag,cls,text){const x=document.createElement(tag);if(cls)x.className=cls;if(text!==undefined)x.textContent=text;return x;}
function stat(target,label,value,detail){
 const c=node("div","stat");c.append(node("small","",label),node("strong","",value),node("span","",detail));target.append(c);
}
function render(r){
 const stats=el("benchmark-stats");
 const total=r.split.train_events+r.split.validation_events+r.split.test_events;
 stat(stats,"ACTUAL RATING EVENTS",total.toLocaleString("en-IN"),"GroupLens MovieLens 100K");
 stat(stats,"FROZEN TRAIN EVENTS",r.split.train_events.toLocaleString("en-IN"),"80% chronological prefix");
 stat(stats,"VALIDATION USERS",String(r.validation.eligible_users),"Eligible held-out users");
 stat(stats,"TEST USERS",String(r.test.eligible_users),"Eligible held-out users");
 const modelContainer=el("benchmark-models");
 const models=Object.entries(r.test.models).sort((a,b)=>b[1]["hr@5"]-a[1]["hr@5"]);
 for(const [key,m] of models){
  const card=node("article","benchmark-model"),header=node("header");
  header.append(node("h3","",named[key]||key),node("span","value",pct(m["hr@5"])));
  card.append(header);
  const ci=m["hr@5_95pct_user_bootstrap"]||[];
  card.append(node("p","","Hit Rate@5 · 95% user-bootstrap interval "+ci.map(pct).join(" to ")));
  const bar=node("div","bar"),fill=node("i");fill.style.width=Math.min(100,Math.max(0,m["hr@5"]*100))+"%";
  bar.append(fill);card.append(bar);
  const grid=node("div","benchmark-meta");
  for(const [label,value] of [["NDCG@5",fmt(m["ndcg@5"])],["Recall@5",pct(m["recall@5"])],["Coverage@10",pct(m.catalog_coverage_at_10)]]){
   const c=node("div");c.append(node("small","",label),node("strong","",value));grid.append(c);
  }
  card.append(grid);modelContainer.append(card);
 }
 const hybrid=r.test.models.hybrid,pop=r.test.models.popularity;
 el("benchmark-cold").append(
  node("p","","No positive training history: "+hybrid.history_free_users+" of "+r.test.eligible_users+" eligible test users. All four approaches fall back to popularity for those users."),
  node("p","","Returning users with 3+ positive training events: "+(hybrid.subgroups.returning_3_plus?.users??0)+
    ". Their held-out HR@5 was "+pct(hybrid.subgroups.returning_3_plus?.["hr@5"])+" for hybrid versus "+
    pct(pop.subgroups.returning_3_plus?.["hr@5"])+" for popularity."),
  node("p","muted-text",String(r.test.cold_item_positive_events)+" positive test events referred to items absent from the training catalog and could not be ranked. These excluded events are separately counted, not silently treated as successes.")
 );
 const drift=el("benchmark-drift");
 drift.append(node("p","muted-text","Positive-rating share in held-out events: "+pct(r.drift.label_positive_rate_validation)+
  " (validation), "+pct(r.drift.label_positive_rate_test)+" (test)."));
 for(const [key,m] of Object.entries(r.drift.models)){
  const card=node("article","benchmark-drift-card");
  card.append(node("h3","",named[key]||key));
  const dl=node("dl");
  const changes=[
   ["Test minus validation HR@5",(m["hr@5_test_minus_validation"]>=0?"+":"")+pct(m["hr@5_test_minus_validation"])],
   ["95% delta bootstrap interval",m["hr@5_delta_95pct_independent_user_bootstrap"].map(pct).join(" to ")],
   ["Top-1 score KS D",fmt(m.top1_score_ks_d)],
   ["Top-1 score PSI",fmt(m.top1_score_psi)],
   ["Mean top-1 score change",fmt(m.top1_score_mean_delta)]
  ];
  for(const [label,value] of changes)dl.append(node("dt","",label),node("dd","",value));
  card.append(dl,node("p","interpretation",m["hr@5_ci_excludes_zero"]?
     "The bootstrap interval excludes zero; investigate before making operational decisions.":
     "The bootstrap interval includes zero; performance drift not established."));
  drift.append(card);
 }
 el("benchmark-checksum").textContent="Ratings SHA-256: "+r.ratings_sha256+
  "\nMetadata SHA-256: "+r.items_sha256+"\nProtocol v"+r.benchmark_version+" · seed "+r.settings.seed+
  " · 300 user-bootstrap replicates";
 el("benchmark-body").hidden=false;
}
async function main(){
 try{
  const response=await fetch("./data/movielens-100k-v1.json",{cache:"no-cache"});
  if(!response.ok)throw new Error("File unavailable (HTTP "+response.status+")");
  const r=await response.json();
  if(!r||r.benchmark_version!=="1.0.0"||
    r.split.train_events+r.split.validation_events+r.split.test_events!==100000||
    r.test.eligible_users<1)throw new Error("Invalid aggregate evidence schema");
  render(r);
 }catch(e){el("benchmark-error").hidden=false;el("benchmark-error").textContent="Could not verify benchmark evidence: "+e.message;}
}
el("menu").addEventListener("click",()=>{
 const n=el("mobile-links");n.hidden=!n.hidden;el("menu").setAttribute("aria-expanded",String(!n.hidden));
});
document.querySelectorAll("#mobile-links a").forEach(a=>a.addEventListener("click",()=>{
 el("mobile-links").hidden=true;el("menu").setAttribute("aria-expanded","false");
}));
main();
