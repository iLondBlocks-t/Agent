#!/usr/bin/env python3
"""VirtIO-serial guest responder used exclusively during automated QEMU integration tests.

Never starts on physical hardware or standard VMs because systemd activates it
only when /dev/virtio-ports/org.nrmaos.qatest is attached by the test runner.
"""

import json
import os
import pwd
import subprocess
import time

PORT_PATH = "/dev/virtio-ports/org.nrmaos.qatest"


def handle_request(req: dict) -> dict:
    action = req.get("action", "ping")
    req_id = req.get("id", "")
    if action == "ping":
        return {"id": req_id, "ok": True, "pong": True, "uptime": time.monotonic()}

    if action == "exec":
        cmd = req.get("cmd")
        if not isinstance(cmd, list) or not cmd:
            return {"id": req_id, "ok": False, "error": "cmd must be a non-empty list"}
        timeout = float(req.get("timeout", 30))
        env = os.environ.copy()
        user = req.get("user")
        run_cmd = cmd
        if user:
            pw = pwd.getpwnam(str(user))
            env["HOME"] = pw.pw_dir
            env["USER"] = pw.pw_name
            env["LOGNAME"] = pw.pw_name
            env["XAUTHORITY"] = f"{pw.pw_dir}/.Xauthority"
            run_cmd = ["runuser", "-u", str(user), "--"] + cmd
        for k, v in (req.get("env") or {}).items():
            env[str(k)] = str(v)
        try:
            proc = subprocess.run(
                run_cmd,
                capture_output=True,
                text=True,
                timeout=timeout,
                env=env,
            )
            return {
                "id": req_id,
                "ok": proc.returncode == 0,
                "returncode": proc.returncode,
                "stdout": proc.stdout[-16384:],
                "stderr": proc.stderr[-16384:],
            }
        except Exception as exc:
            return {"id": req_id, "ok": False, "error": str(exc)}

    return {"id": req_id, "ok": False, "error": f"unknown action: {action}"}


def main() -> None:
    while True:
        if not os.path.exists(PORT_PATH):
            time.sleep(0.5)
            continue
        try:
            fd = os.open(PORT_PATH, os.O_RDWR)
            buf = b""
            while True:
                chunk = os.read(fd, 4096)
                if not chunk:
                    time.sleep(0.1)
                    continue
                buf += chunk
                while b"\n" in buf:
                    line, buf = buf.split(b"\n", 1)
                    line_str = line.decode("utf-8", errors="replace").strip()
                    if not line_str:
                        continue
                    try:
                        req = json.loads(line_str)
                        resp = handle_request(req)
                    except Exception as exc:
                        resp = {"ok": False, "error": f"bad json: {exc}"}
                    payload = (json.dumps(resp) + "\n").encode("utf-8")
                    written = 0
                    while written < len(payload):
                        written += os.write(fd, payload[written:])
        except Exception:
            time.sleep(0.5)


if __name__ == "__main__":
    main()
