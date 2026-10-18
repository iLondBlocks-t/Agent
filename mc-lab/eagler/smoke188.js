// Smoke test: launch Chromium, serve client188, confirm the game canvas boots and probe works.
const __chr = require("/home/user/Agent/mc-lab/browser/node_modules/@sparticuz/chromium/build/index.js");
const chromium = __chr.default, inflate = __chr.inflate;
const puppeteer = require("/home/user/Agent/mc-lab/browser/node_modules/puppeteer-core");
const http=require("http"), fs=require("fs"), path=require("path");
const ROOT="/home/user/Agent/mc-lab/eagler/client188";
const MIME={".html":"text/html",".js":"text/javascript",".wasm":"application/wasm",".epk":"application/octet-stream",".png":"image/png",".lang":"text/plain",".map":"application/json"};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  await inflate(path.join("/home/user/Agent/mc-lab/browser/node_modules/@sparticuz/chromium/bin/al2023.tar.br"));
  process.env.LD_LIBRARY_PATH=["/tmp/al2023/lib","/tmp",process.env.LD_LIBRARY_PATH].filter(Boolean).join(":");
  process.env.FONTCONFIG_PATH="/tmp/fonts";
  const server=http.createServer((req,res)=>{
    const f=path.join(ROOT, req.url==="/"?"/index.html":req.url.split("?")[0]);
    if(!fs.existsSync(f)){res.writeHead(404);return res.end();}
    res.writeHead(200,{"Content-Type":MIME[path.extname(f)]||"application/octet-stream"});
    fs.createReadStream(f).pipe(res);
  });
  await new Promise(r=>server.listen(8125,"127.0.0.1",r));
  const browser=await puppeteer.launch({
    args:[...chromium.args,"--no-sandbox","--disable-dev-shm-usage","--enable-unsafe-swiftshader",
          "--autoplay-policy=no-user-gesture-required","--mute-audio"],
    executablePath:await chromium.executablePath(), headless:true, protocolTimeout:120000,
    userDataDir:"/tmp/eagler188-profile", defaultViewport:{width:1280,height:720}});
  const page=await browser.newPage();
  page.on("console",m=>{const t=m.text(); if(/error|fail|exception/i.test(t)) console.log("[console]",t.slice(0,160));});
  page.on("pageerror",e=>console.log("[pageerror]",String(e.message).slice(0,160)));
  console.log("launched:", await browser.version());
  await page.goto("http://127.0.0.1:8125/",{waitUntil:"load",timeout:60000});
  await sleep(4000);
  await page.click("body").catch(()=>{});
  await page.evaluate(()=>{}); 
  await page.addScriptTag({path:path.join(ROOT,"probe.js")});
  console.log("probe installed");
  let got=false;
  for(let i=0;i<40;i++){ await sleep(3000);
    const c=await page.evaluate(()=>document.querySelectorAll('canvas').length);
    if(c>0){ got=true; console.log("canvas present after", (i+1)*3, "s; count", c); break; }
  }
  if(!got){ console.log("NO CANVAS"); await browser.close(); server.close(); process.exit(2); }
  await sleep(20000);
  const stats=await page.evaluate(()=>window.__pxBox(0.25,0.35,0.5,0.3));
  console.log("centre-box stats:", JSON.stringify(stats));
  await page.screenshot({path:"/home/user/Agent/mc-lab/eagler/shots/s00-smoke.png"});
  console.log("SHOT s00-smoke.png");
  await browser.close(); server.close(); console.log("SMOKE DONE");
})().catch(e=>{console.error("FATAL:",e.message);process.exit(1);});
