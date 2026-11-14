// Local CSV analysis. No network, persistence, analytics, or server-side processing.
// Accept bounded plain UTF-8 CSV only. Keep original reviewer IDs off the public repository.
export const MAX_BYTES=5*1024*1024,MAX_ROWS=10000;
export function parseCSV(text,{maxRows=MAX_ROWS}={}){
 if(typeof text!=="string")throw new Error("CSV must be text.");
 const out=[],row=[];let cell="",quoted=false,afterQuote=false;
 text=text.replace(/^\uFEFF/,"");
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(quoted){
   if(c==='"'&&text[i+1]==='"'){cell+='"';i++;}
   else if(c==='"'){quoted=false;afterQuote=true;}
   else cell+=c;
  }else if(afterQuote){
   if(c===","||c==="\n"||c==="\r"){row.push(cell);cell="";afterQuote=false;if(c===",")continue;
    if(c==="\r"&&text[i+1]==="\n")i++; if(row.some(x=>x.trim()))out.push([...row]);row.length=0;
   }else if(c===" "||c==="\t"){}else throw new Error("Unexpected text after a quoted CSV value.");
  }else if(c==='"'){if(cell.trim())throw new Error("Quote within an unquoted CSV value.");quoted=true;}
  else if(c===","){row.push(cell);cell="";}
  else if(c==="\n"||c==="\r"){row.push(cell);cell="";if(c==="\r"&&text[i+1]==="\n")i++;
   if(row.some(x=>x.trim()))out.push([...row]);row.length=0;
  }else cell+=c;
  if(out.length>maxRows+1)throw new Error("CSV exceeds "+maxRows+" data rows.");
 }
 if(quoted)throw new Error("CSV has an unclosed quoted field.");
 if(cell.length||row.length){row.push(cell);if(row.some(x=>x.trim()))out.push([...row]);}
 if(out.length>maxRows+1)throw new Error("CSV exceeds "+maxRows+" data rows.");
 if(!out.length)throw new Error("Empty CSV.");
 const header=out.shift().map(s=>s.trim().toLowerCase().replace(/\s+/g,"_"));
 if(header.some(x=>!x)||new Set(header).size!==header.length)throw new Error("CSV headers must be unique and nonempty.");
 if(out.some(x=>x.length!==header.length))throw new Error("Inconsistent column count in CSV.");
 return {headers:header,rows:out.map((row)=>Object.fromEntries(header.map((h,i)=>[h,row[i].trim()])))};
}
export async function readCsvFile(file){
 if(!file||!/\.csv$/i.test(file.name))throw new Error("Select a .csv file.");
 if(file.size>MAX_BYTES)throw new Error("CSV exceeds the 5 MB per-file limit.");
 return parseCSV(await file.text());
}
const choose=(row,names)=>{for(const n of names)if(Object.hasOwn(row,n))return row[n];return undefined;};
const nvalue=x=>x===""||x==null?null:Number(String(x).replace(/[₹$£,]/g,""));
export function normalizeCatalog(parsed){
 const h=new Set(parsed.headers);
 if(!["product_id","item_id","id"].some(x=>h.has(x))||!["price","discounted_price"].some(x=>h.has(x)))
  throw new Error("Catalog requires product_id (or item_id/id) and price (or discounted_price).");
 const items=parsed.rows.map((r,i)=>{
  const price=nvalue(choose(r,["price","discounted_price"]));
  const rating=nvalue(choose(r,["rating"]));
  const rawStock=choose(r,["available","in_stock"]);
  return {id:choose(r,["product_id","item_id","id"]),name:choose(r,["product_name","name","title"])||"",
   category:choose(r,["category","main_category"])||"Unknown",description:choose(r,["about_product","description"])||"",price,rating,
   available:rawStock==null?null:/^(true|1|yes|available)$/i.test(rawStock),
   row:i+2};
 });
 const warnings=[];
 const invalid=items.filter(x=>!x.id||!Number.isFinite(x.price)||x.price<=0);
 const dup=items.length-new Set(items.map(x=>x.id)).size;
 if(invalid.length)warnings.push(invalid.length+" rows have missing product IDs or invalid prices.");
 if(dup)warnings.push(dup+" repeated product identifiers.");
 const rated=items.filter(x=>x.rating!==null&&(!Number.isFinite(x.rating)||x.rating<0||x.rating>5));
 if(rated.length)warnings.push(rated.length+" ratings outside the accepted 0–5 range.");
 return {kind:"catalog",items,rows:parsed.rows.length,warnings,invalidRows:invalid.length,duplicates:dup};
}
export function normalizeInteractions(parsed){
 const h=new Set(parsed.headers);
 if(!h.has("user_id")||!["product_id","item_id"].some(x=>h.has(x)))
  throw new Error("Interactions require user_id and product_id (or item_id).");
 const events=parsed.rows.map((r,i)=>{
  const rawTime=choose(r,["timestamp","event_time","created_at"]);
  const numeric=rawTime==null||rawTime===""?null:Number(rawTime);
  const stamp=rawTime==null||rawTime===""?null:Number.isFinite(numeric)?numeric:
   (Number.isFinite(Date.parse(rawTime))?Date.parse(rawTime):null);
  return {userId:r.user_id,itemId:choose(r,["product_id","item_id"]),
   eventId:choose(r,["event_id","review_id"])||null,
   rating:nvalue(choose(r,["rating"])),timestamp:stamp,row:i+2};
 });
 const warnings=[],invalid=events.filter(x=>!x.userId||!x.itemId);
 if(invalid.length)warnings.push(invalid.length+" missing user or product IDs.");
 const ratingInvalid=events.filter(x=>x.rating!==null&&(!Number.isFinite(x.rating)||x.rating<0||x.rating>5));
 if(ratingInvalid.length)warnings.push(ratingInvalid.length+" rating values outside 0–5.");
 if(!h.has("event_id")&&!h.has("review_id"))warnings.push("Event-level leakage cannot be tested without event_id or review_id.");
 if(!["timestamp","event_time","created_at"].some(x=>h.has(x)))warnings.push("Chronological order cannot be checked without timestamps.");
 return {kind:"interactions",events,rows:parsed.rows.length,warnings,invalidRows:invalid.length};
}
export function summarizeCsv(parsed,kind){
 if(kind==="catalog")return normalizeCatalog(parsed);
 if(kind==="interactions")return normalizeInteractions(parsed);
 throw new Error("Unknown CSV schema.");
}
export const DEMO_CATALOG_CSV="product_id,product_name,category,price,rating,available\np1,Travel Headphones,Audio,1800,4.6,true\np2,Desktop Keyboard,Computing,2100,4.1,true\np3,Desk Lamp,Home,870,,false\n";
export const DEMO_TRAIN_CSV="user_id,product_id,rating,timestamp,event_id\nu1,p1,5,10,e1\nu2,p2,4,12,e2\nu3,p3,3,14,e3\n";
export const DEMO_TEST_CSV="user_id,product_id,rating,timestamp,event_id\nu1,p2,4,16,e4\nu2,p1,5,18,e2\n";
