import { Pressable, Text, TextInput, View } from "react-native"
import { color } from "../../../theme.ts"
import { Icon } from "../../ui.tsx"
import { MAX_DOC_LINKS, isSafeLink, type DocLink } from "./doc-links.ts"
import { TextAction, shared } from "./sheet-parts.tsx"

/**
 * Linked documents: rows of a name and a URL, edited like the web's task form. They are stored with
 * the task and open in their own app from the web; this editor never opens them. A URL that is not
 * a web link or a known app link (siyuan://, obsidian://, ...) is flagged and blocks saving, so
 * nothing is dropped quietly.
 */
export function LinksSection({ links, onChange, error, hint = "Notes, specs or files that live elsewhere. Saved with the task; open them from the web app." }: { links: DocLink[]; onChange: (links: DocLink[]) => void; error?: string; hint?: string }) {
  const edit = (i: number, patch: Partial<DocLink>) => onChange(links.map((l, j) => (j === i ? { ...l, ...patch } : l)))
  return (
    <>
      <Text style={shared.hint}>{hint}</Text>
      {links.map((l, i) => {
        const bad = !!l.url.trim() && !isSafeLink(l.url)
        return (
          <View key={i} style={{ gap: 6 }}>
            <View style={shared.row}>
              <TextInput value={l.label} onChangeText={(label) => edit(i, { label })} placeholder="Name, e.g. Lab 7 doc" placeholderTextColor={color.faint} accessibilityLabel={`Link ${i + 1} name`} style={[shared.input, { flex: 1 }]} />
              <Pressable onPress={() => onChange(links.filter((_, j) => j !== i))} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }} accessibilityRole="button" accessibilityLabel={`Remove link ${i + 1}`}>
                <Icon name="close" size={20} tint={color.text2} />
              </Pressable>
            </View>
            <TextInput value={l.url} onChangeText={(url) => edit(i, { url })} placeholder="https://… or siyuan://blocks/…" placeholderTextColor={color.faint} accessibilityLabel={`Link ${i + 1} URL`} autoCapitalize="none" autoCorrect={false} keyboardType="url" style={shared.input} />
            {bad ? <Text style={shared.error}>Use a web link (https://) or an app link like siyuan://.</Text> : null}
          </View>
        )
      })}
      {error && !links.some((l) => !!l.url.trim() && !isSafeLink(l.url)) ? <Text style={shared.error}>{error}</Text> : null}
      {links.length < MAX_DOC_LINKS ? <TextAction label="Add link" onPress={() => onChange([...links, { label: "", url: "" }])} /> : null}
    </>
  )
}
