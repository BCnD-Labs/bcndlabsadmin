import { shape } from "../shape.ts"
import { useEffect, useRef, type ReactNode } from "react"
import { Animated, Easing, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native"
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

export function WorkspaceSection({ title, icon, tint = c.accent, count, children }: { title: string; icon: IconName; tint?: string; count?: string; children: ReactNode }) {
  return <View style={s.section}><View style={s.sectionHead}><View style={s.sectionName}><View style={[s.icon, { backgroundColor: `${tint}26` }]}><Icon name={icon} size={15} tint={tint} /></View><Text style={s.sectionTitle} accessibilityRole="header">{title}</Text></View>{count ? <Text style={s.count}>{count}</Text> : null}</View>{children}</View>
}

const s = StyleSheet.create({
  fill: { flex: 1, backgroundColor: c.ground }, header: { paddingHorizontal: 14, paddingTop: 8, paddingBottom: 10, minHeight: 47, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }, crumb: { color: c.text, fontSize: 13, fontWeight: "600", flexShrink: 1 }, muted: { color: c.muted, fontWeight: "400" }, right: { flexDirection: "row", alignItems: "center", gap: 7 }, content: { padding: 14, paddingBottom: NAV_CLEARANCE }, body: { gap: 13 },
  section: { gap: 3 }, sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 32, gap: 8, marginBottom: 2, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: c.panel, borderRadius: shape.card, borderBottomWidth: 1, borderBottomColor: c.line }, sectionName: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 7 }, icon: { width: 25, height: 25, borderRadius: 8, alignItems: "center", justifyContent: "center" }, sectionTitle: { flexShrink: 1, color: c.text, fontSize: 14, fontWeight: "700", letterSpacing: 0.2 }, count: { color: c.muted, fontSize: 12 },
})

