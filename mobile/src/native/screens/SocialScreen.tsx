import { useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { postAccounts, postState, type Collections, type PostState } from "../../lib/shared.ts"
import { useWorkspace } from "../data/WorkspaceProvider.tsx"
import { plannerColor as c } from "../planner-theme.ts"
import { selectedItem } from "../selected-item.ts"
import { WorkspacePage, WorkspaceSection } from "../WorkspacePage.tsx"
import { Icon } from "../ui.tsx"

type Post = Collections["socialPosts"][number]
type Account = Collections["socialAccounts"][number]
const label: Record<PostState, string> = { idea: "Idea", draft: "Draft", scheduled: "Scheduled", due: "Due", partial: "Partly posted", posted: "Posted" }
const ink: Record<PostState, string> = { idea: c.muted, draft: c.text2, scheduled: c.accent, due: c.amber, partial: c.amber, posted: c.green }

/** Read-only native queue. Creation, editing and posting remain in the existing Web view. */
export function SocialScreen({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { data, status, message, refreshing, refresh } = useWorkspace()
  const posts = data?.socialPosts ?? []
  const accounts = data?.socialAccounts ?? []
  const pending = posts.filter(post => postState(post) !== "posted")
    .sort((a, b) => (a.scheduledAt ?? "9999").localeCompare(b.scheduledAt ?? "9999") || b.updatedAt.localeCompare(a.updatedAt))
  const posted = posts.filter(post => postState(post) === "posted")
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  return <WorkspacePage page="Social" onOpenSettings={onOpenSettings} onRefresh={() => void refresh()} refreshing={refreshing}>
    {data ? <>
      <Text style={s.hint}>{posts.length} posts · {accounts.length} accounts. Create and edit posts in Web view.</Text>
      <WorkspaceSection title="Queue" icon="megaphone-outline" count={String(pending.length)}>
        {pending.map(post => <PostRow key={post.id} post={post} accounts={accounts} />)}
        {!pending.length ? <Text style={s.empty}>No posts waiting. Ideas and scheduled posts will appear here.</Text> : null}
      </WorkspaceSection>
      {posted.length ? <WorkspaceSection title="Posted" icon="checkmark-circle-outline" tint={c.green} count={String(posted.length)}>
        {posted.map(post => <PostRow key={post.id} post={post} accounts={accounts} />)}
      </WorkspaceSection> : null}
      <WorkspaceSection title="Accounts" icon="people-outline" count={String(accounts.length)}>
        {accounts.map(account => <View key={account.id} style={s.account}><Icon name="at-outline" size={16} tint={c.accent} /><View style={s.flex}><Text style={s.title} numberOfLines={1}>{account.name}</Text><Text style={s.meta} numberOfLines={1}>{account.brand} · {account.platform}</Text></View></View>)}
        {!accounts.length ? <Text style={s.empty}>No social accounts saved. Add them in Web view.</Text> : null}
      </WorkspaceSection>
    </> : <Text style={s.empty}>{status === "signed-out" ? "Sign in under Settings to see Social." : message ?? "Loading your workspace…"}</Text>}
  </WorkspacePage>
}

function PostRow({ post, accounts }: { post: Post; accounts: Account[] }) {
  const [selected, setSelected] = useState(false)
  const state = postState(post)
  const targets = postAccounts(post, accounts)
  const title = post.title.trim() || post.body.trim().split("\n")[0] || "Untitled post"
  const schedule = post.scheduledAt ? new Date(post.scheduledAt) : null
  const when = schedule && !Number.isNaN(schedule.getTime()) ? schedule.toLocaleString() : post.scheduledAt
  return <View style={[selectedItem.item, selected && selectedItem.itemOn]}>
    <Pressable onPress={() => setSelected(value => !value)} style={s.row} accessibilityRole="button" accessibilityState={{ expanded: selected }} accessibilityLabel={`Preview ${title}`}>
      <View style={s.flex}><Text style={s.title} numberOfLines={1}>{title}</Text><Text style={s.meta} numberOfLines={1}>{when ?? (targets.length ? targets.map(a => a.name).join(", ") : "No accounts selected")}</Text></View>
      <Text style={[s.state, { color: ink[state] }]}>{label[state]}</Text>
      <Icon name={selected ? "chevron-up" : "chevron-down"} size={16} tint={c.muted} />
    </Pressable>
    {selected ? <View style={selectedItem.preview}>
      <Text style={s.body} numberOfLines={4}>{post.body.trim() || "No caption written yet."}</Text>
      <Text style={s.meta}>{targets.length ? targets.map(a => a.name).join(" · ") : "No accounts selected"}{post.media ? " · Media noted" : ""}</Text>
      {post.link ? <Text style={s.meta} numberOfLines={1}>Link: {post.link}</Text> : null}
    </View> : null}
  </View>
}

const s = StyleSheet.create({
  hint: { color: c.muted, fontSize: 12, lineHeight: 17 },
  empty: { color: c.muted, fontSize: 12, lineHeight: 17, paddingVertical: 9 },
  flex: { flex: 1, minWidth: 0 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44, paddingVertical: 5 },
  title: { color: c.text, fontSize: 14, fontWeight: "600" },
  meta: { color: c.muted, fontSize: 11, lineHeight: 16 },
  state: { fontSize: 11, fontWeight: "600" },
  body: { color: c.text2, fontSize: 12, lineHeight: 17 },
  account: { flexDirection: "row", alignItems: "center", minHeight: 44, gap: 9, borderBottomWidth: 1, borderColor: c.line },
})
