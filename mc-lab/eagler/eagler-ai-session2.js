// eagler-ai-session.js — AI-directed real gameplay session (EaglercraftX 1.8.8).
// The director SEEs the screen (WebGL pixel probes + GUI-button rectangle detection),
// DECIDEs from what it saw, ACTs (keyboard/mouse), and LOGs every step to
// output/ai-director2.log. Video = CDP Page.startScreencast; audio = in-page WebAudio tap.
const __chr = require("/home/user/Agent/mc-lab/browser/node_modules/@sparticuz/chromium/build/index.js");
const chromium = __chr.default, inflate = __chr.inflate;
const puppeteer = require("/home/user/Agent/mc-lab/browser/node_modules/puppeteer-core");
const http = require("http"), fs = require("fs"), path = require("path");
const ROOT = "/home/user/Agent/mc-lab/eagler/client188";
const FRAMES = "/home/user/Agent/mc-lab/eagler/frames2";
const SHOTS = "/home/user/Agent/mc-lab/eagler/shots";
const OUT = "/home/user/Agent/mc-lab/output";
const MIME = { ".html": "text/html", ".js": "text/javascript", ".wasm": "application/wasm",
  ".epk": "application/octet-stream", ".png": "image/png", ".lang": "text/plain", ".map": "application/json" };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = [];
const L = (...a) => { const s = `[${new Date().toISOString()}] ` + a.join(" "); log.push(s); console.log(s); };

