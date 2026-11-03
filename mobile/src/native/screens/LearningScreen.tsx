import { useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { color } from "../../theme.ts"
import { Card, Icon, ProgressBar, Screen, SampleBadge } from "../ui.tsx"
import { SAMPLE_COURSES, SAMPLE_COURSEWORK, type SampleCourse, type SampleCoursework } from "../sample.ts"
import { CourseBody } from "./learning/CourseBody.tsx"

/** Courses and their coursework (sample data). Done state is local and resets when the app closes. */
export function LearningScreen(_props: { onOpenSettings: () => void }) {
  const [openId, setOpenId] = useState<string | null>(null)
  const [doneMap, setDoneMap] = useState<Record<string, boolean>>({})
  const isDone = (w: SampleCoursework) => doneMap[w.id] ?? w.done
  const toggle = (w: SampleCoursework) => setDoneMap((m) => ({ ...m, [w.id]: !isDone(w) }))

  const course = SAMPLE_COURSES.find((c) => c.id === openId)
  if (course) {
    return (
      <Screen title={course.name} subtitle={`${course.code} · ${course.term}`} right={<SampleBadge />}>
        <CourseBody
          course={course}
          items={SAMPLE_COURSEWORK.filter((w) => w.courseId === course.id)}
          isDone={isDone}
          onToggle={toggle}
          onBack={() => setOpenId(null)}
        />
      </Screen>
    )
  }

  return (
    <Screen title="Learning" subtitle={`${SAMPLE_COURSES.length} courses · ${SAMPLE_COURSES[0]?.term ?? ""}`} right={<SampleBadge />}>
      {SAMPLE_COURSES.map((c) => {
        const items = SAMPLE_COURSEWORK.filter((w) => w.courseId === c.id)
        const done = items.filter(isDone).length
        return (
          <CourseCard key={c.id} course={c} total={items.length} done={done} onOpen={() => setOpenId(c.id)} />
        )
      })}
    </Screen>
  )
}

function CourseCard({ course, total, done, onOpen }: { course: SampleCourse; total: number; done: number; onOpen: () => void }) {
  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`Open ${course.name}, ${done} of ${total} done`}
      style={({ pressed }) => [pressed && styles.pressed]}
    >
      <Card>
        <View style={styles.head}>
          <View style={[styles.dot, { backgroundColor: course.color }]} />
          <View style={styles.flex}>
            <Text style={styles.code}>{course.code}</Text>
            <Text style={styles.name}>{course.name}</Text>
          </View>
          <Icon name="chevron-forward" size={18} />
        </View>
        <Text style={styles.meta}>{`${course.instructor} · ${course.schedule}`}</Text>
        <Text style={styles.meta}>{`${course.credits} credits`}</Text>
        <ProgressBar value={total === 0 ? 0 : done / total} />
        <Text style={styles.progress}>{`${done} of ${total} done`}</Text>
      </Card>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.85 },
  head: { flexDirection: "row", alignItems: "center", gap: 10 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  code: { color: color.muted, fontSize: 12, fontWeight: "700" },
  name: { color: color.text, fontSize: 16, fontWeight: "700" },
  meta: { color: color.muted, fontSize: 13 },
  progress: { color: color.text2, fontSize: 13, fontWeight: "600" },
})
