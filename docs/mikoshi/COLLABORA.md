# Collabora: the office editor behind Docs

The Docs app opens Word, Excel and PowerPoint files read-only. Its **Edit** button switches to Nextcloud's office editor, which is Collabora Online. Collabora runs on Mikoshi next to Nextcloud; Blackwall only asks Nextcloud for a one-time editor page and shows it (in the Mac app, inside the Docs window). Collabora saves into Nextcloud as you type, so there is nothing to export or sync.

Until this is set up, Docs works as before and the Edit button simply doesn't appear. Nothing in Blackwall needs to be reconfigured afterwards: it asks Nextcloud whether editing is available each time Docs opens.

```
Mac app (Docs window)  ──►  Blackwall server  ──►  Nextcloud  ◄──►  Collabora (CODE)
   shows the editor page      asks for a one-time     the file lives      edits, saves back
                              editor address          here                through Nextcloud
```

## Before you start

- Memory: plan for 1 to 2 GiB for Collabora plus a little per open document. Mikoshi has about 11 GiB free (see [CAPABILITIES.md](CAPABILITIES.md)). If the game servers run at the same time, give the container a memory limit (the `mem_limit` line below).
- Collabora needs its own HTTPS address that **both the Mac and Nextcloud can reach**. Use a second Tailscale Serve port, as Blackwall does.
- Use `blackwall.example.ts.net` below as a placeholder; put your real names only on Mikoshi, never in the repo.

## 1. Run Collabora

Add this service to Nextcloud's compose project in Portainer (or as its own stack):

```yaml
services:
  collabora:
    image: collabora/code:latest
    restart: unless-stopped
    cap_add:
      - MKNOD
    environment:
      # The address Nextcloud is reached at, exactly as Collabora will see it (scheme, host, port).
      - aliasgroup1=https://blackwall.example.ts.net:443
      - dictionaries=en_US
      # Tailscale Serve provides the HTTPS, so Collabora itself speaks plain HTTP.
      - extra_params=--o:ssl.enable=false --o:ssl.termination=true
    ports:
      - "127.0.0.1:9980:9980"
    mem_limit: 2g
```

Publish it on the tailnet on its own port:

```bash
tailscale serve --bg --https=9980 http://127.0.0.1:9980
```

Collabora is then at `https://blackwall.example.ts.net:9980`. Opening `https://blackwall.example.ts.net:9980/hosting/discovery` in a browser should show an XML page; that is the check that it is up.

## 2. Connect Nextcloud to it

On Mikoshi, with the Nextcloud container's name in place of `nextcloud`:

```bash
docker exec -u www-data nextcloud php occ app:install richdocuments
docker exec -u www-data nextcloud php occ config:app:set richdocuments wopi_url --value="https://blackwall.example.ts.net:9980"
docker exec -u www-data nextcloud php occ richdocuments:activate-config
```

Two settings often needed because Collabora and Nextcloud both live on private addresses:

```bash
# Nextcloud may talk to servers on private addresses.
docker exec -u www-data nextcloud php occ config:system:set allow_local_remote_servers --value=true --type=bool
# Let Collabora's container network call Nextcloud back (Docker's default range; narrow it if you know the network).
docker exec -u www-data nextcloud php occ config:app:set richdocuments wopi_allowlist --value="172.16.0.0/12"
```

In Nextcloud's own web page, open a `.docx` from Files: it should open in the editor. If it does, Blackwall will work too.

## 3. Check it in Blackwall

Open a `.docx` in Docs (Files → open a document). **Edit** appears next to **Download**. Pressing it shows the editor; **Done** returns to the read-only view with what was just saved. Older Office files and OpenDocument files (`.doc`, `.xls`, `.ppt`, `.odt`, `.ods`, `.odp`), which the viewer can't draw, open straight in the editor.

## If it doesn't work

| What you see | Likely cause |
| --- | --- |
| No Edit button | Nextcloud's Office app isn't installed or connected (step 2), or Nextcloud is older than the direct-editing API. Check `https://<nextcloud>/ocs/v2.php/apps/files/api/v1/directEditing?format=json` while signed in: `richdocuments` should be listed under `editors`. |
| "Editing isn't set up in Nextcloud yet" | The same, noticed when pressing Edit. |
| "Unauthorized WOPI host" in Collabora's log | `aliasgroup1` doesn't match the address Nextcloud uses, including the port. |
| Editor opens but the document never loads | Collabora can't reach Nextcloud back (check `wopi_allowlist`, `allow_local_remote_servers`), or the proxy isn't passing WebSockets. |

The commands and settings above follow the Nextcloud Office and Collabora documentation as of writing but haven't been run on Mikoshi yet; treat the first run as the test and correct this page with whatever differs.
