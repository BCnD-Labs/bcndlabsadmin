import { create } from "zustand"

/** Asks the writer what a picture shows before it is added, so the description is entered once and travels with the picture. */
interface Ask {
  file: File
  src: string
  resolve: (alt: string | undefined) => void
}

export const useDescribeImage = create<{ ask?: Ask }>()(() => ({}))

/**
 * Resolves with the description to publish: the text entered, or "" when the writer says the picture is only decoration.
 * Resolves undefined if they cancelled, in which case the picture is not added.
 */
export function describeImage(file: File): Promise<string | undefined> {
  return new Promise((resolve) => {
    const src = URL.createObjectURL(file)
    useDescribeImage.setState({ ask: { file, src, resolve: (alt) => { URL.revokeObjectURL(src); resolve(alt) } } })
  })
}

export const answerDescribeImage = (alt: string | undefined) => {
  useDescribeImage.getState().ask?.resolve(alt)
  useDescribeImage.setState({ ask: undefined })
}

/** A file name turned into a starting point nobody should keep: used only to tell when the box still holds one. */
export const looksLikeFileName = (text: string) => /\.(png|jpe?g|gif|webp|avif|svg)$/i.test(text.trim())
