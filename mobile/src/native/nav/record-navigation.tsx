import { createContext, useContext } from "react"
import type { RecordLink } from "../screens/planner/record-links.ts"
export type RecordRequest = RecordLink & { serial: number }
export const RecordNavigation = createContext({ request: null as RecordRequest | null, open: (_link: RecordLink) => {}, handled: () => {} })
export const useRecordNavigation = () => useContext(RecordNavigation)
