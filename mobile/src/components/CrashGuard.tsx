import { Component, type ErrorInfo, type ReactNode } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { crashDetail, crashTitle } from "../lib/crash.ts"
import { shape } from "../shape.ts"
import { color, mono } from "../theme.ts"
import { plannerColor as c } from "../native/planner-theme.ts"

type Props = {
  scope: "screen" | "app"
  /** The screen's name, for a screen-level guard. */
  label?: string
  /** Switches to Web view (saved like the Settings choice). */
  onUseWeb: () => void
  onOpenSettings: () => void
  children: ReactNode
}

/**
 * Catches a crash while drawing native screens so the app never goes blank. A screen-level guard keeps the
 * navigation working; the app-level guard catches the rest. Both offer Try again and Switch to Web view, and
 * nothing is saved or changed until you pick one.
 */
export class CrashGuard extends Component<Props, { error: unknown; hasError: boolean }> {
  state = { error: undefined as unknown, hasError: false }

  static getDerivedStateFromError(error: unknown) {
    return { error, hasError: true }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error(`Native ${this.props.scope} crash${this.props.label ? ` (${this.props.label})` : ""}`, error, info.componentStack)
  }

  private retry = () => this.setState({ error: undefined, hasError: false })

  render() {
    if (!this.state.hasError) return this.props.children
    const { scope, label, onUseWeb, onOpenSettings } = this.props
    return (
      <View style={s.wrap} accessibilityRole="alert">
        <View style={s.card}>
          <Text style={s.title}>{crashTitle(scope, label)}</Text>
          <Text style={s.body}>
            Your saved records are safe on the server. Try again, or switch to Web view{scope === "screen" ? " or another screen" : ""} for now.
          </Text>
          <Text style={s.detail} selectable numberOfLines={3}>{crashDetail(this.state.error)}</Text>
          <View style={s.actions}>
            <Action label="Try again" primary onPress={this.retry} />
            <Action label="Switch to Web view" onPress={onUseWeb} />
            <Action label="Settings" onPress={onOpenSettings} />
          </View>
        </View>
      </View>
    )
  }
}

function Action({ label, onPress, primary }: { label: string; onPress: () => void; primary?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={4} style={({ pressed }) => [s.action, primary && s.primary, pressed && s.pressed]}>
      <Text style={[s.actionText, primary && s.primaryText]}>{label}</Text>
    </Pressable>
  )
}

const s = StyleSheet.create({
  wrap: { flex: 1, justifyContent: "center", padding: 20, backgroundColor: color.ground },
  card: { backgroundColor: color.panel, borderColor: color.line, borderWidth: StyleSheet.hairlineWidth, borderRadius: shape.dialog, padding: 16, gap: 10 },
  title: { color: color.text, fontSize: 16, fontWeight: "700" },
  body: { color: color.text2, fontSize: 13, lineHeight: 19 },
  detail: { color: color.muted, fontFamily: mono, fontSize: 11, backgroundColor: color.well, borderRadius: shape.menu, padding: 8 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 2 },
  action: { minHeight: 36, paddingHorizontal: 12, justifyContent: "center", borderRadius: shape.menu, backgroundColor: color.raised },
  primary: { backgroundColor: c.action },
  pressed: { opacity: 0.8 },
  actionText: { color: color.text, fontSize: 13, fontWeight: "600" },
  primaryText: { color: "#ffffff" },
})
