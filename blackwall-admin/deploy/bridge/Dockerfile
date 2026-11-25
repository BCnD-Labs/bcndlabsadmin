# Official Proton Mail Bridge binary, pinned to an upstream release and checksum.
# Ubuntu 26.04 LTS is the same family as Mikoshi and Proton's supported Linux build.
FROM ubuntu:26.04
ARG BRIDGE_VERSION=3.27.2
ARG BRIDGE_SHA256=cf08332dcc4a332c3592476855e2007e6daadbcdac11fab6af83470a3255a8dc
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl gnupg gpg-agent pass gosu \
    && curl -fsSL "https://github.com/ProtonMail/proton-bridge/releases/download/v${BRIDGE_VERSION}/protonmail-bridge_${BRIDGE_VERSION}-1_amd64.deb" -o /tmp/bridge.deb \
    && echo "${BRIDGE_SHA256}  /tmp/bridge.deb" | sha256sum -c - \
    && apt-get install -y --no-install-recommends /tmp/bridge.deb \
    && rm -f /tmp/bridge.deb && rm -rf /var/lib/apt/lists/*
RUN useradd --system --create-home --home-dir /var/lib/proton-bridge bridge
COPY start.sh /usr/local/bin/bridge-start
COPY user.sh /usr/local/bin/bridge-user
RUN chmod 755 /usr/local/bin/bridge-start /usr/local/bin/bridge-user
ENV HOME=/var/lib/proton-bridge GNUPGHOME=/var/lib/proton-bridge/.gnupg PASSWORD_STORE_DIR=/var/lib/proton-bridge/.password-store
ENTRYPOINT ["/usr/local/bin/bridge-start"]
CMD ["protonmail-bridge", "--noninteractive"]
