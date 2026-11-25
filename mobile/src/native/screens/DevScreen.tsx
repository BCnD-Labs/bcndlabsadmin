import type { ScreenProps } from "../nav/screens.tsx"
import { useState } from "react"
import { Linking, Pressable, StyleSheet, Text, View } from "react-native"
import type { Collections } from "../../lib/shared.ts"
import { useWorkspace } from "../data/WorkspaceProvider.tsx"
import { selectedItem } from "../selected-item.ts"
import { plannerColor as c } from "../planner-theme.ts"
import { WorkspacePage, WorkspaceSection } from "../WorkspacePage.tsx"
import { Icon } from "../ui.tsx"
import { Pill } from "./learning/LearningControls.tsx"
import { PropChip } from "../kit/PropChip.tsx"
import { StatCell, StatStrip } from "../kit/charts.tsx"
import { localKey } from "../kit/stats.ts"
import { chipTone, kit, statusKind } from "../kit/tokens.ts"
import { mono } from "../../theme.ts"
import { shortDay } from "./planner/dates.ts"
import { ProjectEditor } from "./ProjectEditor.tsx"

type Project = Collections["projects"][number]
type RepoLink = Collections["repos"][number]
const statusTint: Record<Project["status"], string> = { active: c.green, planned: c.blue, paused: c.amber, done: c.muted }
const projectTint: Record<Project["color"], string> = { teal: "#26a69a", amber: c.amber, red: "#ef5350", slate: "#90a4ae" }

/** Native projects show saved records and repository links, without invented GitHub activity. */
export function DevScreen({ onOpenSettings, navigationTarget }: ScreenProps) {
  const { data, status, message, refreshing, refresh } = useWorkspace()
  const [filter, setFilter] = useState<"all" | Project["status"]>("all")
  const [open, setOpen] = useState<string | null>(() => navigationTarget?.screen === "dev" ? navigationTarget.projectId : null)
  const [editor, setEditor] = useState<Project | "new" | null>(null)
  const [notice, setNotice] = useState("")
  const projects = data?.projects.filter(p => filter === "all" || p.status === filter) ?? []
  const unassigned = data?.repos.filter(r => !r.projectId || !data.projects.some(p => p.id === r.projectId)) ?? []
  return <WorkspacePage page="Projects" onOpenSettings={onOpenSettings} onRefresh={() => void refresh()} refreshing={refreshing}>
    {notice ? <Text style={s.error}>{notice}</Text> : null}
    {data ? <>
      <StatStrip>
        <StatCell label="Projects" value={data.projects.length} />
        <StatCell label="Active" value={data.projects.filter(p => p.status === "active").length} tint={chipTone.status.ink} />
        <StatCell label="Paused" value={data.projects.filter(p => p.status === "paused").length} tint={data.projects.some(p => p.status === "paused") ? chipTone.date.ink : c.text} />
        <StatCell label="Repos" value={data.repos.length} tint={kit.hue.projects} />
      </StatStrip>
      {data.projects.length ? <View style={s.filters}>{(["all", "active", "planned", "paused", "done"] as const).map(key => <Pill key={key} label={`${key === "all" ? "All" : key[0].toUpperCase() + key.slice(1)} ${key === "all" ? data.projects.length : data.projects.filter(p => p.status === key).length}`} selected={filter === key} onPress={() => setFilter(key)} />)}</View> : null}
      <WorkspaceSection title="Projects" icon="folder-outline" tint={kit.hue.projects} count={String(projects.length)} flush>
        {projects.length ? <View style={s.colHead} accessible={false} importantForAccessibility="no-hide-descendants"><Text style={[s.colText, s.colTitle]}>PROJECT</Text><Text style={[s.colText, s.colStatus]}>STATUS</Text><Text style={[s.colText, s.colRepos]}>REPOS</Text></View> : null}
        {projects.map(project => {
          const repos = data.repos.filter(r => r.projectId === project.id)
          const expanded = open === project.id
          const updated = localKey(project.updatedAt)
          return <View key={project.id} style={[s.item, selectedItem.item, expanded && selectedItem.itemOn]}>
            <Pressable onPress={() => setOpen(expanded ? null : project.id)} style={s.row} accessibilityRole="button" accessibilityState={{ expanded }} accessibilityLabel={project.name + ", " + project.status + ", " + repos.length + " repositories"}>
              <View style={[s.marker, { backgroundColor: projectTint[project.color] }]} /><View style={s.body}><Text style={s.title} numberOfLines={1}>{project.name}</Text>{project.code ? <Text style={s.code} numberOfLines={1}>{project.code}</Text> : null}</View><View style={s.statusCol}><PropChip kind={statusKind(project.status)} value={project.status.toUpperCase()} /></View><Text style={s.repoCount}>{repos.length}</Text><Icon name={expanded ? "chevron-up" : "chevron-down"} size={15} tint={c.muted} />
            </Pressable>
            {expanded ? <View style={s.detail}>
              <View style={s.chips}><PropChip kind="project" label="Code" value={project.code || "None"} /><PropChip kind={statusKind(project.status)} label="Status" value={project.status} /><PropChip kind="neutral" label="Repos" value={String(repos.length)} />{updated ? <PropChip kind="date" label="Updated" value={shortDay(updated)} /> : null}</View>
              {project.description ? <Text style={s.description} numberOfLines={2} ellipsizeMode="tail">{project.description.trim().length > 120 ? `${project.description.trim().slice(0, 120).trimEnd()}…` : project.description}</Text> : null}{repos.map(repo => <RepoRow key={repo.id} repo={repo} />)}{!repos.length ? <Text style={s.meta}>No repositories linked.</Text> : null}<Pressable onPress={() => status === "conflict" ? setNotice("Resolve the sync conflict before editing.") : setEditor(project)} style={selectedItem.action} accessibilityRole="button"><Text style={selectedItem.actionText}>Edit project</Text></Pressable></View> : null}
          </View>
        })}
        {!projects.length ? <Text style={s.empty}>{data.projects.length ? "No projects match this status." : "No projects yet. Use the + button to create one."}</Text> : null}
      </WorkspaceSection>
      {unassigned.length ? <WorkspaceSection title="Other repositories" icon="git-branch-outline" tint={kit.hue.projects} count={String(unassigned.length)}>{unassigned.map(repo => <RepoRow key={repo.id} repo={repo} />)}</WorkspaceSection> : null}
    </> : <Text style={s.empty}>{status === "signed-out" ? "Sign in under Settings to see your projects." : message ?? "Loading your workspace…"}</Text>}
    {data && editor ? <ProjectEditor value={editor} data={data} onClose={() => setEditor(null)} /> : null}
  </WorkspacePage>
}

