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
export function WorkspacePage({ page, onOpenSettings, action, center, compact = false, onRefresh, refreshing, children }: { page: string; onOpenSettings: () => void; action?: ReactNode; center?: ReactNode; compact?: boolean; onRefresh: () => void; refreshing: boolean; children: ReactNode }) {
  const reduce = useReduceMotion()
  const fade = useRef(new Animated.Value(1)).current
  useEffect(() => { if (reduce) { fade.setValue(1); return }; fade.setValue(0); Animated.timing(fade, { toValue: 1, duration: 190, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start() }, [fade, reduce])
  return <View style={s.fill}><View style={[s.header, compact && s.headerCompact]}><Text style={s.crumb}>Blackwall <Text style={s.muted}>/ {page}</Text></Text>{center ? <View pointerEvents="none" style={s.center}>{center}</View> : null}<View style={s.right}><SyncStatus onOpenSettings={onOpenSettings} />{action}</View></View><ScrollView style={s.fill} contentContainerStyle={[s.content, compact && s.contentCompact]} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.accent} colors={[c.accent]} />}><Animated.View style={[s.body, compact && s.bodyCompact, { opacity: fade, transform: [{ translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [5, 0] }) }] }]}>{children}</Animated.View></ScrollView></View>
}

/**
 * A tool panel: a darker title bar (icon tile, name, count, optional controls and collapse) over its body.
 * `collapsible` adds a chevron that hides the body; `flush` removes the body's side padding for table rows.
 */
export function WorkspaceSection({ title, icon, tint = c.accent, count, right, collapsible, defaultCollapsed, collapsed, onCollapsedChange, flush, compact = false, children }: { title: string; icon: IconName; tint?: string; count?: string; right?: ReactNode; collapsible?: boolean; defaultCollapsed?: boolean; collapsed?: boolean; onCollapsedChange?: (collapsed: boolean) => void; flush?: boolean; compact?: boolean; children: ReactNode }) {
  const [closed, setClosed] = useState(!!defaultCollapsed)
  const hidden = !!collapsible && (collapsed ?? closed)
  return <View style={[s.section, compact && s.sectionCompact, compact && { borderLeftColor: tint }]}>
    <View style={[s.sectionHead, compact && s.sectionHeadCompact, hidden && s.sectionHeadClosed]}>
      <View style={[s.sectionName, compact && s.sectionNameCompact]}><View style={[s.icon, compact && s.iconCompact, { backgroundColor: `${tint}26`, borderColor: `${tint}61` }]}><Icon name={icon} size={compact ? 13 : 14} tint={tint} /></View><Text style={[s.sectionTitle, compact && s.sectionTitleCompact]} accessibilityRole="header" numberOfLines={1}>{title}</Text>{count ? <Text style={[s.count, compact && { color: tint }]}>{count}</Text> : null}</View>
      {right}
      {collapsible ? <Pressable onPress={() => onCollapsedChange ? onCollapsedChange(!hidden) : setClosed(v => !v)} hitSlop={6} style={[s.collapse, compact && s.collapseCompact]} accessibilityRole="button" accessibilityLabel={`${hidden ? "Expand" : "Collapse"} ${title}`} accessibilityState={{ expanded: !hidden }}><Icon name={hidden ? "chevron-down" : "chevron-up"} size={16} tint={c.muted} /></Pressable> : null}
    </View>
    {hidden ? null : <View style={flush ? s.bodyFlush : s.sectionBody}>{children}</View>}
  </View>
}

const s = StyleSheet.create({
  fill: { flex: 1, backgroundColor: c.ground }, header: { paddingHorizontal: 14, paddingTop: 8, paddingBottom: 10, minHeight: 47, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }, headerCompact: { minHeight: 40, paddingHorizontal: 9, paddingTop: 4, paddingBottom: 4 }, center: { position: "absolute", left: 0, right: 0, alignItems: "center" }, crumb: { color: c.text, fontSize: 13, fontWeight: "600", flexShrink: 1 }, muted: { color: c.muted, fontWeight: "400" }, right: { flexDirection: "row", alignItems: "center", gap: 7 }, content: { padding: 14, paddingBottom: NAV_CLEARANCE }, contentCompact: { paddingHorizontal: 9, paddingTop: 3 }, body: { gap: 10 }, bodyCompact: { gap: 7 },
  section: { backgroundColor: c.panel, borderRadius: shape.card, borderWidth: 1, borderColor: c.line, overflow: "hidden" }, sectionCompact: { borderRadius: 8, borderLeftWidth: 3 },
  sectionHead: { flexDirection: "row", alignItems: "center", minHeight: 34, gap: 8, paddingLeft: 7, paddingRight: 4, backgroundColor: kit.titlebar, borderBottomWidth: 1, borderBottomColor: c.line }, sectionHeadCompact: { minHeight: 27, paddingLeft: 0, paddingRight: 3, gap: 3 }, sectionHeadClosed: { borderBottomWidth: 0 },
  sectionName: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 7 }, sectionNameCompact: { gap: 5 }, icon: { width: 22, height: 22, borderRadius: 6, borderWidth: 1, alignItems: "center", justifyContent: "center" }, iconCompact: { width: 25, height: 26, borderRadius: 0, borderWidth: 0 },
  sectionTitle: { flexShrink: 1, color: c.text, fontFamily: mono, fontSize: 11, fontWeight: "700", letterSpacing: 0.9, textTransform: "uppercase" }, sectionTitleCompact: { fontSize: 10 }, count: { color: c.muted, fontFamily: mono, fontSize: 10.5 },
  collapse: { width: 36, height: 32, alignItems: "center", justifyContent: "center" }, collapseCompact: { width: 40, height: 30 }, sectionBody: { paddingHorizontal: 8, paddingVertical: 2 }, bodyFlush: { paddingVertical: 0 },
})

