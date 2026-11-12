# Mikoshi capabilities

Mikoshi is the home server that runs Blackwall's server, Postgres, Nextcloud and the rest of the home services, and the machine the Mac and Android apps lean on. This page is the log of what it can do, so a feature can be planned against real numbers (for example, whether an office-document server fits) instead of guesses.

## How to refresh this page

Run the read-only inventory script on Mikoshi. It changes nothing, needs no sudo and prints no passwords or environment variables.

```bash
ssh <your-user>@mikoshi 'bash -s' < docs/mikoshi/mikoshi-inventory.sh
```

(Replace `<your-user>` with your login name on Mikoshi, without the brackets. The file is on the Mac, so run this on the Mac, or copy the script to Mikoshi and run it with `bash`.)

Update **Current picture**, then add a dated entry to the **Log**. Do not paste the raw output into the repo: it contains network addresses and your Tailscale hostname, which the repo keeps out of files. Summarize it instead. Repeat after hardware changes, after adding a big service, and before planning anything heavy.

## Current picture (2026-11-12)

| Resource | Value | Notes |
| --- | --- | --- |
| Machine | HP OMEN 17 laptop (17-an0xx), bare metal | A laptop: its battery works as a small built-in UPS, but lid, sleep and power settings should be checked |
| OS | Ubuntu 26.04.1 LTS, kernel 7.0, x86_64 | Up 9 weeks without a reboot |
| CPU | Intel Core i7-7700HQ, 4 cores / 8 threads, 2.8 GHz (3.8 GHz boost) | 2017 laptop chip. Has AVX2 and AES, no AVX-512. Load average about 0.2, so nearly idle |
| Memory | 15 GiB total; about 4 GiB used, about 11 GiB available (10 GiB of that is cache the system gives back on demand) | All containers together use about 2.4 GiB |
| Swap | 4 GiB, 2.5 GiB in use | Swap in use even with free memory means memory ran short at some point (likely when the game servers ran). Worth watching |
| Boot / system disk | 931 GB hard disk (spinning, not SSD). Root is 150 GB on it, 62 GB free (57% used). 200 GB "gamedata" volume (181 GB free). About 580 GB of the disk is not assigned to either volume | Docker, Postgres and the databases all live on the spinning root disk |
| Backup disk | 931 GB hard disk, mounted for backups, 851 GB free | |
| NVMe disk | 931 GB NVMe SSD, encrypted (LUKS), **not mounted** | Contents unknown. See "Questions to settle" below |
| USB flash | 115 GB, exFAT, empty | |
| GPU | AMD Radeon RX 470/480/570/580 class (Polaris) with the open driver (`renderD128` present) | VRAM not measured. Usable for hardware video encoding and possibly Vulkan-based AI; the official ROCm AI stack does not support this generation |
| Network | Gigabit Ethernet (wired) plus Wi-Fi, on Tailscale (direct connection) | |
| Docker | 29.8.0, 24 containers (17 running), 11 compose projects, managed through Portainer | |

### What runs on it

| Service | Memory now | Notes |
| --- | --- | --- |
| Blackwall app, Postgres, backup job | 79 MiB, 24 MiB, under 1 MiB | Published to the tailnet on the standard HTTPS port |
| Nextcloud and MariaDB | 281 MiB, 71 MiB | Official `nextcloud:latest` image |
| AFFiNE (server, Postgres, Redis) | 422 MiB, 102 MiB, 11 MiB | |
| SiYuan | 334 MiB | Published to the tailnet |
| n8n | 291 MiB | Published to the tailnet |
| Homarr | 418 MiB | |
| Uptime Kuma | 114 MiB | |
| code-server | 81 MiB | |
| Portainer | 48 MiB | |
| Caddy | 44 MiB | |
| ntfy | 22 MiB | |
| Ollama | 63 MiB (idle, no model loaded) | Only uses much memory while a model is loaded |
| Not running | | Three game servers (Minecraft Bedrock, Valheim, Dragonwilds test), Watchtower, ALTChat, an MCP helper and AFFiNE's one-time migration job |

Docker's own housekeeping: images 26.7 GB (4.2 GB reclaimable), volumes 23.4 GB, and a **build cache of 18.5 GB of which 17.3 GB is reclaimable**. Blackwall rebuilds its images on every deploy, which is why the cache grows.

## What this means for planned work

**Nextcloud office editor.** It fits. About 11 GiB of memory is available and the CPU is idle.
- **Collabora (CODE)** is the better first choice: it plugs into Nextcloud directly, and needs roughly 1 to 2 GiB plus a little per open document.
- OnlyOffice would also fit (2 to 4 GiB) but is heavier on a 2017 four-core chip.
- Either needs its own HTTPS address that both the apps and Nextcloud can reach. That is a setup task (Caddy or Tailscale serve), not a capacity problem.
- Expect the first open of a large document to feel slower than on a modern server. One user at a time is fine.

**Running the game servers at the same time.** The Valheim and Minecraft servers are the likely reason swap is in use. Running one or more alongside an office editor could push the machine back into swapping, so decide which should run together before turning everything on, or give the containers memory limits.

**Storage speed.** Everything stateful (databases, Nextcloud, Docker) sits on a spinning disk, which is the slowest part of Mikoshi for document work. The unmounted NVMe could change that, depending on what is on it.

**Blackwall's own document editor** runs in the app on the Mac, so it adds no load to Mikoshi.

## Questions to settle

1. **What is on the NVMe?** It has the same layout as the boot disk (a small boot partition, a boot volume and an encrypted volume), so it may be an older or second Ubuntu install, or an unused disk. Moving the databases and Nextcloud's files onto it is probably the biggest speed upgrade available. Nothing should be done to it until we know.
2. **Where does Nextcloud keep its files?** Probably a Docker volume on the spinning root disk (62 GB free). Worth confirming before large uploads.
3. **Is it intended that Watchtower is stopped?** It last exited with an error two weeks ago.
4. **ALTChat last exited with code 137** (a forced kill, often out-of-memory) eight weeks ago. Possibly relevant to the swap use.

## Safe housekeeping available

- `docker builder prune` clears the 17 GB build cache and is safe: it only removes cached build layers, which rebuild when needed. Not run yet.

## Log

Newest first.

### 2026-11-12: first inventory

- Run by hand on Mikoshi with the inventory script; results are in **Current picture** above.
- Idle (load 0.2), 11 GiB of 15 GiB memory available, 2.4 GiB used by all containers, swap 2.5 GiB of 4 GiB used.
- The root disk is a spinning hard disk (62 GB free); a 931 GB encrypted NVMe is present but unmounted.
- Conclusion: there is room for Collabora alongside what already runs; the open questions are disk speed and which game servers run at the same time.
