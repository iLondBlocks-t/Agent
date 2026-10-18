const __chr = require("/home/user/Agent/mc-lab/browser/node_modules/@sparticuz/chromium/build/index.js");
const chromium = __chr.default, inflate = __chr.inflate;
const puppeteer = require("/home/user/Agent/mc-lab/browser/node_modules/puppeteer-core");
const http = require("http"), fs = require("fs"), path = require("path");
const ROOT = "/home/user/Agent/mc-lab/eagler/client188";
const MIME = { ".html":"text/html",".js":"text/javascript",".wasm":"application/wasm",".epk":"application/octet-stream",".png":"image/png",".lang":"text/plain",".map":"application/json" };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await inflate("/home/user/Agent/mc-lab/browser/node_modules/@sparticuz/chromium/bin/al2023.tar.br");
  process.env.LD_LIBRARY_PATH = ["/tmp/al2023/lib","/tmp",process.env.LD_LIBRARY_PATH].filter(Boolean).join(":");
  process.env.FONTCONFIG_PATH = "/tmp/fonts";
  const server = http.createServer((req,res)=>{ const f=path.join(ROOT, req.url==="/"?"/index.html":req.url.split("?")[0]);
    if(!fs.existsSync(f)){res.writeHead(404);return res.end();} res.writeHead(200,{"Content-Type":MIME[path.extname(f)]||"application/octet-stream"}); fs.createReadStream(f).pipe(res); });
  await new Promise(r=>server.listen(8125,"127.0.0.1",r));
  const browser = await puppeteer.launch({ args:[...chromium.args,"--no-sandbox","--disable-dev-shm-usage","--enable-unsafe-swiftshader","--autoplay-policy=no-user-gesture-required","--mute-audio"],
    executablePath: await chromium.executablePath(), headless:true, protocolTimeout:25000, userDataDir:"/tmp/diag-profile", defaultViewport:{width:1280,height:720} });
  const page = await browser.newPage();
  page.on("pageerror", e => console.log("PAGEERROR:", String(e.message).slice(0,200)));
  page.on("console", m => { const t=m.text(); if(/error|warn|fail/i.test(t)) console.log("CONSOLE:", t.slice(0,200)); });
  await page.goto("http://127.0.0.1:8125/", { waitUntil:"load", timeout:60000 });
  console.log("loaded");
  for (let i=0;i<20;i++){ await sleep(3000); const c=await page.evaluate(()=>document.querySelectorAll("canvas").length).catch(e=>"ERR:"+e.message.slice(0,80)); console.log("t+"+(i+1)*3+"s canvas:",c); if(c===1) break; }
  const inj = await page.addScriptTag({ path: "/home/user/Agent/mc-lab/eagler/probe.js" }).then(()=> "OK").catch(e=>"ERR:"+e.message.slice(0,120));
  console.log("inject:", inj);
  console.log("typeof __pxBox:", await page.evaluate(()=>typeof window.__pxBox).catch(e=>"ERR:"+e.message.slice(0,120)));
  const r1 = await page.evaluate(()=>window.__pxBox(0.2,0.2,0.6,0.5)).then(JSON.stringify).catch(e=>"ERR:"+e.message.slice(0,200));
  console.log("pxBox:", r1);
  const r2 = await page.evaluate(()=>window.__findButtons()).then(b=>JSON.stringify(b.length)).catch(e=>"ERR:"+e.message.slice(0,200));
  console.log("findButtons count:", r2);
  const r3 = await page.evaluate(()=>{ const c=document.querySelector("canvas"); const g=c&&(c.getContext("webgl2")||c.getContext("webgl")); if(!g) return "no ctx via getContext"; const p=new Uint8Array(4); try{ g.readPixels(10,10,1,1,g.RGBA,g.UNSIGNED_BYTE,p); return "readPixels ok "+[...p]; }catch(e){ return "readPixels THROWS: "+e.message; } }).catch(e=>"ERR:"+e.message.slice(0,200));
  console.log("raw ctx test:", r3);
  await page.screenshot({ path:"/home/user/Agent/mc-lab/eagler/shots/diag.png" });
  await browser.close(); server.close(); console.log("DIAG DONE");
})().catch(e=>{ console.error("FATAL:", e.message); process.exit(1); });