(async () => {
  fs.rmSync(FRAMES, { recursive: true, force: true }); fs.mkdirSync(FRAMES, { recursive: true });
  fs.mkdirSync(SHOTS, { recursive: true });
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
    executablePath: await chromium.executablePath(), headless: true, protocolTimeout: 180000,
    userDataDir: "/tmp/eagler188-profile", defaultViewport: { width: 1280, height: 720 },
  });
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(fs.readFileSync(path.join(ROOT, "..", "audio-hook.js"), "utf8"));
  page.on("pageerror", e => L("PAGEERROR", String(e.message).slice(0, 140)));

  // ---- vision helpers -------------------------------------------------------
  const see = async () => {
    const buttons = await page.evaluate(() => window.__findButtons ? window.__findButtons() : []).catch(() => []);
    const scene = await page.evaluate(() => window.__pxBox ? window.__pxBox(0.2, 0.2, 0.6, 0.5) : null).catch(() => null);
    const centre = await page.evaluate(() => window.__pxBox ? window.__pxBox(0.47, 0.47, 0.06, 0.06) : null).catch(() => null);
    return { buttons, scene, centre };
  };
  const shot = n => page.screenshot({ path: path.join(SHOTS, n) }).then(() => L("SHOT", n)).catch(e => L("SHOTFAIL", n, e.message));
  const click = (x, y) => page.mouse.click(x, y);
  const kb = page.keyboard;
  const btn = (v, pred, fb) => { const b = v.buttons.find(pred); if (b) return [Math.round(b.cx), Math.round(b.cy), "detected"]; return [...fb, "fallback"]; };
  const classify = v => {
    const B = v.buttons;
    const centred = B.filter(b => Math.abs(b.cx - 640) < 70 && b.w > 300);
    if (B.some(b => b.w > 400 && b.cy > 600 && Math.abs(b.cx - 640) < 120) && v.scene && v.scene.mean < 60)
      return "edit-profile";
    if (centred.length >= 2 && centred[0].cy > 300 && centred[0].cy < 420) return "title-menu";
    if (B.some(b => b.cx > 750 && b.cy > 540 && b.cy < 650)) return "world-select";
    if (B.some(b => b.cy > 600 && b.cx < 640) || B.some(b => Math.abs(b.cx - 640) < 90 && b.cy > 280 && b.cy < 400)) return "create-world";
    if (centred.some(b => b.cy > 380 && b.cy < 470)) return "death-screen";
    if (!B.length && v.scene && v.scene.mean > 200) return "sound-gate";
    if (!B.length && v.scene && v.scene.variance > 800 && v.centre && v.centre.variance > 120) return "in-game";
    if (!B.length) return "loading";
    return "unknown";
  };

  await page.goto("http://127.0.0.1:8125/", { waitUntil: "load", timeout: 60000 });
  L("BOOT page loaded");
  for (let i = 0; i < 30; i++) { await sleep(3000);
    if (await page.evaluate(() => document.querySelectorAll("canvas").length).catch(() => 0)) { L("BOOT canvas after", (i + 1) * 3, "s"); break; } }
  await page.addScriptTag({ path: path.join(ROOT, "..", "probe.js") });
  L("BOOT probe injected; audio state:", JSON.stringify(await page.evaluate(() => window.__aud && window.__aud.state)));
  await sleep(15000); // let assets/locales settle

  // ---- screencast ON --------------------------------------------------------
  const meta = []; let n = 0, saving = Promise.resolve();
  const cdp = await page.target().createCDPSession();
  await cdp.send("Page.enable");
  cdp.on("Page.screencastFrame", ev => {
    const i = n++;
    meta.push({ file: String(i).padStart(5, "0") + ".jpg", ts: ev.metadata && ev.metadata.timestamp });
    saving = saving.then(() => fs.promises.writeFile(path.join(FRAMES, String(i).padStart(5, "0") + ".jpg"), Buffer.from(ev.data, "base64")));
    cdp.send("Page.screencastFrameAck", { sessionId: ev.sessionId }).catch(() => {});
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 65, maxWidth: 1280, maxHeight: 720, everyNthFrame: 1 });
  L("CAST ON");

  // ---- director loop: SEE -> DECIDE -> ACT ----------------------------------
  let stage = "boot", inGame = false, plays = 0;
  for (let step = 0; step < 60 && !inGame; step++) {
    const v = await see(); const cls = classify(v);
    L("SEE", "step", step, "class:", cls, "buttons:", v.buttons.length,
      "scene:", v.scene ? `mean=${v.scene.mean.toFixed(0)} var=${v.scene.variance.toFixed(0)}` : "null",
      "centre:", v.centre ? `var=${v.centre.variance.toFixed(0)}` : "null");
    await shot(`ai-${String(step).padStart(2, "0")}-${cls}.png`);
    if (cls === "edit-profile") {
      L("DECIDE set username=LondAgent then Done");
      await click(788, 224); await sleep(400);
      for (let i = 0; i < 24; i++) await kb.press("Backspace");
      await kb.type("LondAgent", { delay: 70 }); await sleep(400);
      const [dx, dy, how] = btn(v, b => b.w > 400 && b.cy > 600, [637, 651]);
      L("ACT click Done", dx, dy, how); await click(dx, dy); await sleep(2500);
    } else if (cls === "title-menu") {
      const c = v.buttons.filter(b => Math.abs(b.cx - 640) < 70 && b.w > 300).sort((a, b) => a.cy - b.cy)[0];
      const [sx, sy, how] = c ? [Math.round(c.cx), Math.round(c.cy), "detected"] : [640, 353, "fallback"];
      L("DECIDE open Singleplayer; ACT click", sx, sy, how); await click(sx, sy); await sleep(3000);
    } else if (cls === "world-select") {
      const c = v.buttons.find(b => b.cx > 750 && b.cy > 540 && b.cy < 650);
      if (c) { L("DECIDE empty list -> Create New World; ACT click", Math.round(c.cx), Math.round(c.cy)); await click(Math.round(c.cx), Math.round(c.cy)); await sleep(2500); }
      else { L("DECIDE select first entry then Play"); await click(640, 200); await sleep(600); await click(402, 593); await sleep(3000); }
    } else if (cls === "create-world") {
      const b1 = v.buttons.find(b => b.cy > 600 && b.cx < 640);
      const b2 = v.buttons.find(b => Math.abs(b.cx - 640) < 90 && b.cy > 280 && b.cy < 400);
      const t = b1 || b2; const [cx2, cy2, how] = t ? [Math.round(t.cx), Math.round(t.cy), "detected"] : [480, 664, "fallback"];
      L("DECIDE confirm world creation; ACT click", cx2, cy2, how); await click(cx2, cy2); await sleep(4000);
    } else if (cls === "sound-gate") {
      L("DECIDE Eaglercraft sound gate ('press any key to enable sound') -> press Enter + click");
      await kb.press("Enter"); await sleep(400); await click(640, 360); await sleep(2500);
    } else if (cls === "death-screen") {
      const r = v.buttons.filter(b => Math.abs(b.cx - 640) < 120 && b.cy > 380 && b.cy < 470)[0];
      const [rx, ry, how] = r ? [Math.round(r.cx), Math.round(r.cy), "detected"] : [640, 425, "fallback"];
      L("DECIDE player died -> Respawn; ACT click", rx, ry, how); await click(rx, ry); await sleep(2000);
    } else if (cls === "in-game") {
      inGame = true; L("DECIDE in-world detected -> start play sequence");
    } else { // loading / unknown
      L("DECIDE wait (world generating / screen unclear)"); await sleep(4000);
    }
  }
  if (!inGame) { L("FATAL never reached in-game; aborting with evidence"); await shot("ai-FAIL-last.png"); }
  else {
    await sleep(1500);
    await click(640, 360); await sleep(600);           // focus + pointer lock
    L("ACT play: look down at ground"); await page.mouse.move(640, 560, { steps: 25 }); await sleep(300);
    L("ACT play: mine block #1 3.0s");  await page.mouse.down(); await sleep(3000); await page.mouse.up(); await sleep(400);
    L("ACT play: step forward W 0.8s"); await kb.down("w"); await sleep(800); await kb.up("w");
    L("ACT play: mine block #2 3.0s");  await page.mouse.down(); await sleep(3000); await page.mouse.up(); await sleep(400);
    L("ACT play: select hotbar 1");     await kb.press("1"); await sleep(300);
    L("ACT play: place block x3");      for (let i = 0; i < 3; i++) { await page.mouse.click(640, 430, { button: "right" }); await sleep(600); }
    L("ACT play: jump onto build");     await kb.down("w"); await kb.press("Space"); await sleep(700); await kb.up("w"); await sleep(300);
    L("ACT play: open inventory E");    await kb.press("e"); await sleep(1800); await shot("s2-inventory.png"); await kb.press("e"); await sleep(600);
    L("ACT play: look around pan");     await page.mouse.move(900, 340, { steps: 30 }); await sleep(300); await page.mouse.move(400, 360, { steps: 30 }); await sleep(300);
    L("ACT play: jump x2");             await kb.press("Space"); await sleep(450); await kb.press("Space"); await sleep(450);
    plays = 1;
    await shot("ai-play-end.png");
    await kb.press("Escape"); await sleep(2000); await shot("ai-pause.png");
  }

  // ---- stop capture, dump audio --------------------------------------------
  await cdp.send("Page.stopScreencast").catch(() => {}); await saving;
  fs.writeFileSync(path.join(FRAMES, "meta.json"), JSON.stringify(meta));
  L("CAST OFF frames:", meta.length);
  const stopped = await page.evaluate(() => window.__audStop ? window.__audStop() : false).catch(() => false);
  await sleep(800);
  const dump = await page.evaluate(() => window.__audDump ? window.__audDump() : { bytes: 0, b64: "" }).catch(() => ({ bytes: 0, b64: "" }));
  L("AUDIO state:", JSON.stringify(await page.evaluate(() => window.__aud && { state: window.__aud.state, mime: window.__aud.mime, chunks: window.__aud.blobs && window.__aud.blobs.length })), "bytes:", dump.bytes);
  if (dump.bytes) fs.writeFileSync(path.join(OUT, "game-audio.webm"), Buffer.from(dump.b64, "base64"));
  await browser.close(); server.close();
  fs.writeFileSync(path.join(OUT, "ai-director2.log"), log.join("\n") + "\n");
  console.log("DONE inGame:", inGame, "frames:", meta.length, "audioBytes:", dump.bytes);
})().catch(e => { console.error("FATAL:", e.message); fs.writeFileSync("/home/user/Agent/mc-lab/output/ai-director2.log", log.join("\n") + "\nFATAL " + e.message + "\n"); process.exit(1); });
