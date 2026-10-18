// Injected BEFORE page scripts (evaluateOnNewDocument).
// Taps every WebAudio graph: whatever a node connects to ctx.destination is also
// connected to a MediaStreamDestination, which a MediaRecorder captures.
// Result: real game audio captured in-page, independent of --mute-audio.
(function () {
  "use strict";
  window.__aud = { state: "idle", chunks: 0, mime: "" };
  var destMap = (window.__destMap = new Map());
  var OrigAC = window.AudioContext || window.webkitAudioContext;
  if (!OrigAC) return;

  // patch connect once, globally
  var oc = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (dest) {
    var extra = dest && destMap.get(dest);
    if (extra) { try { oc.call(this, extra); } catch (e) {} }
    return oc.apply(this, arguments);
  };

  function hook(ctx) {
    try {
      var md = ctx.createMediaStreamDestination();
      destMap.set(ctx.destination, md);
      window.__aud.ctx = ctx; window.__aud.md = md;
      var mime = "";
      ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"].forEach(function (m) {
        if (!mime && window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)) mime = m;
      });
      window.__aud.mime = mime;
      if (!mime) { window.__aud.state = "no-mime"; return; }
      var rec = new MediaRecorder(md.stream, { mimeType: mime });
      window.__aud.rec = rec;
      window.__aud.blobs = [];
      rec.ondataavailable = function (e) { if (e.data && e.data.size) window.__aud.blobs.push(e.data); };
      rec.onstop = function () { window.__aud.state = "stopped"; };
      rec.start(500);
      window.__aud.state = "recording";
    } catch (e) { window.__aud.state = "err:" + e.message; }
  }

  function wrap(AC) {
    return function () {
      var ctx = new AC(arguments[0]);
      hook(ctx);
      return ctx;
    };
  }
  window.AudioContext = wrap(OrigAC);
  if (window.webkitAudioContext) window.webkitAudioContext = wrap(window.webkitAudioContext);

  window.__audStop = function () {
    return new Promise(function (res) {
      var rec = window.__aud.rec;
      if (!rec || rec.state === "inactive") { res(false); return; }
      rec.onstop = function () { window.__aud.state = "stopped"; res(true); };
      rec.stop();
    });
  };
  window.__audDump = async function () {
    var b = new Blob(window.__aud.blobs || [], { type: window.__aud.mime || "audio/webm" });
    if (!b.size) return { bytes: 0, b64: "" };
    var buf = await b.arrayBuffer();
    var u8 = new Uint8Array(buf), s = "", CH = 0x8000;
    for (var i = 0; i < u8.length; i += CH) s += String.fromCharCode.apply(null, u8.subarray(i, i + CH));
    return { bytes: b.size, mime: b.type, b64: btoa(s) };
  };
})();
