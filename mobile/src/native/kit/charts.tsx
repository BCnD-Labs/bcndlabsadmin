import type { ReactNode } from "react"
import { StyleSheet, Text, View } from "react-native"
import Svg, { Circle, Polyline, Text as SvgText } from "react-native-svg"
import { shape } from "../../shape.ts"
import { mono } from "../../theme.ts"
import { plannerColor as c } from "../planner-theme.ts"
import { Icon, type IconName } from "../ui.tsx"
import { percent, type HeatCell } from "./stats.ts"
import { heatFill, kit } from "./tokens.ts"

/** A rounded-square icon tile in a category hue (the same tile the panel title bars use). */
export function IconTile({ name, tint = kit.hue.learning, size = 28 }: { name: IconName; tint?: string; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: Math.round(size * 0.3), alignItems: "center", justifyContent: "center", backgroundColor: `${tint}26` }}><Icon name={name} size={Math.round(size * 0.55)} tint={tint} /></View>
}

/** A progress ring with the whole percent in the middle. `value` is 0..1. */
export function Ring({ value, size = 30, thickness = 3, tint = kit.hue.learning, label }: { value: number; size?: number; thickness?: number; tint?: string; label?: string }) {
  const r = (size - thickness) / 2
  const circ = 2 * Math.PI * r
  const pct = percent(value)
  const fontSize = Math.max(8, Math.round(size * (size > 44 ? 0.24 : 0.28)))
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={label ?? `${pct} percent`} accessibilityValue={{ min: 0, max: 100, now: pct }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="#232426" strokeWidth={thickness} fill="none" />
        {pct > 0 ? <Circle cx={size / 2} cy={size / 2} r={r} stroke={tint} strokeWidth={thickness} fill="none" strokeLinecap="round" strokeDasharray={`${circ * pct / 100} ${circ}`} rotation={-90} origin={`${size / 2}, ${size / 2}`} /> : null}
        <SvgText x={size / 2} y={size / 2 + fontSize * 0.36} fontSize={fontSize} fontWeight="700" fill={c.text} textAnchor="middle" fontFamily={mono}>{size > 44 ? `${pct}%` : pct}</SvgText>
      </Svg>
    </View>
  )
}

/** A tiny trend line. Needs two or more points; a flat series draws a level line. */
export function Sparkline({ values, tint = c.accent, height = 14 }: { values: number[]; tint?: string; height?: number }) {
  if (values.length < 2) return <View style={{ height }} />
  const min = Math.min(...values)
  const span = Math.max(...values) - min
  const points = values.map((v, i) => `${(i / (values.length - 1) * 60).toFixed(1)},${(span ? 12 - (v - min) / span * 10 : 7).toFixed(1)}`).join(" ")
  return <Svg width="100%" height={height} viewBox="0 0 60 14" preserveAspectRatio="none"><Polyline points={points} fill="none" stroke={tint} strokeWidth={1.6} /></Svg>
}

/** A thin horizontal progress bar. `value` is 0..1. */
export function MiniBar({ value, tint = kit.hue.learning, width }: { value: number; tint?: string; width?: number }) {
  return <View style={[s.track, width != null && { width }]}><View style={{ height: 4, width: `${percent(value)}%`, backgroundColor: tint }} /></View>
}

export interface StackPart { label: string; value: number; color: string }
/** One bar split into parts (done / open / overdue); parts with no value are left out. */
export function StackedBar({ parts, height = 10 }: { parts: StackPart[]; height?: number }) {
  const shown = parts.filter(p => p.value > 0)
  return (
    <View>
      <View style={[s.stack, { height }]} accessible accessibilityLabel={parts.map(p => `${p.value} ${p.label}`).join(", ")}>
        {shown.length ? shown.map(p => <View key={p.label} style={{ flex: p.value, backgroundColor: p.color }} />) : <View style={{ flex: 1, backgroundColor: "#232426" }} />}
      </View>
      <View style={s.legend}>{parts.map(p => <View key={p.label} style={s.legendItem}><View style={[s.swatch, { backgroundColor: p.color }]} /><Text style={s.legendText}>{p.value} {p.label.toUpperCase()}</Text></View>)}</View>
    </View>
  )
}

/** The row of headline numbers at the top of a page. */
export function StatStrip({ children }: { children: ReactNode }) { return <View style={s.strip}>{children}</View> }
export function StatCell({ label, value, tint = c.text, children }: { label: string; value: string | number; tint?: string; children?: ReactNode }) {
  return <View style={s.cell} accessible accessibilityLabel={`${label}: ${value}`}><Text style={s.cellLabel} numberOfLines={1}>{label.toUpperCase()}</Text><Text style={[s.cellValue, { color: tint }]}>{value}</Text>{children}</View>
}

/** Seven small blocks, one per day, filled on days with a completion. Oldest first. */
export function BlockStreak({ days }: { days: boolean[] }) {
  return <View style={s.blocks}>{days.map((on, i) => <View key={i} style={[s.block, { backgroundColor: on ? kit.good : c.line }]} />)}</View>
}

