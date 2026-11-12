#!/usr/bin/env bash
# Mikoshi inventory: a READ-ONLY snapshot of what this machine can do (CPU, memory, disks, GPU, network,
# containers and what they use). It changes nothing, needs no sudo, and prints no passwords or environment variables.
# Run it ON Mikoshi, or from your Mac:   ssh <user>@mikoshi 'bash -s' < docs/mikoshi/mikoshi-inventory.sh
# Paste the output into docs/mikoshi/CAPABILITIES.md (or give it to Claude) to refresh the log.

have() { command -v "$1" >/dev/null 2>&1; }
section() { printf '\n== %s ==\n' "$1"; }

section "When"
date -u +"%Y-%m-%dT%H:%M:%SZ (UTC)"

section "System"
. /etc/os-release 2>/dev/null && echo "OS: ${PRETTY_NAME:-unknown}"
echo "Kernel: $(uname -sr) $(uname -m)"
echo "Uptime: $(uptime -p 2>/dev/null || uptime)"
echo "Load average (1/5/15 min): $(cut -d' ' -f1-3 /proc/loadavg 2>/dev/null)"
have systemd-detect-virt && echo "Virtualization: $(systemd-detect-virt 2>/dev/null)"
[ -r /sys/class/dmi/id/product_name ] && echo "Machine: $(cat /sys/class/dmi/id/sys_vendor 2>/dev/null) $(cat /sys/class/dmi/id/product_name 2>/dev/null)"

section "CPU"
if have lscpu; then lscpu | grep -E 'Model name|^CPU\(s\)|Thread|Core|Socket|MHz|max|Virtualization|L2|L3|Flags' | grep -v '^Flags' ; lscpu | grep -o -E 'avx2|avx512[a-z]*|aes|sse4_2' | sort -u | tr '\n' ' ' | sed 's/^/Notable CPU features: /'; echo
else grep -m1 "model name" /proc/cpuinfo 2>/dev/null; echo "Logical CPUs: $(nproc 2>/dev/null)"; fi
for f in /sys/class/thermal/thermal_zone*/temp; do [ -r "$f" ] && echo "Temp $(basename "$(dirname "$f")"): $(( $(cat "$f") / 1000 )) C"; done 2>/dev/null | head -4

section "Memory"
free -h 2>/dev/null || grep -E "MemTotal|MemAvailable|SwapTotal" /proc/meminfo 2>/dev/null

section "Disks"
lsblk -o NAME,SIZE,TYPE,ROTA,FSTYPE,MOUNTPOINT 2>/dev/null | head -40
echo; df -hT -x tmpfs -x devtmpfs -x overlay -x squashfs 2>/dev/null | head -20

section "GPU / hardware video"
if have lspci; then lspci 2>/dev/null | grep -i -E 'vga|3d|display|nvidia|amd|intel.*graphics'; fi
have nvidia-smi && nvidia-smi --query-gpu=name,memory.total,memory.used,driver_version --format=csv,noheader 2>/dev/null
[ -d /dev/dri ] && echo "DRI devices: $(ls /dev/dri | tr '\n' ' ')"

section "Network"
ip -br addr 2>/dev/null | grep -v -E '^(lo|veth|br-|docker)' | head -10
for i in /sys/class/net/*; do n=$(basename "$i"); case "$n" in lo|veth*|br-*|docker*) continue;; esac; [ -r "$i/speed" ] && echo "$n link speed: $(cat "$i/speed" 2>/dev/null) Mb/s"; done 2>/dev/null
have tailscale && { echo; tailscale version 2>/dev/null | head -1; echo "Tailscale serve:"; tailscale serve status 2>/dev/null | head -12; }

section "Listening ports"
ss -tlnH 2>/dev/null | awk '{print $4}' | sort -u | head -30

section "Docker"
if have docker; then
  docker version --format 'Docker {{.Server.Version}}' 2>/dev/null || echo "docker is installed but this user can't talk to it (try the docker group or sudo)"
  echo; echo "Containers (name, image, status):"
  docker ps -a --format '  {{.Names}} | {{.Image}} | {{.Status}}' 2>/dev/null | head -60
  echo; echo "Live usage (CPU, memory):"
  docker stats --no-stream --format '  {{.Name}} | cpu {{.CPUPerc}} | mem {{.MemUsage}} ({{.MemPerc}})' 2>/dev/null | head -60
  echo; echo "Docker disk use:"; docker system df 2>/dev/null
  echo; echo "Compose projects:"; docker compose ls 2>/dev/null | head -20
else echo "docker not found"; fi

section "Top memory users (host)"
ps -eo pmem,rss,comm --sort=-rss 2>/dev/null | head -9 | awk 'NR==1{print "  %MEM  RSS(MB)  COMMAND"; next} {printf "  %5s  %7.0f  %s\n", $1, $2/1024, $3}'

section "Done"
echo "Nothing was changed."
