# One-Click nrmaOS Remote Desktop over Tailscale (GitHub Actions)

This guide walks you step by step through starting a real, live **nrmaOS** desktop inside GitHub Actions and connecting to it privately from your **Android phone** or **Windows / Linux / macOS computer** over **Tailscale**.

No ports are ever opened to the public internet, Tailscale Funnel is never used, and every run boots the genuine nrmaOS Qt 6/QML desktop (`nrmaos-shell` + `xrdp`/`xorgxrdp`) with a fresh one-time password.

---

## How It Works

```text
Your Phone / PC (Tailscale ON)
   └──► Your Private Tailnet (100.x.y.z:3389)
          └──► GitHub Actions Runner (tailscale serve raw TCP)
                 └──► 127.0.0.1:13389 (loopback-only QEMU port forward)
                        └──► QEMU/KVM Guest UFW (allows 10.0.2.2/32 only)
                               └──► nrmaOS xrdp + TLS 1.2/1.3 ──► nrmaOS Desktop
```

---

## Step 1: Configure Your Tailnet Tag & OAuth Client (One-Time Setup)

1. Sign in to the **[Tailscale Admin Console](https://login.tailscale.com/admin)**.
2. **Define the `tag:nrmaos-ci` tag** so ephemeral GitHub Actions runners can join your Tailnet without manual approval prompts:
   - Open **Access controls** in the Tailscale Admin Console.
   - Inside `tagOwners` (JSON/HuJSON policy), add `"tag:nrmaos-ci"`:
     ```json
     "tagOwners": {
       "tag:nrmaos-ci": ["autogroup:admin"]
     }
     ```
   - Ensure your personal devices (for example `autogroup:admin` or `autogroup:member`) are allowed to connect to `tag:nrmaos-ci:3389` in your `acls` / `grants` rules (Tailscale's default "allow all within tailnet" rule already permits this).
   - Click **Save**.

3. **Create a Tailscale OAuth Client (Recommended)**:
   - Open **Settings → Trust credentials → OAuth clients** (or **Settings → OAuth clients**).
   - Click **Generate OAuth client**.
   - Under **Scopes → Keys → Auth Keys**, enable **Write** (`auth_keys` write scope) and select **`tag:nrmaos-ci`**.
   - Click **Generate client** and copy the **Client ID** and **Client Secret**.
   - *(Note: Nodes created through `tailscale/github-action@v4` with an OAuth client are automatically marked **ephemeral** and **pre-approved**, so they work seamlessly even if Device Approval is enabled on your Tailnet, and automatically disappear after the workflow ends.)*

   **Alternative Option — Ephemeral Tagged Auth Key**:
   - If you prefer an auth key instead of OAuth, open **Settings → Keys → Generate auth key**:
     - Enable **Reusable** and **Ephemeral**
     - Enable **Pre-approved** (if Device Approval is turned on in your Tailnet)
     - Add tag **`tag:nrmaos-ci`**
     - Copy the `tskey-auth-...` key.

---

## Step 2: Create Your Local Encryption Key (Required if Your GitHub Repo Is Public)

Because **public GitHub repositories** allow anyone on the internet to view workflow logs, summaries, and artifacts, nrmaOS **never** prints or uploads a plaintext password on a public repository. Instead, it encrypts your one-time password with **[`age`](https://github.com/FiloSottile/age)** using your public key, while your private key stays safely on your own computer or phone.

1. **Install `age` on your computer or phone**:
   - **Windows (PowerShell)**: `winget install FiloSottile.age`
   - **Ubuntu / Debian**: `sudo apt install age`
   - **macOS**: `brew install age`
   - **Android (Termux)**: `pkg install age unzip`

2. **Generate your keypair locally**:
   ```bash
   age-keygen -o ~/nrmaos-rdp-key.txt
   ```
   You will see output similar to:
   ```text
   Public key: age1ql3z7hjy54pw3hyww5ayyfg7zqgvc7w3j2elw8zmrj2kg5sfn9aqmcac8p
   ```
   - **Keep `~/nrmaos-rdp-key.txt` private on your device. Never upload it to GitHub.**
   - Copy **only** the `age1...` **Public key**.

*(If your GitHub repository is **Private**, this step is optional — nrmaOS can show the one-time password inside a collapsed box in the authenticated GitHub Job Summary, with a reminder that repository collaborators who have Actions access can also view that summary.)*

---

## Step 3: Add Secrets and Variables in GitHub

Open your repository on GitHub and go to **Settings → Secrets and variables → Actions**:

### A. Under the **Secrets** tab → **New repository secret**:

Add **Option 1 (Recommended OAuth Client)**:
- `TS_OAUTH_CLIENT_ID` → paste your Tailscale OAuth Client ID
- `TS_OAUTH_SECRET` → paste your Tailscale OAuth Client Secret

*(Or **Option 2 — Workload Identity / OIDC**: set `TS_OAUTH_CLIENT_ID` and `TS_AUDIENCE`.)*  
*(Or **Option 3 — Auth Key**: set `TAILSCALE_AUTHKEY` to your `tskey-auth-...` key.)*

### B. Under the **Variables** tab → **New repository variable** (Required for public repos):
- **Name**: `NRMAOS_AGE_RECIPIENT`
- **Value**: paste your `age1...` public key from Step 2

---

## Step 4: Run the One-Click Workflow

1. Open your repository on GitHub.
2. Click the **Actions** tab at the top.
3. In the left sidebar, select **nrmaOS Remote Desktop**.
4. Click **Run workflow** → **Run workflow** (all inputs already have ready-to-use defaults).
5. Wait until step **`Boot nrmaOS in Headless QEMU, Provision RDP & Configure Tailscale Serve`** finishes:
   - ~1–2 minutes if an ISO artifact already exists for the current commit, or ~8–9 minutes if GitHub Actions builds the ISO fresh from source.

---

## Step 5: Find Your IP, Hostname, Username & One-Time Password

Click on the running **nrmaOS Remote Desktop** workflow run and look at the **Summary** page:

1. You will see a table titled **`nrmaOS Remote Desktop — ONLINE`** containing:
   - **Tailscale Device Name**: `nrmaos-rdp-<RUN_ID>`
   - **Tailscale IPv4**: `100.x.y.z`
   - **MagicDNS Hostname**: `nrmaos-rdp-<RUN_ID>.<your-tailnet>.ts.net` (if MagicDNS is enabled)
   - **RDP Address**: `<TAILSCALE_IP>:3389`
   - **RDP Username**: `nrma`
   - **TLS Certificate SHA-256**: the exact fingerprint of the VM's freshly generated TLS certificate
2. **Get your one-time password**:
   - **Public repository (or whenever `NRMAOS_AGE_RECIPIENT` is set)**:
     1. Scroll to the **Artifacts** section on the same workflow Summary page and download **`nrmaos-rdp-credentials-<RUN_ID>`** (available immediately while the session is running).
     2. Decrypt it locally on your computer or Termux:
        ```bash
        # Using the included helper script (accepts the .zip directly):
        ./scripts/decrypt-rdp-credentials.sh ~/Downloads/nrmaos-rdp-credentials-*.zip ~/nrmaos-rdp-key.txt

        # Or on any machine without cloning the repo:
        unzip -p ~/Downloads/nrmaos-rdp-credentials-*.zip '*.age*' | age -d -i ~/nrmaos-rdp-key.txt
        ```
   - **Private repository (without `NRMAOS_AGE_RECIPIENT`)**:
     - Click **"Click to reveal one-time RDP password"** directly inside the workflow **Summary** page.

---

## Step 6: Connect from Android

1. Install **Tailscale** from Google Play / F-Droid, sign in to the **same Tailnet**, and toggle **Connected** ON.
2. Install **Windows App (Microsoft Remote Desktop)** or **aFreeRDP**.
3. Tap **`+` → Add PC**:
   - **PC name**: enter `<TAILSCALE_IP>:3389` (for example `100.94.12.34:3389`) or `<MAGICDNS_NAME>:3389`.
   - **User account**: enter username **`nrma`** and your decrypted one-time password.
4. Tap the PC card to connect, verify/accept the TLS certificate fingerprint shown in the GitHub Summary, and enjoy your live **nrmaOS** desktop!

---

## Step 7: Connect from Windows

1. Ensure the **Tailscale** app on Windows is signed in and **Connected**.
2. Press `Win + R`, type **`mstsc`**, and press **Enter** to open **Remote Desktop Connection**.
3. In **Computer**, enter `<TAILSCALE_IP>:3389` (for example `100.94.12.34:3389`) and click **Connect**.
4. Enter:
   - **User name**: `nrma`
   - **Password**: your one-time password
5. Confirm the TLS certificate prompt (matching the SHA-256 fingerprint in the workflow Summary) to enter your **nrmaOS** desktop session.

*(You can disconnect and reconnect at any time while the workflow run is still active — `xrdp-sesman` preserves your running nrmaOS session.)*

---

## Why the Session Stops When the GitHub Actions Job Ends

- The nrmaOS QEMU virtual machine runs inside a temporary GitHub-hosted `ubuntu-24.04` runner.
- **GitHub-hosted runners enforce a hard 6-hour (360-minute) maximum job lifetime.** Setting larger numbers in YAML cannot bypass GitHub's platform limit, so the workflow defaults to **330 minutes** (5.5 hours) and then shuts down cleanly before GitHub force-terminates the VM.
- Because the Live ISO boots in ephemeral memory and the Tailscale node is registered as **ephemeral**, cancelling the workflow (via **Cancel workflow** at the top right) or reaching the time limit immediately stops QEMU, resets Tailscale Serve, removes the `nrmaos-rdp-<RUN_ID>` node from your Tailnet, and wipes all temporary credentials.

---

## Using Native Tailscale on an Installed nrmaOS System

nrmaOS also ships the official `tailscale` package (disconnected by default, with zero pre-baked keys) for physical PCs and persistent VMs:

1. Open **nrma Settings → Tailscale VPN** and click **Connect to Tailscale**.
2. Open or copy the displayed `https://login.tailscale.com/a/...` link to authorize your machine.
3. Click **Restrict RDP Firewall to `tailscale0`** (or select **Tailscale Only (`tailscale0` interface)** under **Settings → Remote Desktop**) so `ufw` permits RDP traffic exclusively through your encrypted `tailscale0` interface.
