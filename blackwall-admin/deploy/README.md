# Deploying Blackwall to the home server

Runs as a Portainer stack on the Linux/Docker box: **Postgres** (source of truth), the **Blackwall app** (panel + API, sign-in required), and a **backup** job. The app listens only on `127.0.0.1`; Tailscale publishes it to your tailnet over HTTPS. Nothing is exposed to the internet.

## 1. Generate secrets (on your Mac, in `blackwall-admin/`)

```bash
node server/cli.ts gen-key          # → BLACKWALL_SECRET_KEY
node server/cli.ts hash-password    # → BLACKWALL_PASSWORD_HASH (prompts; 12+ characters)
openssl rand -base64 24             # → POSTGRES_PASSWORD
openssl rand -base64 24             # → BACKUP_PASSPHRASE
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

Push to `main`, then in Portainer open the stack and choose **Pull and redeploy** (enable rebuilding images). The data in the `db-data` volume and the backups folder is kept.

## Moving existing connections

Connections from a dev machine's `.blackwall/connections.json` can be copied in once:

```bash
DATABASE_URL=postgres://blackwall:<password>@<server>:5432/blackwall BLACKWALL_SECRET_KEY=<key> \
  node server/cli.ts import .blackwall/connections.json
```

(Postgres isn't published by default. Run this inside the app container, or re-enter the connections in the panel.)
