// eagler-p2.js — set the player name to LondAgent on the Edit Profile screen,
// then capture the main menu so we can compute click coordinates for P3.
const __chr = require("/home/user/Agent/mc-lab/browser/node_modules/@sparticuz/chromium/build/index.js");
const chromium = __chr.default, inflate = __chr.inflate;
const puppeteer = require("/home/user/Agent/mc-lab/browser/node_modules/puppeteer-core");
const http = require("http"); const fs = require("fs"); const path = require("path");
const ROOT = "/home/user/Agent/mc-lab/eagler/client/web/wasm";
const OUT = "/home/user/Agent/mc-lab/eagler/shots";
const PROFILE = process.env.EAGLER_PROFILE || "/tmp/eagler-profile";
const MIME = { ".html": "text/html", ".js": "text/javascript", ".wasm": "application/wasm",
  ".epw": "application/octet-stream", ".png": "image/png" };
fs.mkdirSync(OUT, { recursive: true });
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
    args: [...chromium.args, "--no-sandbox", "--disable-dev-shm-usage", "--enable-unsafe-swiftshader",
           "--autoplay-policy=no-user-gesture-required", "--mute-audio"],
    executablePath: await chromium.executablePath(), headless: true,
    userDataDir: PROFILE, defaultViewport: { width: 1280, height: 720 },
  });
  const page = await browser.newPage();
  const shot = n => page.screenshot({ path: path.join(OUT, n) }).then(() => console.log("SHOT", n));
  const click = (x, y) => page.mouse.click(x, y);
  await page.goto("http://127.0.0.1:8124/", { waitUntil: "load", timeout: 60000 });
  await new Promise(r => setTimeout(r, 8000));
  await click(640, 360); await page.keyboard.press("Space");      // user gesture (unlocks audio)
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 3000));
    if (await page.evaluate(() => !!document.querySelector("canvas"))) break;
  }
  await new Promise(r => setTimeout(r, 5000));
  await click(640, 480); await new Promise(r=>setTimeout(r,1500)); await click(640, 480);
  // username textbox (from observed layout): rect ~ (580,193)-(998,257)
  await click(790, 225);
  for (let i = 0; i < 24; i++) await page.keyboard.press("Backspace");   // field caps at 16 chars
  await page.keyboard.type("LondAgent", { delay: 90 });
  await new Promise(r => setTimeout(r, 800));
  
  await new Promise(r=>setTimeout(r,1500)); await click(640, 480);
  await new Promise(r => setTimeout(r, 6000));
  await new Promise(r=>setTimeout(r,4000)); await shot("04-mainmenu.png");
  await browser.close(); server.close(); console.log("DONE");
})().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
