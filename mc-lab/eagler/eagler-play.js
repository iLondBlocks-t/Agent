// eagler-play.js — FULL EXPERIENCE RUN (EaglercraftX 1.8.8, real Chromium):
//   profile name = LondAgent -> main menu -> Singleplayer -> Create New World
//   -> walk/jump/look/break blocks -> pause -> Google's Chrome dino game.
//   Every ~220ms a frame is captured; frames/ is later encoded to MP4.
const __chr = require("/home/user/Agent/mc-lab/browser/node_modules/@sparticuz/chromium/build/index.js");
const chromium = __chr.default, inflate = __chr.inflate;
const puppeteer = require("/home/user/Agent/mc-lab/browser/node_modules/puppeteer-core");
const http = require("http"); const fs = require("fs"); const path = require("path");
const ROOT = "/home/user/Agent/mc-lab/eagler/client188";
const FRAMES = "/home/user/Agent/mc-lab/eagler/frames";
const SHOTS = "/home/user/Agent/mc-lab/eagler/shots";
const PROFILE = "/tmp/eagler188-profile";
const MIME = { ".html": "text/html", ".js": "text/javascript", ".wasm": "application/wasm",
  ".epk": "application/octet-stream", ".png": "image/png", ".lang": "text/plain", ".map": "application/json" };
fs.mkdirSync(FRAMES, { recursive: true }); fs.mkdirSync(SHOTS, { recursive: true });
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
  let n = 0, capturing = false, capPromise = Promise.resolve();
  const capLoop = () => {
    if (!capturing) return;
    capPromise = capPromise.then(async () => {
      const i = n++;
      try {
        await activePage.screenshot({ path: path.join(FRAMES, String(i).padStart(5, "0") + ".jpg"),
                                type: "jpeg", quality: 60 });
      } catch (e) { /* page may be navigating */ }
      await sleep(40);
      capLoop();
    });
  };
  let activePage = page;
  const shot = name => activePage.screenshot({ path: path.join(SHOTS, name) }).then(() => console.log("SHOT", name));
  const click = (x, y) => page.mouse.click(x, y);

  await page.goto("http://127.0.0.1:8125/", { waitUntil: "load", timeout: 60000 });
  await sleep(6000);
  await click(640, 360); await page.keyboard.press("Space");          // gesture
  for (let i = 0; i < 25; i++) {
    await sleep(3000);
    if (await page.evaluate(() => !!document.querySelector("canvas"))) break;
  }
  await sleep(5000);
  capturing = true; capLoop();                                         // RECORDING ON
  console.log("CAPTURE ON");

  // --- converge to: name set + main menu (handles both possible first screens)
  await shot("p01-first-screen.png");
  await click(640, 651);            await sleep(2000);   // Done (if profile) / gap (if menu)
  await click(792, 605);            await sleep(2500);   // Edit Profile (from menu)
  await shot("p02-profile.png");
  await click(790, 225);            await sleep(400);
  for (let i = 0; i < 24; i++) await page.keyboard.press("Backspace");
  await page.keyboard.type("LondAgent", { delay: 80 });
  await sleep(600);
  await shot("p03-profile-named.png");
  await click(640, 651);            await sleep(3000);   // Done -> menu
  await shot("p04-menu.png");

  // --- singleplayer -> create world -> play ---------------------------------
  await click(640, 353);            await sleep(3500);   // Singleplayer
  await shot("p05-worldlist.png");
  await click(877, 593);            await sleep(2500);   // Create New World (right button)
  await shot("p05b-wanna.png");
  await click(640, 330);            await sleep(2000);   // intermediate: Create New World
  await shot("p06-createworld.png");
  await click(398, 664);            await sleep(2000);   // confirm Create New World -> generating
  await sleep(30000);                                   // world gen + load (SwiftShader)
  await shot("p07-ingame.png");

  // --- PLAY: respawn if needed, then walk, look, jump, break blocks ---------
  const kb = page.keyboard;
  const respawn = async () => { await click(640, 425); await sleep(1500); };  // Respawn btn if dead
  await respawn(); await respawn();                                          // clear death screen
  await page.mouse.move(640, 360);
  await kb.down("w"); await sleep(2000); await kb.up("w");                    // forward
  await page.mouse.move(900, 340, { steps: 25 }); await sleep(400);           // look right
  await kb.press("Space"); await sleep(500); await kb.press("Space");         // jumps
  await kb.down("d"); await sleep(1500); await kb.up("d");                    // strafe
  await respawn();
  await page.mouse.move(400, 380, { steps: 25 }); await sleep(400);           // look left
  await page.mouse.down(); await sleep(2400); await page.mouse.up();          // break block
  await kb.down("w"); await kb.down("a"); await sleep(1800); await kb.up("a"); await kb.up("w");
  await kb.press("Space"); await sleep(600);
  await respawn();
  await page.mouse.move(800, 300, { steps: 20 }); await sleep(300);
  await page.mouse.down(); await sleep(2200); await page.mouse.up();          // break again
  await kb.down("s"); await sleep(1200); await kb.up("s");
  await kb.press("Space"); await sleep(500);
  await shot("p08-after-play.png");
  await kb.press("Escape"); await sleep(2500);                               // pause menu
  await shot("p09-pause.png");

  // --- Google's built-in game: chrome://dino --------------------------------
  capturing = false; await capPromise;                                       // pause while opening dino tab
  const dino = await browser.newPage();
  await dino.goto("https://www.google.com/", { waitUntil: "domcontentloaded", timeout: 25000 }).catch(e => console.log("DINO NAV:", e.message.split("\n")[0]));
  activePage = dino;
  await sleep(2500);
  capturing = true; capLoop();
  await shot("p10-dino.png");
  await dino.keyboard.press("Space"); await sleep(800);                     // start
  for (let i = 0; i < 14; i++) { await dino.keyboard.press("Space"); await sleep(900 + (i % 3) * 250); }
  await shot("p11-dino-play.png");
  capturing = false; await capPromise;

  console.log("FRAMES_CAPTURED:", n);
  await browser.close(); server.close(); console.log("DONE");
})().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
