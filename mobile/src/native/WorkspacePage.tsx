import { shape } from "../shape.ts"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { Animated, Easing, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native"
import { mono } from "../theme.ts"
import { kit } from "./kit/tokens.ts"
import { plannerColor as c } from "./planner-theme.ts"
import { SyncStatus } from "./data/SyncStatus.tsx"
import { useReduceMotion } from "./nav/useReduceMotion.ts"
import { NAV_CLEARANCE, Icon, type IconName } from "./ui.tsx"

/** The compact page chrome used outside the Planner's own specialized layout. */
export function WorkspacePage({ page, onOpenSettings, action, onRefresh, refreshing, children }: { page: string; onOpenSettings: () => void; action?: ReactNode; onRefresh: () => void; refreshing: boolean; children: ReactNode }) {
  const reduce = useReduceMotion()
  const fade = useRef(new Animated.Value(1)).current
  useEffect(() => { if (reduce) { fade.setValue(1); return }; fade.setValue(0); Animated.timing(fade, { toValue: 1, duration: 190, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start() }, [fade, reduce])
  return <View style={s.fill}><View style={s.header}><Text style={s.crumb}>Blackwall <Text style={s.muted}>/ {page}</Text></Text><View style={s.right}><SyncStatus onOpenSettings={onOpenSettings} />{action}</View></View><ScrollView style={s.fill} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.accent} colors={[c.accent]} />}><Animated.View style={[s.body, { opacity: fade, transform: [{ translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [5, 0] }) }] }]}>{children}</Animated.View></ScrollView></View>
}

/**
 * A tool panel: a darker title bar (icon tile, name, count, optional controls and collapse) over its body.
 * `collapsible` adds a chevron that hides the body; `flush` removes the body's side padding for table rows.
 */
export function WorkspaceSection({ title, icon, tint = c.accent, count, right, collapsible, defaultCollapsed, flush, children }: { title: string; icon: IconName; tint?: string; count?: string; right?: ReactNode; collapsible?: boolean; defaultCollapsed?: boolean; flush?: boolean; children: ReactNode }) {
  const [closed, setClosed] = useState(!!defaultCollapsed)
  const hidden = !!collapsible && closed
  return <View style={s.section}>
    <View style={[s.sectionHead, hidden && s.sectionHeadClosed]}>
      <View style={s.sectionName}><View style={[s.icon, { backgroundColor: `${tint}26`, borderColor: `${tint}61` }]}><Icon name={icon} size={14} tint={tint} /></View><Text style={s.sectionTitle} accessibilityRole="header" numberOfLines={1}>{title}</Text>{count ? <Text style={s.count}>{count}</Text> : null}</View>
      {right}
      {collapsible ? <Pressable onPress={() => setClosed(v => !v)} style={s.collapse} accessibilityRole="button" accessibilityLabel={`${hidden ? "Expand" : "Collapse"} ${title}`} accessibilityState={{ expanded: !hidden }}><Icon name={hidden ? "chevron-down" : "chevron-up"} size={16} tint={c.muted} /></Pressable> : null}
    </View>
    {hidden ? null : <View style={flush ? s.bodyFlush : s.sectionBody}>{children}</View>}
  </View>
}

const s = StyleSheet.create({
  fill: { flex: 1, backgroundColor: c.ground }, header: { paddingHorizontal: 14, paddingTop: 8, paddingBottom: 10, minHeight: 47, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }, crumb: { color: c.text, fontSize: 13, fontWeight: "600", flexShrink: 1 }, muted: { color: c.muted, fontWeight: "400" }, right: { flexDirection: "row", alignItems: "center", gap: 7 }, content: { padding: 14, paddingBottom: NAV_CLEARANCE }, body: { gap: 10 },
  section: { backgroundColor: c.panel, borderRadius: shape.card, borderWidth: 1, borderColor: c.line, overflow: "hidden" },
  sectionHead: { flexDirection: "row", alignItems: "center", minHeight: 34, gap: 8, paddingLeft: 7, paddingRight: 4, backgroundColor: kit.titlebar, borderBottomWidth: 1, borderBottomColor: c.line }, sectionHeadClosed: { borderBottomWidth: 0 },
  sectionName: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 7 }, icon: { width: 22, height: 22, borderRadius: 6, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  sectionTitle: { flexShrink: 1, color: c.text, fontFamily: mono, fontSize: 11, fontWeight: "700", letterSpacing: 0.9, textTransform: "uppercase" }, count: { color: c.muted, fontFamily: mono, fontSize: 10.5 },
  collapse: { width: 30, height: 30, alignItems: "center", justifyContent: "center" }, sectionBody: { paddingHorizontal: 8, paddingVertical: 2 }, bodyFlush: { paddingVertical: 0 },
})

