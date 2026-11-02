import type { ProviderId } from "@shared/connections"
import type { Category } from "@/components/common/category-icon"

export const CONNECTION_GUIDANCE: Record<ProviderId, { category: Category; /** Where its data shows up once linked. */ feeds: string; outcome: string; prepare: string; steps: string[] }> = {
  github: {
    feeds: "GitHub activity and the Home GitHub panel",
    category: "development",
    outcome: "See commits, review requests, failed Actions runs and issues for repositories you choose to track.",
    prepare: "Connect using a GitHub personal access token. This setup uses a token rather than a GitHub sign-in window.",
    steps: ["Open GitHub’s token page using the link below.", "Select only the repositories you want Blackwall to read. Allow read access to Actions, Checks, Contents, Issues and Pull requests.", "Copy the token, return here, and paste it in the next step. After testing, add repositories to your tracked list."],
  },
  azure: {
    feeds: "subscription and resource counts, shown under Details",
    category: "azure",
    outcome: "See subscription, resource group and resource counts in Settings → Connections. This does not provide uptime or cost monitoring.",
    prepare: "You’ll need an app registration in Microsoft Entra ID and its tenant ID, application ID and client secret.",
    steps: ["Create or use an app registration in your Azure tenant.", "Give that app the Reader role on the subscription you want to inspect.", "Enter its IDs and client secret in the next step."],
  },
  cloudflare: {
    feeds: "domain (zone) status, shown under Details",
    category: "cloudflare",
    outcome: "See your domains (zones) and their status on the connection card. Website traffic requires a separate Website analytics connection.",
    prepare: "You’ll need a Cloudflare API token with Zone:Read permission for the domains you select.",
    steps: ["Open Cloudflare’s API token page using the link below.", "Create a token with Zone:Read access for the domains you want to inspect.", "Copy the token and paste it in the next step."],
  },
  nextcloud: {
    feeds: "Mikoshi → Storage",
    category: "mikoshi",
    outcome: "Browse, upload, move, rename and delete your Nextcloud files from Mikoshi → Storage. Text files open in an editor; office files open in Nextcloud.",
    prepare: "You’ll need your Nextcloud address, your username and an app password (not your login password).",
    steps: ["In Nextcloud, open Personal settings → Security.", "Under Devices & sessions, enter a name like “Blackwall” and create a new app password.", "Paste your Nextcloud address, username and that app password in the next step, then test."],
  },
  analytics: {
    feeds: "Website traffic and the Home traffic panel",
    category: "analytics",
    outcome: "See website visitors, pageviews, popular pages and referrers in Website → Website traffic. Traffic can also be added to Home.",
    prepare: "Your website must already collect analytics through Plausible, Umami or Cloudflare Web Analytics.",
    steps: ["Choose your analytics provider in the next step.", "Find the site identifier and API key in that provider’s settings.", "Enter those details. Blackwall tests whether it can read your analytics."],
  },
  website: {
    feeds: "Posts & pages, Media library and publishing",
    category: "website",
    outcome: "Manage posts and images for a static website deployed from GitHub. Publishing writes commits to your website repository.",
    prepare: "You’ll need your website repository, live site URL and a token with Contents: Read and write access to that repository only.",
    steps: ["Create a separate publishing token for your website repository using the link below.", "Enter the repository, live URL and token. Open Advanced settings if your branch or folders differ from the defaults.", "The test checks access. Your site’s blog index needs Blackwall’s post markers for published posts to appear in its listing."],
  },
  other: {
    feeds: "a saved link, plus a manual check if it has an endpoint",
    category: "service",
    outcome: "Keep a service link and optional account details in Connections. Add an HTTP endpoint for a manual reachability test.",
    prepare: "A service URL is enough to save a link. Credentials and endpoint checks are optional.",
    steps: ["Give the service a recognizable name and URL.", "Optionally add an endpoint to test and the credentials that endpoint requires.", "Save the service. Endpoint checks run when you save or click Test; they are not scheduled monitoring."],
  },
}