/** Completed-per-day bars Monday to Sunday: values on top, today highlighted, days to come dashed. */
export function WeekBars({ counts, labels, todayIndex, average }: { counts: number[]; labels: string[]; todayIndex: number; average: number }) {
  const max = Math.max(1, ...counts)
  return (
    <View accessible accessibilityLabel={`Tasks completed: ${labels.map((l, i) => `${l} ${i > todayIndex ? "not yet" : counts[i]}`).join(", ")}`}>
      <View style={s.weekArea}>
        {average > 0 ? <View style={[s.avgLine, { bottom: Math.round(average / max * BAR_AREA) }]}><Text style={s.avgText}>AVG {average}/DAY</Text></View> : null}
        {counts.map((n, i) => {
          const future = i > todayIndex
          return (
            <View key={i} style={s.weekCol}>
              <Text style={[s.weekValue, i === todayIndex && { color: c.accent }]}>{future ? "-" : n}</Text>
              <View style={[s.weekBar, { height: future ? 4 : n ? 4 + Math.round(n / max * (BAR_AREA - 4)) : 2 }, future ? s.weekFuture : { backgroundColor: i === todayIndex ? c.accent : n ? kit.good : c.line }]} />
            </View>
          )
        })}
      </View>
      <View style={s.weekLabels}>{labels.map((l, i) => <Text key={i} style={[s.weekLabel, i === todayIndex && { color: c.accent }]}>{l}</Text>)}</View>
    </View>
  )
}

/** Weeks of days, Monday first, shaded by how much was completed. Days to come are left empty. */
export function HeatGrid({ cells }: { cells: HeatCell[] }) {
  const rows: HeatCell[][] = []
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7))
  return (
    <View accessible accessibilityLabel={`Tasks completed per day over ${rows.length} weeks, ${cells.reduce((n, x) => n + x.count, 0)} in total`}>
      <View style={s.heatRow}>{["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map(d => <Text key={d} style={s.heatDay}>{d}</Text>)}</View>
      {rows.map((row, i) => <View key={i} style={s.heatRow}>{row.map(cell => <View key={cell.key} style={[s.heatCell, cell.future ? s.heatFuture : { backgroundColor: heatFill[cell.level] }, cell.today && { borderColor: c.accent }]} />)}</View>)}
      <View style={s.heatLegend}><Text style={s.heatWord}>LESS</Text>{heatFill.map(f => <View key={f} style={[s.heatKey, { backgroundColor: f }]} />)}<Text style={s.heatWord}>MORE</Text></View>
    </View>
  )
}

const BAR_AREA = 60
const s = StyleSheet.create({
  track: { height: 4, borderRadius: 2, backgroundColor: "#232426", overflow: "hidden", width: "100%" },
  stack: { flexDirection: "row", borderRadius: 5, overflow: "hidden", gap: 2 },
  legend: { flexDirection: "row", flexWrap: "wrap", columnGap: 12, rowGap: 4, marginTop: 6 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 }, swatch: { width: 8, height: 8, borderRadius: 2 },
  legendText: { color: c.text2, fontFamily: mono, fontSize: 9.5, fontWeight: "700" },
  strip: { flexDirection: "row", gap: 6 },
  cell: { flex: 1, minWidth: 0, backgroundColor: c.panel, borderRadius: shape.card, borderWidth: 1, borderColor: c.line, paddingHorizontal: 8, paddingVertical: 6, gap: 3 },
  cellLabel: { color: kit.mutedInk, fontFamily: mono, fontSize: 8.5, fontWeight: "700", letterSpacing: 0.8 },
  cellValue: { fontSize: 20, lineHeight: 24, fontWeight: "700", fontVariant: ["tabular-nums"] },
  blocks: { flexDirection: "row", gap: 2, height: 14, alignItems: "center" }, block: { flex: 1, height: 8, borderRadius: 2 },
  weekArea: { height: 14 + BAR_AREA, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: c.border },
  weekCol: { width: 34, alignItems: "center", justifyContent: "flex-end", gap: 3 }, weekValue: { color: c.text2, fontFamily: mono, fontSize: 10, fontWeight: "700", height: 12 },
  weekBar: { width: 22, borderTopLeftRadius: 4, borderTopRightRadius: 4 }, weekFuture: { borderWidth: 1, borderStyle: "dashed", borderColor: "#8a8e96", backgroundColor: "transparent" },
  weekLabels: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 4, paddingTop: 4 }, weekLabel: { width: 34, textAlign: "center", color: kit.mutedInk, fontFamily: mono, fontSize: 9, fontWeight: "700" },
  avgLine: { position: "absolute", left: 0, right: 0, borderTopWidth: 1, borderStyle: "dashed", borderColor: "#8a8e96" },
  avgText: { position: "absolute", right: 0, top: -13, color: c.muted, fontFamily: mono, fontSize: 8.5, fontWeight: "700", letterSpacing: 0.5 },
  heatRow: { flexDirection: "row", gap: 3, marginBottom: 3 }, heatDay: { flex: 1, textAlign: "center", color: kit.mutedInk, fontFamily: mono, fontSize: 8.5, fontWeight: "700", letterSpacing: 0.6 },
  heatCell: { flex: 1, height: 19, borderRadius: 4, borderWidth: 1, borderColor: c.line }, heatFuture: { backgroundColor: "transparent", borderStyle: "dashed" },
  heatWord: { color: kit.mutedInk, fontFamily: mono, fontSize: 8.5, fontWeight: "700", letterSpacing: 0.6 },
  heatLegend: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 4, marginTop: 5 }, heatKey: { width: 14, height: 10, borderRadius: 3, borderWidth: 1, borderColor: c.line },
})
