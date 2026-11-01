# Deploying Blackwall to the home server

Runs as a Portainer stack on the Linux/Docker box: **Postgres** (source of truth), the **Blackwall app** (panel + API, sign-in required), and a **backup** job. The app listens only on `127.0.0.1`; Tailscale publishes it to your tailnet over HTTPS. Nothing is exposed to the internet.

## 1. Generate secrets (on your Mac, in `blackwall-admin/`)

```bash
node server/cli.ts gen-key          # → BLACKWALL_SECRET_KEY
node server/cli.ts hash-password    # → BLACKWALL_PASSWORD_HASH (prompts; 12+ characters)
openssl rand -hex 24                # → POSTGRES_PASSWORD (hex: it goes inside a URL, where / or + would break it)
openssl rand -hex 24                # → BACKUP_PASSPHRASE
```

Put **BLACKWALL_SECRET_KEY** and **BACKUP_PASSPHRASE** in your password manager. Stored tokens are encrypted with the key, and backups with the passphrase: lose them and those can't be recovered.

## 2. Prepare the server

```bash
sudo mkdir -p /opt/blackwall/backups
```

## 3. Create the stack in Portainer

**Stacks → Add stack → Repository**

| Field | Value |
| --- | --- |
| Repository URL | `https://github.com/BCnD-Labs/bcndlabsadmin` |
| Reference | `refs/heads/main` |
| Compose path | `blackwall-admin/deploy/docker-compose.yml` |
| Authentication | On: username `BCnD-Labs`, password = a fine-grained token with **Contents: Read** on this repo |

Under **Environment variables**, add everything from [`.env.example`](./.env.example) and fill in the values from step 1. Then **Deploy the stack**. The first deploy builds two images, which takes a few minutes.

## 4. Publish it on your tailnet

On the server:

```bash
sudo tailscale serve --bg --https=443 http://127.0.0.1:8780
tailscale serve status          # shows https://<server>.<tailnet>.ts.net
```

Set `BLACKWALL_ALLOWED_HOSTS` in the stack to that hostname (e.g. `homelab.tail1234.ts.net`) and update the stack. If port 443 is already taken by another `serve` entry, use `--https=8443` and include the port: `homelab.tail1234.ts.net:8443`.

## 5. Check it

Open `https://<server>.<tailnet>.ts.net` from any device on your tailnet and sign in. In **Settings → Server & backups** you should see the Postgres store and, within a minute of the first start, a backup.

To take a backup right away:

```bash
docker exec blackwall-backup-1 backup.sh once
```

## Backups

- **Local:** an encrypted `pg_dump` lands in `/opt/blackwall/backups` every `BACKUP_INTERVAL_HOURS` (default 24) and is kept for `BACKUP_KEEP_DAYS` (default 14).
- **Off-site (optional):** each backup is also copied with rclone to the remote in `BACKUP_OFFSITE` and kept for `BACKUP_OFFSITE_KEEP_DAYS` (default 60). Unencrypted dumps are never uploaded.
  - **Cloudflare R2:** create a bucket, then an R2 API token with Object Read & Write on that bucket. Use the `OFFSITE_*` values shown for R2 in `.env.example`.
  - **Azure Blob (Azure for Students):** create a storage account and a container, copy an access key, and use the Azure values.
- The panel shows the last result, local copies, and the off-site status. A backup older than 36 hours is flagged as overdue.

**Restore:**

```bash
docker exec -it blackwall-backup-1 restore.sh /backups/blackwall-<timestamp>.dump.enc
```

Then restart the `app` container. To restore on a fresh server, deploy the stack with the **same** `BLACKWALL_SECRET_KEY` and `BACKUP_PASSPHRASE`, copy the file into `/opt/blackwall/backups`, and run the same command.

## Updating

**From the panel (once set up):** Settings → General shows the running version, checks GitHub for a newer one, and shows **Update now** when a newer version is found. Behind the button, the app calls the stack's Portainer webhook; Portainer pulls `main`, rebuilds the images and recreates the containers. The page follows along and asks you to refresh when the new version is up. Data in the `db-data` volume and the backups folder is kept.

**By hand:** in Portainer open the stack and choose **Pull and redeploy**. Every redeploy rebuilds the images: the `app` and `backup` services set `pull_policy: build`, because otherwise Compose would reuse the existing `blackwall-app:latest` image and a redeploy would pull the new code but keep running the old build.

### Setting up updates from the panel

1. **Turn on the webhook.** Portainer → Stacks → blackwall → in the Git section turn on **GitOps updates**, choose **Webhook** as the mechanism, and save. Copy the webhook URL it shows (`…/api/stacks/webhooks/<id>`). Anyone with this URL can make Portainer redeploy this stack (nothing else), so keep it with your other secrets.
2. **Point it at Portainer from inside the stack.** The app reaches the server itself as `host.docker.internal`. Replace the host in the URL with it and keep Portainer's port, e.g. `https://host.docker.internal:9443/api/stacks/webhooks/<id>`. Portainer's HTTPS port uses a self-signed certificate, so also set `BLACKWALL_UPDATE_INSECURE_TLS=1` (it only applies to this one request). If Portainer's plain HTTP port 9000 is published, `http://host.docker.internal:9000/…` works without that.
   Test from the server: `docker exec blackwall-app-1 wget -qO- --no-check-certificate https://host.docker.internal:9443/api/system/status` should print Portainer's version.
3. **Let it check GitHub.** `BLACKWALL_UPDATE_GITHUB_TOKEN` is a fine-grained token with **Contents: Read-only** on this repo (the same kind Portainer uses to clone; reusing that token is fine).
4. Add the variables to the stack and **Update the stack**:

| Variable | Value |
| --- | --- |
| `BLACKWALL_UPDATE_WEBHOOK` | The webhook URL from step 2 |
| `BLACKWALL_UPDATE_INSECURE_TLS` | `1` when the URL is `https://…:9443` |
| `BLACKWALL_UPDATE_GITHUB_TOKEN` | The read-only token |
| `BLACKWALL_UPDATE_REPO`, `BLACKWALL_UPDATE_REF` | Only if you deploy from another repo or branch (defaults: `BCnD-Labs/bcndlabsadmin`, `main`) |

**How the version check works.** Portainer deletes `.git` when it clones, so there's no commit number inside the image. Instead the Docker build computes the Git *tree hash* of `blackwall-admin/` from the files themselves (`build-info.json`). GitHub reports the same hash for that folder when the code is identical, so the panel compares the two. Changes outside `blackwall-admin/` (docs, design references) don't count as updates.

## Moving existing connections

Connections from a dev machine's `.blackwall/connections.json` can be copied in once:

```bash
DATABASE_URL=postgres://blackwall:<password>@<server>:5432/blackwall BLACKWALL_SECRET_KEY=<key> \
  node server/cli.ts import .blackwall/connections.json
```

(Postgres isn't published by default. Run this inside the app container, or re-enter the connections in the panel.)
