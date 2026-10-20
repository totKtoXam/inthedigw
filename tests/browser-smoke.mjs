import { chromium } from "playwright";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import fs from "node:fs/promises";

const server = spawn("python3", ["-m","http.server","8765","--bind","127.0.0.1"], {stdio:"ignore"});
const errors=[];
let browser;

try {
  await delay(1000);
  browser=await chromium.launch({
    headless:true,
    args:["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--disable-dev-shm-usage"]
  });
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  page.on("pageerror",e=>errors.push(e.message));
  await page.goto("http://127.0.0.1:8765/", {waitUntil:"load",timeout:30000});
  await page.waitForFunction(()=>{
    const text=document.getElementById("load-message")?.textContent||"";
    return text.includes("Сцена Байтерека готова");
  }, {timeout:10000});
  await page.waitForFunction(()=>document.getElementById("fps")?.textContent!=="—",null,{timeout:15000});
  const fps=Number(await page.locator("#fps").textContent());
  assert.ok(fps>0,"WebGL render loop must show FPS");
  assert.ok(await page.locator("#viewport canvas").count()>=1,"WebGL canvas missing");
  await page.locator("#map-toggle").click();
  await page.locator("#map-expanded").waitFor({state:"visible"});
  const size=await page.locator("#fullmap-canvas").evaluate(node=>node.width);
  assert.ok(size>=260,"Expanded map not rendered");
  await page.locator("#close-map").click();
  await page.locator("#overlay").waitFor({state:"visible"});
  await fs.mkdir("artifacts",{recursive:true});
  await page.screenshot({path:"artifacts/baiterek-v1.png",fullPage:true});
  assert.deepEqual(errors,[],"Uncaught browser exceptions");
  console.log(JSON.stringify({smoke:"PASS",fps,mapCanvas:size,errors}));
} finally {
  if(browser)await browser.close();
  server.kill();
}
