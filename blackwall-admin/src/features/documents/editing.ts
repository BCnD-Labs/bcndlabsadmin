import type { EditingInfo } from "@/features/mikoshi/storage-api"

export const extensionOf = (name: string) => /\.([a-z0-9]+)$/i.exec(name.trim())?.[1]?.toLowerCase() ?? ""

/** Whether Nextcloud's office editor (Collabora) is set up and can open this file. */
export const canEditFile = (info: Pick<EditingInfo, "available" | "extensions"> | null, name: string) => !!info?.available && info.extensions.includes(extensionOf(name))
