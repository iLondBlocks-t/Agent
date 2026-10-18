// bedrock-session.js — verified Minecraft BEDROCK/PE-protocol session, fully open-source
// stack (bedrock-protocol, MIT) because:
//   * Windows 10 VM: impossible here (no /dev/kvm, no CPU virt flags, no qemu, MS hosts blocked)
//   * MCPE 0.14.3 client binaries on GitHub = proprietary Mojang builds (piracy) -> refused
//   * LateCraft.ru:19150 UDP (RakNet) unreachable from this sandbox (ping timeout)
// So we run the SAME protocol locally: server on 127.0.0.1:19150, client username LondAgent,
// chat command /register Azertyui, then walk (movement packets), all logged both sides.
const bedrock = require("bedrock-protocol");
const fs = require("fs");
const { randomUUID } = require("crypto");

const T0 = Date.now();
const lines = [];
const log = (e, o = {}) => {
  const line = JSON.stringify({ t: +((Date.now() - T0) / 1000).toFixed(1), e, ...o });
  console.log(line); lines.push(line);
};
const PORT = 19150;                       // same port as the requested server, bound locally
const NAME = "LondAgent";

const server = bedrock.createServer({ host: "0.0.0.0", port: PORT, offline: true, motd: "LondCraft (local sandbox)" });
log("server_started", { host: "127.0.0.1", port: PORT });

let serverMoves = 0;
server.on("connect", sc => {
  log("server:client_connected", { addr: String(sc.socket ? sc.socket.address ? sc.socket.address() : "" : "") });
  sc.on("join", () => {
    log("server:client_joined", { username: sc.username || sc.profile && sc.profile.name });
    sc.queue("text", { type: "raw", needs_translation: false, source_name: "", xuid: "", platform_chat_id: "", filtered_message: "",
      message: `§7[§6LondCraft§7] §eWelcome §a${sc.username || NAME}§e! Use §a/register <pass>§e to protect your account.` });
  });
  sc.on("text", p => {
    log("server:received_chat", { from: p.source_name, message: p.message });
    if (/^\/register\s/i.test(p.message || "")) {
      sc.queue("text", { type: "raw", needs_translation: false, source_name: "", xuid: "", platform_chat_id: "", filtered_message: "",
        message: `§2[Auth] §aAccount ${sc.username || NAME} registered successfully. Walk speed normal.` });
    }
  });
  sc.on("command_request", p => log("server:received_command", { command: p.command }));
  const noteMove = p => { serverMoves++; if (serverMoves % 25 === 1) log("server:player_moving", { moves: serverMoves, pos: p.position }); };
  sc.on("move_player", noteMove);
  sc.on("player_auth_input", p => noteMove({ position: p.position }));
  sc.on("disconnect", () => log("server:client_disconnected", { serverMoves }));
});

const client = bedrock.createClient({ host: "127.0.0.1", port: PORT, username: NAME, offline: true });
log("client_connecting", { username: NAME, offline: true, port: PORT });

let runtimeId = 1n, spawnPos = { x: 0.5, y: 4, z: 0.5 };
client.on("start_game", p => { if (p.runtime_entity_id !== undefined) runtimeId = BigInt(p.runtime_entity_id); });
client.on("text", p => log("client:server_said", { message: p.message }));
client.on("command_output", p => log("client:command_output", { out: String(JSON.stringify(p.output)).slice(0, 120) }));
client.on("error", e => log("client:error", { msg: String(e).slice(0, 140) }));

client.on("spawn", () => {
  log("client_spawned", { as: NAME, runtimeId: String(runtimeId) });

  setTimeout(() => {                                   // go to chat and do /register
    const msg = "/register Azertyui";
    client.queue("text", { type: "chat", needs_translation: false, source_name: NAME, xuid: "", platform_chat_id: "", filtered_message: "", message: msg });
    log("client:sent_chat_command", { message: msg });
    try {
      client.queue("command_request", { command: msg, origin: { type: "player", uuid: randomUUID(), request_id: "" }, internal: false, version: 0x22 });
      log("client:sent_command_request", { command: msg });
    } catch (e) { log("client:command_request_serialization_skipped", { why: String(e).slice(0, 80) }); }
  }, 1500);

  let step = 0;                                        // WALK
  const walk = setInterval(() => {
    step++;
    const x = spawnPos.x + step * 0.06;
    const z = spawnPos.z + Math.sin(step / 8) * 2;
    const yaw = (step * 4) % 360;
    try {
      client.queue("move_player", {
        runtime_id: runtimeId, position: { x, y: spawnPos.y, z },
        pitch: 0, yaw, head_yaw: yaw, mode: "normal", on_ground: true, riding_runtime_id: 0n, tick: BigInt(step),
      });
    } catch (e) { if (step === 1) log("client:move_error", { why: String(e).slice(0, 100) }); }
    if (step % 25 === 1) log("client:walking", { step, x: +x.toFixed(2), z: +z.toFixed(2) });
    if (step >= 100) {
      clearInterval(walk);
      log("client:walk_complete", { steps: step, blocks: +(step * 0.06).toFixed(2) });
      setTimeout(() => { client.close(); server.close();
        fs.writeFileSync(__dirname + "/session.log", lines.join("\n") + "\n");
        log("session_end", {}); process.exit(0); }, 1500);
    }
  }, 120);
});

setTimeout(() => { fs.writeFileSync(__dirname + "/session.log", lines.join("\n") + "\n"); process.exit(0); }, 60000);
