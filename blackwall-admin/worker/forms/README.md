# Blackwall form receiver

A Cloudflare Worker that receives form messages, comments and newsletter sign-ups from
sites built in Blackwall's CMS. Static sites can't receive posts themselves, so their forms
post here; the Worker checks them and holds them until Blackwall collects them (about once
a minute), then deletes them.

Every submission must have an email address whose domain can receive mail. On top of that:

| Check | Turned on by | What it does |
| --- | --- | --- |
| Human check | `TURNSTILE_SECRET` | Cloudflare Turnstile must pass before anything is accepted. |
| Confirmation email | `RESEND_API_KEY` | The sender gets a link; the submission only reaches Blackwall after they click it. |
| Newsletter | `MAILERLITE_API_KEY` | Sign-ups go to MailerLite, which sends its own confirmation email. |
| Allowed sites | `ALLOWED_ORIGINS` | Only your sites can post here. |

Without a confirmation email, form messages and comments still need a valid email and the
human check. Comments never appear on a site until you approve them in Website → Forms and
publish.

## Set it up

You need a free Cloudflare account and Node.js. Run these in this folder (`worker/forms`).

1. **Sign in:** `npx wrangler login`
2. **Create the storage:** `npx wrangler kv namespace create SUBMISSIONS`, then paste the
   `id` it prints into `wrangler.toml`.
3. **Set the admin token** (Blackwall uses it to collect). Make a long random one, e.g.
   `openssl rand -hex 32`, then `npx wrangler secret put ADMIN_TOKEN` and paste it.
4. **Deploy:** `npx wrangler deploy`. It prints the Worker's address
   (`https://blackwall-forms.<you>.workers.dev`).
5. **In Blackwall:** Settings → Connections → Form receiver: paste the address and the same
   admin token, then Test. In Website → Site settings, set **Form receiver** to the address.

### Human check (recommended)

In the Cloudflare dashboard, Turnstile → Add widget, add your site's domain, and choose
"Managed". Put the **site key** in Blackwall's Site settings → Turnstile site key, and the
**secret key** here: `npx wrangler secret put TURNSTILE_SECRET`.

### Newsletter (MailerLite)

1. MailerLite → Integrations → API → generate a token, then
   `npx wrangler secret put MAILERLITE_API_KEY`.
2. Subscribers → Groups → create one (e.g. "Website"), copy its ID from the address bar
   and set `MAILERLITE_GROUP` in `wrangler.toml`.
3. Account settings → Subscribe settings → turn on **double opt-in for API and
   integrations**, so every sign-up confirms their email.
4. `npx wrangler deploy` again, then add the **Newsletter sign-up** block to a page.

### Confirmation emails (optional)

Uses [Resend](https://resend.com) (free tier: 3,000 emails a month). Verify your domain
there, then `npx wrangler secret put RESEND_API_KEY` and set `MAIL_FROM` in
`wrangler.toml` to something like `BCnD Labs <forms@bcndlabs.dev>`.

### Only your sites

Set `ALLOWED_ORIGINS` in `wrangler.toml` to your site addresses, comma-separated, e.g.
`https://bcndlabs.dev,https://www.bcndlabs.dev`, and deploy again.

## Limits

Each visitor (by IP) can send 8 submissions an hour. Unconfirmed submissions expire after
48 hours. Fields are cut at 5,000 characters.
