import type { SitePalette } from "../src/lib/types.ts"

export const STARTERS: Record<string, { name: string; light: SitePalette; dark: SitePalette }> = {
  midnight: { name: "Midnight", light: { bg: "#ffffff", surface: "#f4f5f7", text: "#1a1c1e", muted: "#5c6166", border: "#dfe2e6", accent: "#3b6fe0" }, dark: { bg: "#1e1f20", surface: "#262829", text: "#e5e6e6", muted: "#9a9b9c", border: "#3a3b3c", accent: "#6f9ef5" } },
  forest: { name: "Forest", light: { bg: "#ffffff", surface: "#f2f6f3", text: "#1b2420", muted: "#54605b", border: "#dae2dd", accent: "#2f8457" }, dark: { bg: "#161a18", surface: "#1f2522", text: "#e3e8e5", muted: "#95a09b", border: "#333b37", accent: "#57b183" } },
  ember: { name: "Ember", light: { bg: "#fffdfb", surface: "#f8f2ee", text: "#241c18", muted: "#665a53", border: "#e7dcd4", accent: "#c9512a" }, dark: { bg: "#1f1a17", surface: "#282220", text: "#eae4e0", muted: "#a2968f", border: "#3d3531", accent: "#e87d55" } },
  slate: { name: "Slate", light: { bg: "#ffffff", surface: "#f3f4f8", text: "#1a1c24", muted: "#575c6c", border: "#dcdee8", accent: "#5560c4" }, dark: { bg: "#17181d", surface: "#1f2128", text: "#e4e5ea", muted: "#95989f", border: "#34363f", accent: "#8d96ea" } },
  rose: { name: "Rose", light: { bg: "#fffcfd", surface: "#f9f0f4", text: "#241a1e", muted: "#67565d", border: "#e9dae0", accent: "#c0426f" }, dark: { bg: "#1d181a", surface: "#262022", text: "#eae2e5", muted: "#a1949a", border: "#3b3236", accent: "#e4799e" } },
  sand: { name: "Sand", light: { bg: "#fffefb", surface: "#f7f3ea", text: "#232019", muted: "#635b4c", border: "#e5ddcb", accent: "#9c7022" }, dark: { bg: "#1c1a16", surface: "#25221c", text: "#e8e4da", muted: "#9e978a", border: "#393428", accent: "#d3a44e" } },
}
