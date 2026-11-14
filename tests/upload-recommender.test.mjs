import test from "node:test";
import assert from "node:assert/strict";
import {buildUploadedLab,recommendUploaded} from "../web/upload-recommender.mjs";
const catalog=[
 {id:"a",name:"Wireless headphones",category:"Audio",description:"sound music",price:999,available:true},
 {id:"b",name:"Bluetooth speaker",category:"Audio",description:"sound bass",price:1199,available:true},
 {id:"c",name:"Gaming keyboard",category:"Computing",description:"mechanical keys",price:1300,available:true},
 {id:"d",name:"Mobile charger",category:"Mobile",description:"charging",price:400,available:true},
 {id:"e",name:"Music earbuds",category:"Audio",description:"sound portable",price:799,available:false}
];
const events=[{userId:"alice",itemId:"a",rating:5,timestamp:1},{userId:"bob",itemId:"a",rating:5,timestamp:1},
 {userId:"bob",itemId:"b",rating:5,timestamp:2},{userId:"carl",itemId:"c",rating:4,timestamp:1},
 {userId:"alice",itemId:"d",rating:1,timestamp:2}];
test("user recommendations exclude observed positives and unavailable items",()=>{
 const lab=buildUploadedLab(catalog,events),out=recommendUploaded(lab,{userId:"alice"});
 assert.ok(out.recommendations.every(x=>x.id!=="a"&&x.id!=="d"&&x.id!=="e"));
 assert.ok(out.recommendations.some(x=>x.id==="b"));
});
test("a brand new product can receive metadata-based alternatives without interactions",()=>{
 const lab=buildUploadedLab(catalog);
 const out=recommendUploaded(lab,{anchorId:"a",method:"hybrid"});
 assert.ok(out.recommendations.length>0);
 assert.ok(out.recommendations.every(x=>x.id!=="a"&&x.method==="content"));
});
test("new user uses popularity fallback and respects price",()=>{
 const lab=buildUploadedLab(catalog,events);
 const out=recommendUploaded(lab,{userId:"new",method:"hybrid",budget:1000});
 assert.ok(out.recommendations.every(x=>x.method==="popularity"&&x.price<=1000));
});
test("repeated user-item pairs fail rather than silently constructing fake history",()=>{
 assert.throws(()=>buildUploadedLab(catalog,[events[0],events[0]]),/repeated/);
});
test("does not require SQL database or global similarity matrix",()=>{
 const lab=buildUploadedLab(catalog,events);
 assert.equal(Object.hasOwn(lab,"matrix"),false);
 assert.equal(lab.items.length,5);
});
