// browser-run.js — real Chromium in this sandbox:
//  (1) prove the browser engine runs,
//  (2) show exactly what happens when it tries YouTube (blocked host),
//  (3) actually PLAY a video file inside the browser and prove playback
//      (currentTime advances + on-screen pixels change between screenshots).
const chromium = require("@sparticuz/chromium").default;
const { inflate } = require("@sparticuz/chromium");
const puppeteer = require("puppeteer-core");
const http = require("http");
const fs = require("fs");
const path = require("path");

const OUT = "/home/user/Agent/mc-lab/browser";
const MEDIA = "/home/user/Agent/mc-lab/output";

(async () => {
  // --- replicate the package's Amazon-Linux lib setup on Debian -------------
  await inflate(path.join(__dirname, "node_modules/@sparticuz/chromium/bin/al2023.tar.br"));
  process.env.LD_LIBRARY_PATH = ["/tmp/al2023/lib", "/tmp", process.env.LD_LIBRARY_PATH].filter(Boolean).join(":");
  process.env.FONTCONFIG_PATH = "/tmp/fonts";

  const execPath = await chromium.executablePath();
  console.log("CHROMIUM_BIN:", execPath);

  // --- tiny static server for the media -------------------------------------
  const server = http.createServer((req, res) => {
    const f = path.join(MEDIA, req.url === "/" ? "/player.html" : req.url.split("?")[0]);
    if (!fs.existsSync(f)) { res.writeHead(404); return res.end("nf"); }
    const ext = path.extname(f);
    const mime = { ".webm": "video/webm", ".mp4": "video/mp4", ".html": "text/html" }[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": mime, "Content-Length": fs.statSync(f).size });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise(r => server.listen(8123, "127.0.0.1", r));
  console.log("LOCAL_SERVER: http://127.0.0.1:8123/");

  fs.writeFileSync(path.join(MEDIA, "player.html"), `<!doctype html><html><body style="margin:0;background:#000">
<video id="v" width="1280" height="720" muted autoplay></video>
<script>
  window.STATE = { err: null };
  const v = document.getElementById('v');
  v.src = '/gameplay.webm';
  v.play().catch(e => { STATE.err = String(e); });
  v.addEventListener('error', () => { STATE.err = 'media-error ' + (v.error && v.error.code); });
</script></body></html>`);

  const browser = await puppeteer.launch({
    args: [...chromium.args, "--no-sandbox", "--disable-dev-shm-usage",
           "--autoplay-policy=no-user-gesture-required"],
    executablePath: execPath,
    headless: true,
    defaultViewport: { width: 1280, height: 720 },
  });
  console.log("BROWSER_VERSION:", await browser.version());

  const page = await browser.newPage();

  // --- (2) attempt YouTube ----------------------------------------------------
  try {
    const resp = await page.goto("https://www.youtube.com/@iLondBlocks", { waitUntil: "domcontentloaded", timeout: 20000 });
    console.log("YOUTUBE_HTTP:", resp && resp.status());
  } catch (e) {
    console.log("YOUTUBE_ERROR:", e.message.split("\n")[0]);
  }

  // --- (3) play a real video file inside the browser --------------------------
  await page.goto("http://127.0.0.1:8123/player.html", { waitUntil: "load", timeout: 30000 });
  await new Promise(r => setTimeout(r, 4000));
  const s1 = await page.evaluate(() => {
    const v = document.getElementById("v");
    return { t: v.currentTime, ready: v.readyState, w: v.videoWidth, h: v.videoHeight, paused: v.paused, err: window.STATE.err };
  });
  await page.screenshot({ path: path.join(OUT, "browser-frame-1.png") });
  await new Promise(r => setTimeout(r, 3000));
  const s2 = await page.evaluate(() => {
    const v = document.getElementById("v");
    return { t: v.currentTime, ready: v.readyState, paused: v.paused, err: window.STATE.err };
  });
  await page.screenshot({ path: path.join(OUT, "browser-frame-2.png") });
  console.log("VIDEO_STATE_T0:", JSON.stringify(s1));
  console.log("VIDEO_STATE_T3:", JSON.stringify(s2));
  console.log("PLAYBACK_ADVANCED_SECONDS:", (s2.t - s1.t).toFixed(2));

  await browser.close();
  server.close();
  console.log("DONE");
})().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
