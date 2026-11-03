import { StyleSheet, Text, View } from "react-native"
import { color } from "../../../theme.ts"
import { Card } from "../../ui.tsx"
import { SAMPLE_SITE } from "../../sample.ts"

/** Site traffic from the sample set. Not connected to any analytics yet. */
export function WebsiteView() {
  return (
    <Card title="Website traffic">
      <Text style={styles.note}>Sample data, not connected</Text>
      <Row label="Range" value={SAMPLE_SITE.range} />
      <Row label="Visitors" value={formatCount(SAMPLE_SITE.visitors)} />
      <Row label="Pageviews" value={formatCount(SAMPLE_SITE.pageviews)} />
      <Row label="Top page" value={SAMPLE_SITE.topPage} />
    </Card>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value} numberOfLines={2}>
        {value}
      </Text>
    </View>
  )
}

function formatCount(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",")
}

const styles = StyleSheet.create({
  note: { color: color.faint, fontSize: 12 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12, minHeight: 36, paddingVertical: 4 },
  label: { color: color.muted, fontSize: 14 },
  value: { flex: 1, color: color.text, fontSize: 14, fontWeight: "600", textAlign: "right" },
})
