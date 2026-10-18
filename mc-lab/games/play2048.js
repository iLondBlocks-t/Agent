// play2048.js — PRO bot plays gabrielecirulli/2048 (MIT) in headless Chromium,
// recorded via CDP Page.startScreencast. The director SEEs the board through the DOM
// (tile values + positions + score), DECIDEs with an expectimax search (depth 3),
// ACTs by dispatching real keydown events. Log: output/ai-2048.log
const __chr = require("/home/user/Agent/mc-lab/browser/node_modules/@sparticuz/chromium/build/index.js");
const chromium = __chr.default, inflate = __chr.inflate;
const puppeteer = require("/home/user/Agent/mc-lab/browser/node_modules/puppeteer-core");
const http = require("http"), fs = require("fs"), path = require("path");
const ROOT = "/home/user/Agent/mc-lab/games/g2048";
const FRAMES = "/home/user/Agent/mc-lab/games/frames2048";
const OUT = "/home/user/Agent/mc-lab/output";
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".ico": "image/x-icon", ".woff": "font/woff", ".woff2": "font/woff2" };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = [];
const L = (...a) => { const s = `[${new Date().toISOString()}] ` + a.join(" "); log.push(s); console.log(s); };

// ---------------- solver: expectimax depth 3 over log2 board ----------------
const DIRS = [{ dx: 0, dy: -1 }, { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }]; // 0 up,1 right,2 down,3 left
function slide(row) { // slide+merge left; returns [newRow, gained, moved]
  const a = row.filter(v => v); let gained = 0, moved = false;
  for (let i = 0; i < a.length - 1; i++) if (a[i] === a[i + 1]) { a[i] *= 2; gained += a[i]; a.splice(i + 1, 1); }
  while (a.length < 4) a.push(0);
  for (let i = 0; i < 4; i++) if (a[i] !== row[i]) moved = true;
  return [a, gained, moved];
}
function lines(g, d) { // extract 4 lines oriented so that slide() = move in direction d
  const out = [];
  for (let i = 0; i < 4; i++) {
    let ln = [];
    for (let j = 0; j < 4; j++) {
      const [r, c] = d === 3 ? [i, j] : d === 1 ? [i, 3 - j] : d === 0 ? [j, i] : [3 - j, i];
      ln.push(g[r][c]);
    }
    out.push(ln);
  }
  return out;
}
function applyMove(g, d) {
  const ls = lines(g, d); const ng = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
  let gained = 0, moved = false;
  ls.forEach((ln, i) => {
    const [nl, gn, mv] = slide(ln); gained += gn; moved = moved || mv;
    for (let j = 0; j < 4; j++) {
      const [r, c] = d === 3 ? [i, j] : d === 1 ? [i, 3 - j] : d === 0 ? [j, i] : [3 - j, i];
      ng[r][c] = nl[j];
    }
  });
  return { g: ng, gained, moved };
}
function heur(g) {
  let empty = 0, mono = 0, smooth = 0, maxV = 0;
  const lg = g.map(r => r.map(v => v ? Math.log2(v) : 0));
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
    const v = g[r][c]; if (!v) empty++; if (v > maxV) maxV = v;
    if (c < 3) smooth -= Math.abs(lg[r][c] - lg[r][c + 1]);
    if (r < 3) smooth -= Math.abs(lg[r][c] - lg[r + 1][c]);
  }
  { // monotonicity: count consistently ordered neighbour pairs (horizontal + vertical)
    let inc = 0, dec = 0;
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
      if (lg[i][j] <= lg[i][j + 1]) inc++; if (lg[i][j] >= lg[i][j + 1]) dec++;
    }
    for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) {
      if (lg[i][j] <= lg[i + 1][j]) inc++; if (lg[i][j] >= lg[i + 1][j]) dec++;
    }
    mono = Math.max(inc, dec);
  }
  const corner = (lg[0][0] === Math.max(...lg.flat())) ? 1 : 0;
  return empty * 2.7 + smooth * 0.15 + mono * 0.9 + corner * 1.0 + (maxV ? Math.log2(maxV) * 0.5 : 0);
}
function chance(g, depth) {
  const cells = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) if (!g[r][c]) cells.push([r, c]);
  if (!cells.length) return search(g, depth - 1);
  const pick = cells.length > 5 ? cells.filter((_, i) => i % Math.ceil(cells.length / 5) === 0) : cells;
  let s = 0;
  for (const [r, c] of pick) {
    for (const [v, p] of [[2, 0.9], [4, 0.1]]) {
      const ng = g.map(row => row.slice()); ng[r][c] = v;
      s += p * search(ng, depth - 1);
    }
  }
  return s / pick.length;
}
function search(g, depth) {
  if (depth <= 0) return heur(g);
  let best = -1e9, any = false;
  for (let d = 0; d < 4; d++) {
    const { g: ng, moved } = applyMove(g, d);
    if (!moved) continue;
    any = true;
    best = Math.max(best, chance(ng, depth));
  }
  return any ? best : -1e8;
}
function bestMove(g) {
  let best = -1e9, bd = -1;
  for (let d = 0; d < 4; d++) {
    const { g: ng, moved } = applyMove(g, d);
    if (!moved) continue;
    const s = chance(ng, 3);
    if (s > best) { best = s; bd = d; }
  }
  return bd;
}
const DIRNAME = ["UP", "RIGHT", "DOWN", "LEFT"];

