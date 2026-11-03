import { Text } from "react-native"
import { useWorkspace } from "../data/WorkspaceProvider.tsx"
import { Button, Card, Screen } from "../ui.tsx"
import { NotesView } from "./planner/notes/NotesView.tsx"

/** Top-level Notes and Planner Notes edit the same workspace records. */
export function NotesScreen({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { data, status, message, refreshing, refresh } = useWorkspace()
  return <Screen title="Notes" onRefresh={() => void refresh()} refreshing={refreshing}>
    {data ? <NotesView data={data} blocked={status === "conflict" ? "Choose which edits to keep first." : undefined} /> : <Card title={status === "signed-out" ? "Sign in to use Notes" : "Loading your workspace"}><Text>{message ?? "Your notes will appear here."}</Text>{status === "signed-out" ? <Button label="Sign in" onPress={onOpenSettings} /> : null}</Card>}
  </Screen>
}
