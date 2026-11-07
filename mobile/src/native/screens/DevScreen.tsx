import { useState } from "react"
import { Linking, Pressable, StyleSheet, Text, View } from "react-native"
import type { Collections } from "../../lib/shared.ts"
import { useWorkspace } from "../data/WorkspaceProvider.tsx"
import { selectedItem } from "../selected-item.ts"
import { plannerColor as c } from "../planner-theme.ts"
import { WorkspacePage, WorkspaceSection } from "../WorkspacePage.tsx"
import { Icon } from "../ui.tsx"
import { Pill } from "./learning/LearningControls.tsx"
import { ProjectEditor } from "./ProjectEditor.tsx"

type Project = Collections["projects"][number]
type RepoLink = Collections["repos"][number]
const statusTint: Record<Project["status"], string> = { active: c.green, planned: c.blue, paused: c.amber, done: c.muted }
const projectTint: Record<Project["color"], string> = { teal: "#26a69a", amber: c.amber, red: "#ef5350", slate: "#90a4ae" }

/** Native projects show saved records and repository links, without invented GitHub activity. */
export function DevScreen({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { data, status, message, refreshing, refresh } = useWorkspace()
  const [filter, setFilter] = useState<"all" | Project["status"]>("all")
  const [open, setOpen] = useState<string | null>(null)
  const [editor, setEditor] = useState<Project | "new" | null>(null)
  const [notice, setNotice] = useState("")
  const projects = data?.projects.filter(p => filter === "all" || p.status === filter) ?? []
  const unassigned = data?.repos.filter(r => !r.projectId || !data.projects.some(p => p.id === r.projectId)) ?? []
  const add = <Pressable onPress={() => data && status !== "conflict" ? setEditor("new") : setNotice(status === "conflict" ? "Resolve the sync conflict before editing." : "Load your workspace first.")} style={s.add} accessibilityRole="button" accessibilityLabel="Add project"><Icon name="add" size={20} tint={c.accent} /></Pressable>
  return <WorkspacePage page="Projects" onOpenSettings={onOpenSettings} action={add} onRefresh={() => void refresh()} refreshing={refreshing}>
    {notice ? <Text style={s.error}>{notice}</Text> : null}
    {data ? <>
      <Text style={s.meta}>{data.projects.length} projects · {data.repos.length} {data.repos.length === 1 ? "repository" : "repositories"}</Text>
      {data.projects.length ? <View style={s.filters}>{(["all", "active", "planned", "paused", "done"] as const).map(key => <Pill key={key} label={key === "all" ? "All" : key[0].toUpperCase() + key.slice(1)} selected={filter === key} onPress={() => setFilter(key)} />)}</View> : null}
      <WorkspaceSection title="Projects" icon="folder-outline" count={String(projects.length)}>
        {projects.map(project => {
          const repos = data.repos.filter(r => r.projectId === project.id)
          const expanded = open === project.id
          return <View key={project.id} style={[s.item, selectedItem.item, expanded && selectedItem.itemOn]}>
            <Pressable onPress={() => setOpen(expanded ? null : project.id)} style={s.row} accessibilityRole="button" accessibilityState={{ expanded }} accessibilityLabel={project.name + ", " + project.status + ", " + repos.length + " repositories"}>
              <View style={[s.marker, { backgroundColor: projectTint[project.color] }]} /><View style={s.body}><Text style={s.title} numberOfLines={1}>{project.name}</Text><Text style={s.meta}>{project.code || "Project"} · {repos.length} repos</Text></View><Text style={[s.status, { color: statusTint[project.status] }]}>{project.status}</Text><Icon name={expanded ? "chevron-up" : "chevron-down"} size={15} tint={c.muted} />
            </Pressable>
            {expanded ? <View style={s.detail}>{project.description ? <Text style={s.description} numberOfLines={2} ellipsizeMode="tail">{project.description.trim().length > 120 ? `${project.description.trim().slice(0, 120).trimEnd()}…` : project.description}</Text> : null}{repos.map(repo => <RepoRow key={repo.id} repo={repo} />)}{!repos.length ? <Text style={s.meta}>No repositories linked.</Text> : null}<Pressable onPress={() => status === "conflict" ? setNotice("Resolve the sync conflict before editing.") : setEditor(project)} style={s.edit} accessibilityRole="button"><Text style={s.editText}>Edit project</Text></Pressable></View> : null}
          </View>
        })}
        {!projects.length ? <Text style={s.empty}>{data.projects.length ? "No projects match this status." : "No projects yet. Tap + to create one."}</Text> : null}
      </WorkspaceSection>
      {unassigned.length ? <WorkspaceSection title="Other repositories" icon="git-branch-outline" count={String(unassigned.length)}>{unassigned.map(repo => <RepoRow key={repo.id} repo={repo} />)}</WorkspaceSection> : null}
    </> : <Text style={s.empty}>{status === "signed-out" ? "Sign in under Settings to see your projects." : message ?? "Loading your workspace…"}</Text>}
    {data && editor ? <ProjectEditor value={editor} data={data} onClose={() => setEditor(null)} /> : null}
  </WorkspacePage>
}

function RepoRow({ repo }: { repo: RepoLink }) {
  const valid = /^https:\/\/[^\s/]+/.test(repo.url)
  return <Pressable onPress={() => valid && void Linking.openURL(repo.url)} disabled={!valid} style={s.repo} accessibilityRole="link" accessibilityState={{ disabled: !valid }}><Icon name="logo-github" size={16} tint={c.muted} /><View style={s.body}><Text style={s.repoTitle} numberOfLines={1}>{repo.fullName}</Text>{repo.notes ? <Text style={s.meta} numberOfLines={2}>{repo.notes}</Text> : null}</View>{valid ? <Icon name="open-outline" size={14} tint={c.accent} /> : null}</Pressable>
}

const s = StyleSheet.create({ add: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: c.panel, borderWidth: 1, borderColor: c.line }, error: { color: "#ffa8a8", fontSize: 12 }, meta: { color: c.muted, fontSize: 11 }, filters: { flexDirection: "row", flexWrap: "wrap", gap: 6 }, item: { borderBottomWidth: 1, borderColor: c.line }, row: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 9 }, marker: { width: 4, height: 31, borderRadius: 3 }, body: { flex: 1, gap: 3 }, title: { color: c.text, fontSize: 14, fontWeight: "600" }, status: { fontSize: 11, textTransform: "capitalize" }, detail: { paddingLeft: 13, paddingBottom: 8, gap: 6 }, description: { color: c.text2, fontSize: 12, lineHeight: 17 }, edit: { minHeight: 28, alignSelf: "flex-start", justifyContent: "center", paddingHorizontal: 4 }, editText: { color: c.accent, fontSize: 12, fontWeight: "600" }, repo: { minHeight: 39, flexDirection: "row", alignItems: "center", gap: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.line }, repoTitle: { color: c.text2, fontSize: 12 }, empty: { color: c.muted, fontSize: 12, paddingVertical: 9 } })