(async () => {
  fs.rmSync(FRAMES, { recursive: true, force: true }); fs.mkdirSync(FRAMES, { recursive: true });
  await inflate("/home/user/Agent/mc-lab/browser/node_modules/@sparticuz/chromium/bin/al2023.tar.br");
  process.env.LD_LIBRARY_PATH = ["/tmp/al2023/lib", "/tmp", process.env.LD_LIBRARY_PATH].filter(Boolean).join(":");
  process.env.FONTCONFIG_PATH = "/tmp/fonts";
  const server = http.createServer((req, res) => {
    const f = path.join(ROOT, req.url === "/" ? "/index.html" : req.url.split("?")[0]);
    if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream" });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise(r => server.listen(8126, "127.0.0.1", r));
  const browser = await puppeteer.launch({
    args: [...chromium.args, "--no-sandbox", "--disable-dev-shm-usage", "--enable-unsafe-swiftshader", "--mute-audio"],
    executablePath: await chromium.executablePath(), headless: true, protocolTimeout: 60000,
    userDataDir: "/tmp/g2048-profile", defaultViewport: { width: 800, height: 640 },
  });
  const page = await browser.newPage();
  await page.goto("http://127.0.0.1:8126/", { waitUntil: "load", timeout: 60000 });
  await sleep(2500);
  L("BOOT 2048 loaded");

  const meta = []; let n = 0, saving = Promise.resolve();
  const cdp = await page.target().createCDPSession();
  await cdp.send("Page.enable");
  cdp.on("Page.screencastFrame", ev => {
    const i = n++;
    meta.push({ file: String(i).padStart(5, "0") + ".jpg", ts: ev.metadata && ev.metadata.timestamp });
    saving = saving.then(() => fs.promises.writeFile(path.join(FRAMES, String(i).padStart(5, "0") + ".jpg"), Buffer.from(ev.data, "base64")));
    cdp.send("Page.screencastFrameAck", { sessionId: ev.sessionId }).catch(() => {});
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 70, maxWidth: 800, maxHeight: 640, everyNthFrame: 1 });
  L("CAST ON");

  const read = () => page.evaluate(() => {
    const g = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
    document.querySelectorAll(".tile").forEach(el => {
      let r = -1, c = -1, v = 0;
      el.classList.forEach(cl => {
        const m = cl.match(/^tile-position-(\d)-(\d)$/); if (m) { c = +m[1] - 1; r = +m[2] - 1; }  // x=col, y=row
        const m2 = cl.match(/^tile-(\d+)$/); if (m2) v = +m2[1];
      });
      if (r >= 0 && v) g[r][c] = Math.max(g[r][c], v);   // merged leftovers overlap: keep max
    });
    const s = document.querySelector(".score-container");
    const stxt = s ? ((s.childNodes[0] && s.childNodes[0].textContent) || s.textContent || "") : "";
    const msg = document.querySelector(".game-message");
    return { g, score: parseInt(String(stxt).replace(/\D/g, ""), 10) || 0,
             won: !!(msg && msg.classList.contains("game-won")), over: !!(msg && msg.classList.contains("game-over")) };
  });
  const key = d => page.evaluate(dd => {
    const code = { 0: 38, 1: 39, 2: 40, 3: 37 }[dd];
    const e = new KeyboardEvent("keydown", { bubbles: true, cancelable: true });
    Object.defineProperty(e, "which", { value: code }); Object.defineProperty(e, "keyCode", { value: code });
    document.dispatchEvent(e);
  }, d);

  const t0 = Date.now(); let moves = 0, lastScore = 0, lastTile = 0;
  while (Date.now() - t0 < 52000) {
    const st = await read();
    if (st.won) { L("SEE 2048 tile reached -> click Keep Going (pro continues)"); await page.click(".keep-playing-button").catch(() => {}); await sleep(300); continue; }
    if (st.over) { L("SEE game over at score", st.score); break; }
    const maxT = Math.max(...st.g.flat());
    const d = bestMove(st.g);
    if (d < 0) { L("SEE no legal move; score", st.score); break; }
    if (moves % 20 === 0 || maxT !== lastTile)
      L("SEE score", st.score, "maxTile", maxT, "| DECIDE", DIRNAME[d], "| ACT keydown");
    lastTile = maxT; lastScore = st.score;
    await key(d); moves++;
    await sleep(140);
  }
  const fin = await read();
  L("FINAL score", fin.score, "maxTile", Math.max(...fin.g.flat()), "moves", moves, "elapsed_s", ((Date.now() - t0) / 1000).toFixed(1));
  await page.screenshot({ path: "/home/user/Agent/mc-lab/games/final-2048.png" });
  await cdp.send("Page.stopScreencast").catch(() => {}); await saving;
  fs.writeFileSync(path.join(FRAMES, "meta.json"), JSON.stringify(meta));
  L("CAST OFF frames:", meta.length);
  await browser.close(); server.close();
  fs.writeFileSync(path.join(OUT, "ai-2048.log"), log.join("\n") + "\n");
  console.log("DONE");
})().catch(e => { console.error("FATAL:", e.message); fs.writeFileSync("/home/user/Agent/mc-lab/output/ai-2048.log", log.join("\n") + "\nFATAL " + e.message + "\n"); process.exit(1); });
