#!/usr/bin/env node
/**
 * Optional lightweight execution backend for the "Terminal" tool.
 *
 * Security model:
 *  - Optional bearer token (EXEC_TOKEN).
 *  - Every request runs inside a fresh temp workspace directory.
 *  - Hard timeout + output size cap.
 *  - Blocklist for obviously destructive commands.
 *  - CORS enabled so the Android WebView can call it directly.
 *
 * Run:  EXEC_TOKEN=mysecret node server/index.js      (default port 8787)
 */
import http from 'node:http';
import { exec } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PORT = Number(process.env.PORT || 8787);
const TOKEN = process.env.EXEC_TOKEN || '';
const MAX_OUTPUT = 200_000;
const MAX_TIMEOUT = 300_000;

const BLOCKED = [/rm\s+-rf\s+\/(?!tmp)/, /mkfs/, /shutdown/, /reboot/, /:\(\)\{:\|:&\};:/, /dd\s+if=/, /\/etc\/(passwd|shadow)/];

const WORKROOT = path.join(os.tmpdir(), 'maao-workspace');
fs.mkdirSync(WORKROOT, { recursive: true });

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
}

function send(res, status, body) {
  cors(res);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => {
      data += c;
      if (data.length > 5_000_000) { reject(new Error('payload too large')); req.destroy(); }
    });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function authorized(req) {
  if (!TOKEN) return true;
  return req.headers.authorization === `Bearer ${TOKEN}`;
}

function safeJoin(base, target) {
  const p = path.resolve(base, target.replace(/^\/+/, ''));
  if (!p.startsWith(base)) throw new Error('path escapes workspace');
  return p;
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') { cors(res); res.writeHead(204); res.end(); return; }
  if (req.url === '/health') return send(res, 200, { ok: true, version: '1.0.0' });
  if (!authorized(req)) return send(res, 401, { error: 'unauthorized' });

  try {
    if (req.method === 'POST' && req.url === '/write') {
      const { path: rel, content } = await readBody(req);
      if (!rel) return send(res, 400, { error: 'path required' });
      const target = safeJoin(WORKROOT, String(rel));
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, String(content ?? ''), 'utf8');
      return send(res, 200, { ok: true, path: path.relative(WORKROOT, target) });
    }

    if (req.method === 'POST' && req.url === '/exec') {
      const { command, timeoutMs } = await readBody(req);
      if (!command || typeof command !== 'string') return send(res, 400, { error: 'command required' });
      if (BLOCKED.some((r) => r.test(command))) return send(res, 403, { error: 'command blocked' });
      const timeout = Math.min(MAX_TIMEOUT, Number(timeoutMs) || 60_000);

      const result = await new Promise((resolve) => {
        exec(command, { cwd: WORKROOT, timeout, maxBuffer: MAX_OUTPUT, env: { ...process.env, EXEC_TOKEN: undefined }, shell: '/bin/bash' },
          (err, stdout, stderr) => resolve({
            exitCode: err ? (typeof err.code === 'number' ? err.code : 1) : 0,
            stdout: String(stdout).slice(0, MAX_OUTPUT),
            stderr: String(stderr || (err ? err.message : '')).slice(0, MAX_OUTPUT),
            timedOut: !!(err && err.killed),
          }));
      });
      return send(res, 200, result);
    }

    if (req.method === 'GET' && req.url === '/files') {
      const list = [];
      const walk = (dir) => {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
          const p = path.join(dir, e.name);
          if (e.isDirectory()) walk(p); else list.push(path.relative(WORKROOT, p));
        }
      };
      walk(WORKROOT);
      return send(res, 200, { files: list });
    }

    return send(res, 404, { error: 'not found' });
  } catch (e) {
    return send(res, 500, { error: String(e.message || e) });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[exec-server] listening on http://0.0.0.0:${PORT} — workspace: ${WORKROOT}`);
  if (!TOKEN) console.warn('[exec-server] WARNING: EXEC_TOKEN not set — anyone with the URL can execute commands.');
});
