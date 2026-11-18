import { useEffect, useState } from "react"
import { Image, StyleSheet, Text, View } from "react-native"
import { SvgXml } from "react-native-svg"
import { customLogoSource, loadIcon, type LogoSource } from "../../../lib/service-logo.ts"
import { plannerColor as c } from "../../planner-theme.ts"

/** A tool's logo in the row's 28px tile; the first letter when it has none or the logo can't be drawn. */
export function ServiceLogo({ address, name, logo, customLogo }: { address: string | null; name: string; logo?: string; customLogo?: string }) {
  const [source, setSource] = useState<LogoSource | null>(() => customLogoSource(customLogo))
  const [broken, setBroken] = useState(false)
  useEffect(() => {
    setBroken(false)
    const custom = customLogoSource(customLogo)
    if (custom || !address) { setSource(custom); return }
    let live = true
    setSource(null)
    void loadIcon(address, logo).then((xml) => { if (live && xml) setSource({ kind: "svg", xml }) })
    return () => { live = false }
  }, [address, logo, customLogo])

  const letter = <Text style={s.letter}>{name.trim().charAt(0).toUpperCase() || "?"}</Text>
  return (
    <View style={s.tile} accessible={false}>
      {!source || broken ? letter
        : source.kind === "image" ? <Image source={{ uri: source.uri }} style={s.img} resizeMode="contain" onError={() => setBroken(true)} />
        : <SvgXml xml={source.xml} width={20} height={20} fallback={letter} onError={() => setBroken(true)} />}
    </View>
  )
}

const s = StyleSheet.create({
  tile: { width: 28, height: 28, borderRadius: 8, backgroundColor: c.raised, borderWidth: 1, borderColor: c.line, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  img: { width: 20, height: 20 },
  letter: { color: c.accent, fontSize: 13, fontWeight: "700" },
})
