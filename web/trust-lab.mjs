import {createCatalog} from "./engine.mjs";
import {monitorCatalog,simulateCurrent,demoEventSplit,auditEventSplit} from "./quality.mjs";
import {createIndex,answer} from "./semantic.mjs";
import {parseCSV,readCsvFile,normalizeCatalog,normalizeInteractions,DEMO_CATALOG_CSV,DEMO_TRAIN_CSV,DEMO_TEST_CSV} from "./csv-lab.mjs";
const el=id=>document.getElementById(id);
const docs=createIndex(),baseline=createCatalog();
const fmt=x=>x===null||!Number.isFinite(x)?"Unavailable":x.toFixed(3);
function item(text,classes=""){
 const div=document.createElement("div");div.className=classes;div.textContent=text;return div;
}
function checkCards(target,checks){
 target.replaceChildren();
 for(const c of checks){
  const box=document.createElement("div");box.className="qa-check "+(c.alert?"alert":"pass");
  const name=item(c.feature+" · "+c.metric,"qa-check-label");
  const value=item(fmt(c.value),"qa-check-value");value.style.fontWeight="850";value.style.fontSize="20px";
  const status=item(c.alert?"Investigate":"Within rule","qa-check-state");
  status.style.fontWeight="750";status.style.color=c.alert?"#a74831":"#277a64";
  box.append(name,value,status);target.append(box);
 }
}
function renderDrift(){
 const ref=baseline,cur=simulateCurrent(baseline,el("scenario").value),threshold=Number(el("threshold").value);
 el("threshold-value").textContent=threshold.toFixed(2);
 const d=monitorCatalog(ref,cur,threshold);
 el("drift-summary").textContent=d.anyAlert?"Diagnostic alert(s) triggered; inspect features below.":"No configured alerts in this synthetic comparison.";
 checkCards(el("drift-checks"),d.checks);
 el("drift-detail").textContent="Price KS D: "+fmt(d.priceKs)+" · Reference: "+d.baseline.count+
 " items · Current: "+d.quality.count+" items · Missing prices: "+d.quality.missingPrice+
 ". Thresholds are demonstration heuristics, not statistical significance levels.";
}
function renderLeak(){
 const a=demoEventSplit(el("leak-scenario").value);
 const checks=[
 {feature:"Review event overlap",metric:"shared event IDs",value:a.eventOverlap,alert:a.eventOverlap>0},
 {feature:"User–item overlap",metric:"duplicate pairs",value:a.userItemOverlap,alert:a.userItemOverlap>0},
 {feature:"Chronological inversion",metric:"train at/after test",value:Number(a.temporalInversion),alert:a.temporalInversion},
 {feature:"Overall split",metric:"violation flag",value:Number(a.leakage),alert:a.leakage}
 ];checkCards(el("leak-results"),checks);
}
function clearTo(target){target.classList.remove("error");target.replaceChildren();}
function appendLine(target,text){target.append(item(text));}
function appendWarnings(target,warnings){if(!warnings.length){appendLine(target,"No schema anomalies detected by the selected checks.");return;}
 const list=document.createElement("ul");for(const w of warnings){const li=document.createElement("li");li.textContent=w;list.append(li);}target.append(list);
}
async function catalogReport(example=false){
 const target=el("catalog-report");clearTo(target);
 try{
  const refParsed=example?parseCSV(DEMO_CATALOG_CSV):await readCsvFile(el("catalog-ref").files[0]);
  const r=normalizeCatalog(refParsed);
  appendLine(target,"REFERENCE · "+r.rows+" rows · "+r.invalidRows+" invalid rows · "+r.duplicates+" duplicate product IDs");
  appendWarnings(target,r.warnings);
  const file=el("catalog-cur").files[0];
  if(file&&!example){
   const c=normalizeCatalog(await readCsvFile(file));
   appendLine(target,"CURRENT · "+c.rows+" rows · "+c.invalidRows+" invalid rows · "+c.duplicates+" duplicate IDs");
   appendWarnings(target,c.warnings);
   if(r.invalidRows||c.invalidRows||r.duplicates||c.duplicates){
    appendLine(target,"Drift comparison blocked: fix invalid IDs, prices and duplicates first.");return;
   }
   const hasAvail=refParsed.headers.some(x=>["available","in_stock"].includes(x));
   const curParsed=await readCsvFile(file), hasAvailCurrent=curParsed.headers.some(x=>["available","in_stock"].includes(x));
   // Compare only shared columns: do not present unknown inventory as a real availability shift.
   const result=monitorCatalog(r.items,c.items,Number(el("threshold").value));
   const checks=result.checks.filter(x=>(x.feature!=="Availability mix"||(hasAvail&&hasAvailCurrent)));
   appendLine(target,"DRIFT · "+checks.filter(x=>x.alert).length+" distribution alerts. Price PSI: "+fmt(result.checks[0].value)+
     "; price KS D: "+fmt(result.priceKs)+"; category JS: "+fmt(result.checks[1].value)+
     (hasAvail&&hasAvailCurrent?"; availability JS: "+fmt(result.checks[2].value):"; availability comparison omitted (column absent)"));
   appendLine(target,"Interpretation: this is an unsupervised input comparison, not an assessment of recommender accuracy.");
  }else appendLine(target,example?"Example loaded locally. Upload a reference AND current catalog to compute meaningful drift.":"Upload a current catalog to compare against your reference.");
 }catch(err){target.classList.add("error");appendLine(target,err.message);}
}
async function eventsReport(example=false){
 const target=el("events-report");clearTo(target);
 try{
  const trainParsed=example?parseCSV(DEMO_TRAIN_CSV):await readCsvFile(el("events-train").files[0]);
  const t=normalizeInteractions(trainParsed);
  appendLine(target,"TRAIN · "+t.rows+" rows · "+t.invalidRows+" invalid user/item IDs");
  appendWarnings(target,t.warnings);
  const testFile=el("events-test").files[0];
  if(testFile||example){
   const testParsed=example?parseCSV(DEMO_TEST_CSV):await readCsvFile(testFile);
   const s=normalizeInteractions(testParsed);
   appendLine(target,"TEST · "+s.rows+" rows · "+s.invalidRows+" invalid user/item IDs");
   appendWarnings(target,s.warnings);
   if(t.invalidRows||s.invalidRows){appendLine(target,"Split audit blocked: fix missing user/item IDs first.");return;}
   const a=auditEventSplit(t.events,s.events);
   const sameEventSchema=trainParsed.headers.some(x=>["event_id","review_id"].includes(x))&&testParsed.headers.some(x=>["event_id","review_id"].includes(x));
   const sameTimeSchema=trainParsed.headers.some(x=>["timestamp","event_time","created_at"].includes(x))&&testParsed.headers.some(x=>["timestamp","event_time","created_at"].includes(x));
   appendLine(target,"AUDIT · Shared event IDs: "+(sameEventSchema?a.eventOverlap:"not measurable")+
    " · Shared user–item pairs: "+a.userItemOverlap+
    " · Global temporal inversion: "+(sameTimeSchema&&a.chronologicalKnown?(a.temporalInversion?"YES":"NO"):"not measurable")+".");
   appendLine(target,(a.leakage?"Leakage risk detected.":"No detected overlap in available keys.")+
   " An absent review ID does not prove event-level independence. Checks use identifiers within the provided files only.");
  }else appendLine(target,"Upload a test interactions CSV to inspect train/test leakage.");
 }catch(err){target.classList.add("error");appendLine(target,err.message);}
}
function renderAnswer(query){
 const target=el("answer");target.replaceChildren();const r=answer(query,docs);
 const body=document.createElement("blockquote");body.textContent=r.text;target.append(body);
 if(r.sources.length){
  const s=r.sources[0],p=document.createElement("p"),a=document.createElement("a");
  a.href=s.url;a.target="_blank";a.rel="noopener noreferrer";a.textContent="Project source: "+s.title;
  p.append(a);target.append(p);
 }
 const caveat=document.createElement("small");caveat.textContent=r.disclosure||"No grounded match; no generative model or remote inference used.";
 target.append(caveat);
}
el("scenario").addEventListener("change",renderDrift);
el("threshold").addEventListener("input",renderDrift);
el("leak-scenario").addEventListener("change",renderLeak);
el("catalog-run").addEventListener("click",()=>catalogReport());
el("catalog-example").addEventListener("click",()=>catalogReport(true));
el("events-run").addEventListener("click",()=>eventsReport());
el("events-example").addEventListener("click",()=>eventsReport(true));
el("ask-form").addEventListener("submit",e=>{e.preventDefault();renderAnswer(el("question").value);});
el("ask-sample").addEventListener("click",()=>{el("question").value="How does RecVerity detect data drift?";renderAnswer(el("question").value);});
el("menu").addEventListener("click",()=>{const n=el("mobile-links");n.hidden=!n.hidden;el("menu").setAttribute("aria-expanded",String(!n.hidden));});
document.querySelectorAll("#mobile-links a").forEach(a=>a.addEventListener("click",()=>{el("mobile-links").hidden=true;el("menu").setAttribute("aria-expanded","false");}));
renderDrift();renderLeak();
