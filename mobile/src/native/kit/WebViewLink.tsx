import { Pressable, StyleSheet, Text, View } from "react-native"
import { plannerColor as c } from "../planner-theme.ts"
import { Icon } from "../ui.tsx"

/**
 * The one way a native screen points at something only Web view does yet: a short line and a tappable
 * "Web view" link that switches to that page. Without a handler it is just the line.
 */
export function WebViewLink({ text, action = "Web view", path, onUseWeb }: { text?: string; action?: string; path?: string; onUseWeb?: (path?: string) => void }) {
  return (
    <View style={s.row}>
      {text ? <Text style={s.text}>{text}</Text> : null}
      {onUseWeb ? (
        <Pressable onPress={() => onUseWeb(path)} hitSlop={6} style={({ pressed }) => [s.link, pressed && s.pressed]} accessibilityRole="link" accessibilityLabel={`${action}, opens Web view`}>
          <Text style={s.linkText}>{action}</Text><Icon name="open-outline" size={11} tint={c.accent} />
        </Pressable>
      ) : null}
    </View>
  )
}

const s = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 6, rowGap: 2 },
  text: { flexShrink: 1, color: c.muted, fontSize: 11, lineHeight: 16 },
  link: { minHeight: 32, flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 2 },
  pressed: { opacity: 0.7 },
  linkText: { color: c.accent, fontSize: 11, fontWeight: "600" },
})
