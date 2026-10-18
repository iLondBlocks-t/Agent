// eagler-play2.js — final experience run with CDP Page.startScreencast capture
// (browser pushes every painted frame with a timestamp => real-time video).
const __chr = require("/home/user/Agent/mc-lab/browser/node_modules/@sparticuz/chromium/build/index.js");
const chromium = __chr.default, inflate = __chr.inflate;
const puppeteer = require("/home/user/Agent/mc-lab/browser/node_modules/puppeteer-core");
const http = require("http"); const fs = require("fs"); const path = require("path");
const ROOT = "/home/user/Agent/mc-lab/eagler/client188";
const FRAMES = "/home/user/Agent/mc-lab/eagler/frames2";
const SHOTS = "/home/user/Agent/mc-lab/eagler/shots";
const PROFILE = "/tmp/eagler188-profile";
const MIME = { ".html": "text/html", ".js": "text/javascript", ".wasm": "application/wasm",
  ".epk": "application/octet-stream", ".png": "image/png", ".lang": "text/plain", ".map": "application/json" };
fs.rmSync(FRAMES, { recursive: true, force: true }); fs.mkdirSync(FRAMES, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));

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
  await new Promise(r => server.listen(8125, "127.0.0.1", r));

  const browser = await puppeteer.launch({
    args: [...chromium.args, "--no-sandbox", "--disable-dev-shm-usage", "--enable-unsafe-swiftshader",
           "--autoplay-policy=no-user-gesture-required", "--mute-audio"],
    executablePath: await chromium.executablePath(), headless: true, protocolTimeout: 120000,
    userDataDir: PROFILE, defaultViewport: { width: 1280, height: 720 },
  });
  const page = await browser.newPage();
  const shot = n => page.screenshot({ path: path.join(SHOTS, n) }).then(() => console.log("SHOT", n));
  const click = (x, y) => page.mouse.click(x, y);

  // ---- screencast capture ----------------------------------------------------
  const meta = [];
  let n = 0, saving = Promise.resolve();
  const cdp = await page.target().createCDPSession();
  await cdp.send("Page.enable");
  cdp.on("Page.screencastFrame", ev => {
    const i = n++;
    meta.push({ file: String(i).padStart(5, "0") + ".jpg", ts: ev.metadata && ev.metadata.timestamp });
    saving = saving.then(() => fs.promises.writeFile(path.join(FRAMES, String(i).padStart(5, "0") + ".jpg"),
                                                      Buffer.from(ev.data, "base64")));
    cdp.send("Page.screencastFrameAck", { sessionId: ev.sessionId }).catch(() => {});
  });
  const startCast = () => cdp.send("Page.startScreencast", { format: "jpeg", quality: 65, maxWidth: 1280, maxHeight: 720, everyNthFrame: 1 });
  const stopCast = async () => { await cdp.send("Page.stopScreencast").catch(() => {}); await saving; };

  await page.goto("http://127.0.0.1:8125/", { waitUntil: "load", timeout: 60000 });
  await sleep(6000);
  await click(640, 360); await page.keyboard.press("Space");
  for (let i = 0; i < 25; i++) { await sleep(3000); if (await page.evaluate(() => !!document.querySelector("canvas"))) break; }
  await sleep(4000);
  await startCast();
  console.log("CAST ON");

  // --- name = LondAgent (converged) -------------------------------------------
  await click(640, 651); await sleep(1500);
  await click(792, 605); await sleep(2000);       // Edit Profile
  await click(790, 225); await sleep(300);
  for (let i = 0; i < 24; i++) await page.keyboard.press("Backspace");
  await page.keyboard.type("LondAgent", { delay: 70 });
  await sleep(500);
  await shot("q01-profile-named.png");
  await click(640, 651); await sleep(2500);       // Done -> menu
  await shot("q02-menu.png");

  // --- play the persisted world ------------------------------------------------
  await click(640, 353); await sleep(3000);       // Singleplayer -> world list
  await shot("q03-worldlist.png");
  await click(640, 262); await sleep(800);        // select the world entry
  await click(402, 593); await sleep(1500);       // Play Selected World
  await shot("q03b-after-play-click.png");
  await page.mouse.click(640, 262, { clickCount: 2 });   // double-click entry = join (fallback)
  await sleep(25000);                             // load
  await shot("q04-ingame.png");
  const kb = page.keyboard;
  const respawn = async () => { await click(640, 425); await sleep(1200); };
  await respawn(); await respawn();
  await page.mouse.move(640, 360);
  await kb.down("w"); await sleep(2200); await kb.up("w");
  await page.mouse.move(950, 330, { steps: 30 }); await sleep(300);
  await kb.press("Space"); await sleep(450); await kb.press("Space"); await sleep(450);
  await kb.down("d"); await sleep(1600); await kb.up("d");
  await respawn();
  await page.mouse.move(350, 380, { steps: 30 }); await sleep(300);
  await page.mouse.down(); await sleep(2400); await page.mouse.up();     // break block
  await kb.down("w"); await kb.down("a"); await sleep(1800); await kb.up("a"); await kb.up("w");
  await kb.press("Space"); await sleep(500);
  await respawn();
  await page.mouse.move(820, 300, { steps: 25 }); await sleep(300);
  await page.mouse.down(); await sleep(2200); await page.mouse.up();
  await kb.down("s"); await sleep(1200); await kb.up("s");
  await kb.press("Space"); await sleep(400);
  await shot("q05-after-play.png");
  await kb.press("Escape"); await sleep(2000);
  await shot("q06-pause.png");

  await stopCast();
  fs.writeFileSync(path.join(FRAMES, "meta.json"), JSON.stringify(meta));
  console.log("FRAMES:", meta.length);
  await browser.close(); server.close(); console.log("DONE");
})().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
