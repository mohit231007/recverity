// Real-browser smoke test for the public, fictional RecVerity demo.
// Executed by GitHub Actions on a local HTTP server, without paid services.
import {chromium} from "playwright";
import {mkdir} from "node:fs/promises";
import assert from "node:assert/strict";
const errors=[];
await mkdir("artifacts",{recursive:true});
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
 page.on("pageerror",e=>errors.push(e.message));
 const response=await page.goto("http://127.0.0.1:8000/",{waitUntil:"networkidle"});
 assert.equal(response.status(),200);
 await page.locator("#overview h1").waitFor();
 assert.match(await page.title(),/RecVerity/);
 await page.screenshot({path:"artifacts/desktop-overview.png",fullPage:true});
 await page.locator("a[href='#lab']").first().click();
 await page.locator("#results .product").first().waitFor();
 assert.equal(await page.locator("#results .product").count(),5);
 await page.locator("#weight").evaluate(el=>{el.value="30";el.dispatchEvent(new Event("input",{bubbles:true}));});
 assert.match(await page.locator("#weight-value").innerText(),/30% CF/);
 await page.locator("#persona").selectOption("guest");
 assert.match(await page.locator("#results").innerText(),/popularity fallback/i);
 await page.screenshot({path:"artifacts/desktop-lab.png",fullPage:true});
 await page.locator("a[href='#cold']").first().click();
 await page.locator("#cold-results .product").first().waitFor();
 assert.equal(await page.locator("#cold-results .product").count(),5);
 await page.locator("a[href='#audit']").first().click();
 assert.match(await page.locator("#audit").innerText(),/3\.48%/);
 await page.locator("a[href='#engineering']").first().click();
 assert.match(await page.locator("#engineering").innerText(),/TF-IDF/);
 assert.deepEqual(errors,[]);

 const mobile=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
 mobile.on("pageerror",e=>errors.push(e.message));
 await mobile.goto("http://127.0.0.1:8000/",{waitUntil:"networkidle"});
 await mobile.locator("#overview h1").waitFor();
 await mobile.locator("#menu").click();
 assert.equal(await mobile.locator("#mobile-links").isVisible(),true);
 await mobile.locator("#mobile-links a[href='#lab']").click();
 await mobile.locator("#results .product").first().waitFor();
 assert.equal(await mobile.locator("#results .product").count(),5);
 await mobile.screenshot({path:"artifacts/mobile-lab.png",fullPage:true});
 assert.deepEqual(errors,[]);
 console.log("PASS desktop/mobile navigation, ranking, guest fallback, cold start, audit and browser errors");
}finally{await browser.close();}
