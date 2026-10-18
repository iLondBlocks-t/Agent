const __chr = require("/home/user/Agent/mc-lab/browser/node_modules/@sparticuz/chromium/build/index.js");
const chromium = __chr.default, inflate = __chr.inflate;
const puppeteer = require("/home/user/Agent/mc-lab/browser/node_modules/puppeteer-core");
const http = require("http"), fs = require("fs"), path = require("path");
const ROOT = "/home/user/Agent/mc-lab/games/g2048";
const MIME = { ".html":"text/html",".js":"text/javascript",".css":"text/css",".png":"image/png",".ico":"image/x-icon" };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await inflate("/home/user/Agent/mc-lab/browser/node_modules/@sparticuz/chromium/bin/al2023.tar.br");
  process.env.LD_LIBRARY_PATH = ["/tmp/al2023/lib","/tmp",process.env.LD_LIBRARY_PATH].filter(Boolean).join(":");
  process.env.FONTCONFIG_PATH = "/tmp/fonts";
  const server = http.createServer((req,res)=>{ const f=path.join(ROOT, req.url==="/"?"/index.html":req.url.split("?")[0]);
    if(!fs.existsSync(f)){res.writeHead(404);return res.end();} res.writeHead(200,{"Content-Type":MIME[path.extname(f)]||"application/octet-stream"}); fs.createReadStream(f).pipe(res); });
  await new Promise(r=>server.listen(8127,"127.0.0.1",r));
  const browser = await puppeteer.launch({ args:[...chromium.args,"--no-sandbox","--disable-dev-shm-usage","--enable-unsafe-swiftshader","--mute-audio"],
    executablePath: await chromium.executablePath(), headless:true, protocolTimeout:30000, userDataDir:"/tmp/diag2048", defaultViewport:{width:800,height:640} });
  const page = await browser.newPage();
  await page.goto("http://127.0.0.1:8127/", { waitUntil:"load", timeout:60000 });
  await sleep(2000);
  const probe0 = await page.evaluate(() => {
    window.__seen = [];
    document.addEventListener("keydown", e => window.__seen.push([e.which, e.keyCode, e.key]), true);
    return document.querySelectorAll(".tile").length;
  });
  console.log("tiles before:", probe0);
  const r = await page.evaluate(() => {
    const e = new KeyboardEvent("keydown", { bubbles:true, cancelable:true });
    Object.defineProperty(e, "which", { value: 38 }); Object.defineProperty(e, "keyCode", { value: 38 });
    const ok = document.dispatchEvent(e);
    return { dispatched: ok, seen: window.__seen };
  });
  console.log("dispatch result:", JSON.stringify(r));
  await sleep(600);
  console.log("tiles after:", await page.evaluate(() => document.querySelectorAll(".tile").length));
  // try puppeteer real key press
  await page.keyboard.press("ArrowUp"); await sleep(600);
  console.log("tiles after real ArrowUp:", await page.evaluate(() => document.querySelectorAll(".tile").length));
  console.log("classes sample:", await page.evaluate(() => [...document.querySelectorAll(".tile")].slice(0,4).map(t => t.className)));
  await browser.close(); server.close(); console.log("DIAG DONE");
})().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
