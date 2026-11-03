import { Card, Screen, SampleBadge } from "../ui.tsx"

export function MoreScreen(_props: { onOpenSettings: () => void }) {
  return (
    <Screen title="More" right={<SampleBadge />}>
      <Card title="Coming soon" />
    </Screen>
  )
}
