import {buildLab,recommend,coldStartAlternatives,CATEGORIES,explainScore} from "./engine.mjs";
const lab=buildLab();
const byId=x=>document.getElementById(x),esc=x=>String(x??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const price=x=>"₹"+Number(x).toLocaleString("en-IN");
let shown=[];
const names={overview:"Overview",lab:"Recommendation lab",cold:"Cold-start discovery",audit:"Evaluation audit",engineering:"Engineering"};
function setPage(){
 const hash=location.hash.slice(1);const current=Object.hasOwn(names,hash)?hash:"overview";
 document.querySelectorAll("[data-panel]").forEach(p=>p.hidden=p.id!==current);
 document.querySelectorAll("[data-tab]").forEach(a=>a.classList.toggle("active",a.dataset.tab===current));
 byId("breadcrumb").textContent=names[current].toUpperCase();
 document.title=names[current]+" · RecVerity";
 byId("mobile-links").hidden=true;byId("menu").setAttribute("aria-expanded","false");
 if(current==="lab")renderRanking();if(current==="cold")renderCold();
 window.scrollTo(0,0);
}
function productCard(p,i,subtitle){
 const rating=p.rating==null?"No ratings":p.rating.toFixed(1)+" ★";
 return '<article class="product"><div class="product-art art-'+esc(p.category.toLowerCase())+'"><div class="art-symbol">'+esc(p.category[0])+'</div><span>'+esc(p.category)+'</span></div><div class="product-info"><small>#'+(i+1)+' · '+esc(subtitle)+'</small><h3>'+esc(p.name)+'</h3><div class="money">'+price(p.price)+' <del>'+price(p.listPrice)+'</del></div><p>'+esc(p.reason||"Metadata-based candidate")+'</p><div class="score"><i style="width:'+Math.round(100*Math.max(0,Math.min(1,p.score||p.similarity||0)))+'%"></i></div><div class="product-foot"><span>'+p.discount+'% off · '+rating+'</span><span>'+(p.available?"● Available":"○ Unavailable")+'</span></div></div></article>';
}
function rankArgs(){return {persona:byId("persona").value,method:byId("method").value,weight:Number(byId("weight").value)/100,diversity:Number(byId("diversity").value)/100,budget:Number(byId("budget").value),category:byId("category").value,inStock:byId("in-stock").checked,k:5};}
function renderRanking(){
 const cfg=rankArgs();byId("weight-value").textContent=Math.round(cfg.weight*100)+"% CF / "+Math.round((1-cfg.weight)*100)+"% content";
 byId("diversity-value").textContent=Math.round(cfg.diversity*100)+"%";
 shown=recommend(lab,cfg).map(p=>({...p,reason:explainScore(p,cfg.weight)}));
 byId("result-context").textContent=lab.personas[cfg.persona].label+" · "+shown.length+" eligible products";
 byId("results").innerHTML=shown.length?shown.map((p,i)=>productCard(p,i,p.method+" score "+p.score.toFixed(3))).join(""):'<div class="panel">No products match these constraints. Try a larger budget or disable the stock filter.</div>';
}
function renderCold(){
 const choice=byId("new-product").value,anchor=lab.items.find(p=>p.id===choice);
 byId("cold-description").textContent=anchor?anchor.name+" · "+anchor.category+" · "+price(anchor.price)+" · 0 observed reviews":"";
 const items=coldStartAlternatives(lab,choice,5);
 byId("cold-results").innerHTML=items.map((p,i)=>productCard({...p,reason:"TF-IDF + category/price similarity: "+Math.round(p.similarity*100)+"%"} ,i,"content similarity")).join("");
}
for(const [id,p] of Object.entries(lab.personas)){const o=new Option(p.label,id);byId("persona").add(o);}
for(const c of ["All",...CATEGORIES])byId("category").add(new Option(c,c));
for(const p of lab.items.filter(x=>x.reviewCount===0))byId("new-product").add(new Option(p.name,p.id));
byId("new-product").selectedIndex=0;
for(const id of ["persona","method","weight","diversity","category","budget","in-stock"])byId(id).addEventListener("input",renderRanking);
byId("new-product").addEventListener("change",renderCold);
byId("export").addEventListener("click",()=>{
 const body=JSON.stringify({disclosure:"Synthetic demo only; not observed Amazon customer behavior.",configuration:rankArgs(),recommendations:shown.map(({id,name,category,price,score,content,collaborative,popularity,reason})=>({id,name,category,price,score,content,collaborative,popularity,reason}))},null,2);
 const url=URL.createObjectURL(new Blob([body],{type:"application/json"}));const a=document.createElement("a");a.href=url;a.download="recverity-synthetic-ranking.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
byId("menu").addEventListener("click",()=>{const n=byId("mobile-links");n.hidden=!n.hidden;byId("menu").setAttribute("aria-expanded",String(!n.hidden));});
window.addEventListener("hashchange",setPage);setPage();
