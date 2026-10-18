// browser-test.js — proof that a REAL Chromium runs here, and proof of what
// happens when it tries to reach YouTube from this sandbox.
const chromium = require("@sparticuz/chromium").default;
const puppeteer = require("puppeteer-core");
const fs = require("fs");

(async () => {
  const execPath = await chromium.executablePath();
  console.log("CHROMIUM_BIN:", execPath, fs.existsSync(execPath) ? "(exists)" : "(MISSING)");

  const browser = await puppeteer.launch({
    args: [...chromium.args, "--no-sandbox", "--disable-gpu-sandbox", "--autoplay-policy=no-user-gesture-required"],
    executablePath: execPath,
    headless: true,
    defaultViewport: { width: 1280, height: 720 },
  });

  const page = await browser.newPage();
  console.log("UA:", await browser.userAgent());
  const ver = await browser.version();
  console.log("BROWSER_VERSION:", ver);

  // 1) local page with a playing <video> -> proves the engine renders + decodes
  const html = `<!doctype html><html><body style="margin:0;background:#111">
    <video id="v" width="1280" height="720" muted autoplay loop></video>
    <script>
      window.STATE = {ready: false, err: null};
      const v = document.getElementById('v');
      v.src = 'VIDEO_URL';
      v.play().then(()=>{STATE.ready=true}).catch(e=>{STATE.err=String(e)});
      v.addEventListener('error', ()=>{STATE.err='media error '+ (v.error && v.error.code)});
    </script></body></html>`;
  fs.writeFileSync("/tmp/player.html", html.replace("VIDEO_URL", process.env.VIDEO_URL || ""));

  // 2) try YouTube (expected to fail: host not in sandbox allowlist)
  try {
    const resp = await page.goto("https://www.youtube.com/@iLondBlocks", { waitUntil: "domcontentloaded", timeout: 25000 });
    console.log("YOUTUBE_HTTP:", resp && resp.status());
  } catch (e) {
    console.log("YOUTUBE_ERROR:", e.message.split("\n")[0]);
  }

  await browser.close();
})().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
