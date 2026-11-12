# Mikoshi capabilities

Mikoshi is the home server that runs Blackwall's server, Postgres and Nextcloud, and the machine the Mac and Android apps lean on. This page is the log of what it can do, so a feature can be planned against real numbers (for example, whether an office-document server fits) instead of guesses.

## How to refresh this page

Run the read-only inventory script on Mikoshi. It changes nothing, needs no sudo and prints no passwords or environment variables.

```bash
ssh <your-user>@mikoshi 'bash -s' < docs/mikoshi/mikoshi-inventory.sh
```

Paste the output below as a new entry in the **Log**, then update **Current picture**. Repeat after hardware changes, after adding a big service, and before planning anything heavy.

## Current picture

_Not measured yet. Run the script and fill this in._

| Resource | Value | Notes |
| --- | --- | --- |
| Machine | | |
| CPU (model, cores/threads) | | |
| Memory (total / typically free) | | |
| Swap | | |
| Disks (size, type, free) | | SSD or spinning disk matters for Nextcloud and Postgres |
| GPU / hardware video | | |
| Network (link speed, Tailscale) | | |
| Docker | | |

### What runs on it

| Service | Container | Memory in use | Notes |
| --- | --- | --- | --- |
| Blackwall server | | | |
| Postgres | | | |
| Backup job | | | |
| Nextcloud (and its database) | | | |
| Other | | | |

## What this means for planned work

Approximate planning figures from the products' own guidance, to be checked against the table above and replaced with measured numbers once each service is installed.

| Planned | Rough memory to budget | Decision it feeds |
| --- | --- | --- |
| Office editing inside Nextcloud (Collabora or OnlyOffice) | about 1 to 2 GB for Collabora, 2 to 4 GB for OnlyOffice, plus extra per open document | Whether to run it on Mikoshi, and which one |
| Blackwall's own document editor | none on the server (runs in the app) | Keeps the server light; the Nextcloud editor is the bridge until it exists |
| More services on Mikoshi | measured in the log | Leave headroom: aim to keep at least 25% of memory free at rest |

## Log

Newest first. Paste the script's output under a dated heading.

_No entries yet._
