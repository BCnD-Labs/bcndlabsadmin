import { useWindowDimensions } from "react-native"
import { layoutMode, pageWidth, type LayoutMode } from "./orientation.ts"

/** Screens ask this instead of reading the window size themselves: the mode, and how wide the page area is (the sidebar excluded). */
export function useLayoutMode(): { mode: LayoutMode; landscape: boolean; width: number; height: number } {
  const { width, height } = useWindowDimensions()
  const mode = layoutMode(width, height)
  return { mode, landscape: mode === "landscape", width: pageWidth(width, mode), height }
}
