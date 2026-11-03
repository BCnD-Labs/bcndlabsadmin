import { Linking, Text } from "react-native"
import { useWorkspace } from "../data/WorkspaceProvider.tsx"
import { Badge, Card, Empty, ListRow, Screen, tone } from "../ui.tsx"

/** Project and repository records from the workspace. Live GitHub activity belongs to the connection service. */
export function DevScreen() {
  const { data, status, message, refreshing, refresh } = useWorkspace()
  return <Screen title="Projects" subtitle={data ? `${data.projects.length} projects · ${data.repos.length} repos` : undefined} onRefresh={() => void refresh()} refreshing={refreshing}>
    {data ? <>
      {data.projects.map(project => <Card key={project.id} title={project.name} right={<Badge label={project.status} tint={project.status === "active" ? tone.green : tone.grey} />}>
        {project.description ? <Text style={{ color: "#aab1bc", fontSize: 13 }}>{project.description}</Text> : null}
        {data.repos.filter(repo => repo.projectId === project.id).map(repo => <ListRow key={repo.id} title={repo.fullName} subtitle={repo.url} onPress={() => void Linking.openURL(repo.url)} />)}
      </Card>)}
      {data.repos.filter(repo => !repo.projectId || !data.projects.some(p => p.id === repo.projectId)).length ? <Card title="Other repositories">{data.repos.filter(repo => !repo.projectId || !data.projects.some(p => p.id === repo.projectId)).map(repo => <ListRow key={repo.id} title={repo.fullName} subtitle={repo.url} onPress={() => void Linking.openURL(repo.url)} />)}</Card> : null}
      {!data.projects.length && !data.repos.length ? <Card><Empty>No projects or repositories in your workspace yet.</Empty></Card> : null}
    </> : <Card><Empty>{status === "signed-out" ? "Sign in under Settings to see your projects." : message ?? "Loading your workspace…"}</Empty></Card>}
  </Screen>
}
