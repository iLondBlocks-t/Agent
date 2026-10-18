// eagler-step1.js — boot EaglercraftX 1.12 (WASM) in the real Chromium and
// screenshot whatever screen appears, so we can plan the click coordinates.
const __chr = require("/home/user/Agent/mc-lab/browser/node_modules/@sparticuz/chromium/build/index.js");
const chromium = __chr.default;
const inflate = __chr.inflate;
const puppeteer = require("/home/user/Agent/mc-lab/browser/node_modules/puppeteer-core");
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = "/home/user/Agent/mc-lab/eagler/client/web/wasm";
const OUT = "/home/user/Agent/mc-lab/eagler";
const PROFILE = "/tmp/eagler-profile";

const MIME = { ".html": "text/html", ".js": "text/javascript", ".wasm": "application/wasm",
  ".epw": "application/octet-stream", ".epk": "application/octet-stream", ".png": "image/png" };

(async () => {
  await inflate("/home/user/Agent/mc-lab/browser/node_modules/@sparticuz/chromium/bin/al2023.tar.br");
  process.env.LD_LIBRARY_PATH = ["/tmp/al2023/lib", "/tmp", process.env.LD_LIBRARY_PATH].filter(Boolean).join(":");
  process.env.FONTCONFIG_PATH = "/tmp/fonts";

  const server = http.createServer((req, res) => {
    const f = path.join(ROOT, req.url === "/" ? "/index.html" : req.url.split("?")[0]);
    if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream" });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise(r => server.listen(8124, "127.0.0.1", r));

  const browser = await puppeteer.launch({
    args: [...chromium.args, "--no-sandbox", "--disable-dev-shm-usage",
           "--autoplay-policy=no-user-gesture-required", "--enable-unsafe-swiftshader"],
    executablePath: await chromium.executablePath(),
    headless: true,
    userDataDir: PROFILE,
    defaultViewport: { width: 1280, height: 720 },
  });
  const page = await browser.newPage();
  page.on("console", m => { const t = m.text(); if (/error|fail|webgl|wasm/i.test(t)) console.log("PAGE:", t.slice(0, 160)); });
  page.on("pageerror", e => console.log("PAGEERROR:", String(e).slice(0, 200)));

  await page.goto("http://127.0.0.1:8124/", { waitUntil: "load", timeout: 60000 });
  for (let i = 0; i < 24; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const info = await page.evaluate(() => ({
      canvas: !!document.querySelector("canvas"),
      canvases: document.querySelectorAll("canvas").length,
      ls: Object.keys(localStorage),
      title: document.title,
    }));
    console.log(`t=${(i + 1) * 5}s`, JSON.stringify(info));
    if (info.canvas) {
      await new Promise(r => setTimeout(r, 8000));   // let the menu paint
      await page.screenshot({ path: path.join(OUT, "screen-menu.png") });
      console.log("SCREENSHOT: screen-menu.png");
      break;
    }
  }
  await browser.close();
  server.close();
  console.log("DONE");
})().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
