import { Linking, Text } from "react-native"
import { useWorkspace } from "../data/WorkspaceProvider.tsx"
import { Card, Empty, ListRow, Screen } from "../ui.tsx"

/** Saved CMS sites and pages; traffic metrics are shown only where a real analytics source exists. */
export function WebsiteScreen() {
  const { data, status, message, refreshing, refresh } = useWorkspace()
  return <Screen title="Website" subtitle={data ? `${data.sites.length} sites` : undefined} onRefresh={() => void refresh()} refreshing={refreshing}>
    {data ? data.sites.length ? data.sites.map(site => <Card key={site.id} title={site.name}>
      <ListRow title={site.domain} subtitle={site.publishedAt ? `Published ${site.publishedAt.slice(0, 10)}` : "Not published yet"} onPress={() => void Linking.openURL(`https://${site.domain}`)} />
      <Text style={{ color: "#aab1bc", fontSize: 13 }}>{`${data.pages.filter(p => p.siteId === site.id).length} pages · ${data.drafts.filter(d => d.siteId === site.id).length} drafts`}</Text>
    </Card>) : <Card><Empty>No sites in your workspace yet.</Empty></Card> : <Card><Empty>{status === "signed-out" ? "Sign in under Settings to see your sites." : message ?? "Loading your workspace…"}</Empty></Card>}
  </Screen>
}
