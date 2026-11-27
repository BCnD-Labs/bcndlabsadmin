import { useEffect, useState } from "react"
import { Image, StyleSheet, Text, View } from "react-native"
import { fetchAttachment, previewKind, saveAttachment, toBase64, type MailResult } from "../../lib/mail-client.ts"
import { crumbs, fetchFolder } from "../../lib/storage-client.ts"
import { formatSize, type FolderListing, type MailAttachment } from "../../lib/shared.ts"
import { plannerColor as c } from "../planner-theme.ts"
import { Pill, SmallButton } from "./learning/LearningControls.tsx"

type Shown = { kind: "image"; uri: string } | { kind: "text"; text: string } | { kind: "error"; message: string } | { kind: "loading" }

/** One attachment: preview pictures and plain text, save any file to Nextcloud, or open Web view for other formats. */
export function MailAttachmentRow({ address, folder, uid, attachment, onUseWeb }: { address: string; folder: string; uid: number; attachment: MailAttachment; onUseWeb?: () => void }) {
  const kind = previewKind(attachment)
  const [shown, setShown] = useState<Shown | null>(null)
  const [picking, setPicking] = useState(false)
  const [saved, setSaved] = useState<MailResult<string> | null>(null)

  const preview = async () => {
    if (shown) { setShown(null); return }
    setShown({ kind: "loading" })
    const r = await fetchAttachment(address, folder, uid, attachment.index, 5 * 1024 * 1024)
    if (!r.ok) { setShown({ kind: "error", message: r.message }); return }
    setShown(kind === "image" ? { kind: "image", uri: `data:${attachment.mime};base64,${toBase64(r.value)}` } : { kind: "text", text: new TextDecoder().decode(r.value) })
  }
  const save = async (to: string) => { setPicking(false); setSaved(await saveAttachment(address, folder, uid, attachment.index, to)) }

  return <View style={s.row}>
    <Text style={s.name} numberOfLines={2}>📎 {attachment.name} <Text style={s.meta}>({formatSize(attachment.size)})</Text></Text>
    <View style={s.actions}>
      {kind ? <SmallButton label={shown ? "Hide" : "Preview"} onPress={() => void preview()} /> : onUseWeb ? <SmallButton label="Open in Web view" onPress={onUseWeb} /> : null}
      <SmallButton label="Save to Nextcloud" onPress={() => { setSaved(null); setPicking(p => !p) }} />
    </View>
    {shown?.kind === "loading" ? <Text style={s.meta}>Opening…</Text> : null}
    {shown?.kind === "error" ? <Text style={s.error}>{shown.message}</Text> : null}
    {shown?.kind === "image" ? <Image source={{ uri: shown.uri }} style={s.image} resizeMode="contain" accessibilityLabel={attachment.name} /> : null}
    {shown?.kind === "text" ? <Text style={s.text} selectable>{shown.text}</Text> : null}
    {saved ? <Text style={saved.ok ? s.meta : s.error} accessibilityLiveRegion="polite">{saved.ok ? `Saved to Nextcloud as ${saved.value}.` : saved.message}</Text> : null}
    {picking ? <FolderPicker address={address} onChoose={path => void save(path)} onCancel={() => setPicking(false)} /> : null}
  </View>
}

/** Pick a Nextcloud folder by walking down from the top. Files are never replaced: the server refuses an existing name. */
function FolderPicker({ address, onChoose, onCancel }: { address: string; onChoose: (path: string) => void; onCancel: () => void }) {
  const [path, setPath] = useState("/")
  const [listing, setListing] = useState<{ ok: true; value: FolderListing } | { ok: false; message: string } | null>(null)
  useEffect(() => {
    let active = true
    setListing(null)
    void fetchFolder(address, path).then(r => { if (active) setListing(r.ok ? r : { ok: false, message: r.message }) })
    return () => { active = false }
  }, [address, path])
  const dirs = listing?.ok ? listing.value.entries.filter(e => e.type === "dir") : []
  return <View style={s.picker}>
    <View style={s.actions}>{crumbs(path).map(k => <Pill key={k.path} label={k.label} selected={k.path === path} onPress={() => setPath(k.path)} />)}</View>
    {!listing ? <Text style={s.meta}>Loading folders…</Text> : !listing.ok ? <Text style={s.error}>{listing.message}</Text> : !dirs.length ? <Text style={s.meta}>No folders here.</Text> : <View style={s.actions}>{dirs.map(d => <Pill key={d.path} label={`${d.name}/`} selected={false} onPress={() => setPath(d.path)} />)}</View>}
    <View style={s.actions}><SmallButton label={`Save in ${path === "/" ? "Files" : path.split("/").pop()}`} onPress={() => onChoose(path)} /><SmallButton label="Cancel" onPress={onCancel} /></View>
  </View>
}

const s = StyleSheet.create({
  row: { gap: 6, paddingVertical: 4 }, name: { color: c.text2, fontSize: 12 }, meta: { color: c.muted, fontSize: 11 }, error: { color: c.errorText, fontSize: 12 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 6 }, image: { width: "100%", height: 240, backgroundColor: c.panel }, text: { color: c.text2, fontSize: 12, lineHeight: 18, padding: 8, backgroundColor: c.panel, borderWidth: 1, borderColor: c.line },
  picker: { gap: 8, padding: 8, borderWidth: 1, borderColor: c.line },
})