function RepoRow({ repo }: { repo: RepoLink }) {
  const valid = /^https:\/\/[^\s/]+/.test(repo.url)
  return <Pressable onPress={() => valid && void Linking.openURL(repo.url)} disabled={!valid} style={s.repo} accessibilityRole="link" accessibilityState={{ disabled: !valid }}><Icon name="logo-github" size={16} tint={c.muted} /><View style={s.body}><Text style={s.repoTitle} numberOfLines={1}>{repo.fullName}</Text>{repo.notes ? <Text style={s.meta} numberOfLines={2}>{repo.notes}</Text> : null}</View>{valid ? <Icon name="open-outline" size={14} tint={c.accent} /> : null}</Pressable>
}

const s = StyleSheet.create({ add: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: c.panel, borderWidth: 1, borderColor: c.line }, error: { color: c.errorText, fontSize: 12 }, meta: { color: c.muted, fontSize: 11 }, filters: { flexDirection: "row", flexWrap: "wrap", gap: 6 }, item: { borderBottomWidth: 1, borderColor: c.line }, row: { minHeight: 46, flexDirection: "row", alignItems: "center", gap: 8, paddingRight: 8 }, marker: { width: 4, height: 30, borderRadius: 2, marginLeft: 6 },
  colHead: { height: 20, flexDirection: "row", alignItems: "center", paddingLeft: 18, paddingRight: 31, backgroundColor: "#2a2b2d", borderBottomWidth: 1, borderColor: c.line }, colText: { color: kit.mutedInk, fontFamily: mono, fontSize: 8.5, fontWeight: "700", letterSpacing: 1 }, colTitle: { flex: 1 }, colStatus: { width: 84 }, colRepos: { width: 34, textAlign: "right" },
  code: { color: kit.mutedInk, fontFamily: mono, fontSize: 10 }, statusCol: { width: 84 }, repoCount: { width: 34, textAlign: "right", color: c.text2, fontFamily: mono, fontSize: 12, fontWeight: "700" }, chips: { flexDirection: "row", flexWrap: "wrap", gap: 4 }, body: { flex: 1, gap: 3 }, title: { color: c.text, fontSize: 14, fontWeight: "600" }, status: { fontSize: 11, textTransform: "capitalize" }, detail: { paddingLeft: 18, paddingRight: 10, paddingBottom: 10, gap: 7 }, description: { color: c.text2, fontSize: 12, lineHeight: 17 }, repo: { minHeight: 39, paddingRight: 4, flexDirection: "row", alignItems: "center", gap: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.line }, repoTitle: { color: c.text2, fontSize: 12 }, empty: { color: c.muted, fontSize: 12, paddingVertical: 9, paddingHorizontal: 10 } })
