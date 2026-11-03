# bcndlabs admin

Home of **Blackwall**, the internal workspace for bcndlabs. The app lives in [`blackwall-admin/`](./blackwall-admin). See its [README](./blackwall-admin/README.md) for setup, data storage, demo-data boundaries, and integration points.

```bash
cd blackwall-admin && npm install && npm run dev
```

**Android app:** [`mobile/`](./mobile) is an Expo app that shows your hosted Blackwall in a full-screen WebView, with native setup and settings. It's a separate project with its own `package.json`. See its [README](./mobile/README.md).

**Working with coding agents:** [`AGENTS.md`](./AGENTS.md) has the rules Claude and Codex follow here, and how issues, the Agents button and pull requests work.

## Long-term scope

Blackwall is meant to grow into the place to "run" bcndlabs:

- Monitor services: Mikoshi, the bcndlabs website, Azure services, Cloudflare domain and DNS, GitHub repositories
- Track GitHub and other projects
- Notes, schedule, homework
- A personal SQL database ("Soulkiller") as the future backend
- Alt: rules, guardrails, skills, and a personal MCP for the LLM
