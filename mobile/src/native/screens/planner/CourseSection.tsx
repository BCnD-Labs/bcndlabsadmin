import { Text, TextInput, View } from "react-native"
import { type Collections } from "../../../lib/shared.ts"
import { color } from "../../../theme.ts"
import { Chip } from "../../ui.tsx"
import { courseLabel, isScored, typeAfterCourseChange, typeOptions } from "./learning-types.ts"
import { shared } from "./sheet-parts.tsx"
import type { ExtraErrors, Extras } from "./task-extras.ts"

/**
 * The web form's "Learning" fields: which course (data.courses) the task belongs to and, once one
 * is chosen, what kind of item it is (labelled the way that course's kind names it). A practice
 * test on a certification also takes a score. Changing the course keeps the type if the new kind
 * has it, as on the web; a score is dropped as soon as the item can't carry one.
 */
export function CourseSection({ x, set, courses, errors }: { x: Extras; set: (p: Partial<Extras>) => void; courses: Collections["courses"]; errors: ExtraErrors }) {
  const course = courses.find((c) => c.id === x.courseId)
  const scored = isScored(course?.kind, x.learningType)
  function pick(courseId: string) {
    const next = courses.find((c) => c.id === courseId)
    if (!courseId) return set({ courseId: "", learningType: "", score: "" })
    const learningType = typeAfterCourseChange(x.learningType, next?.kind)
    set({ courseId, learningType, score: isScored(next?.kind, learningType) ? x.score : "" })
  }
  return (
    <>
      <Text style={shared.label}>Course</Text>
      <View style={shared.chips}>
        <Chip label="None" active={!x.courseId} onPress={() => pick("")} />
        {courses.map((c) => (
          <Chip key={c.id} label={courseLabel(c)} active={c.id === x.courseId} onPress={() => pick(c.id)} />
        ))}
        {x.courseId && !course ? <Chip label="Unknown course" active onPress={() => undefined} /> : null}
      </View>
      {x.courseId ? (
        <>
          <Text style={shared.label}>Type</Text>
          <View style={shared.chips}>
            {typeOptions(course?.kind).map((o) => (
              <Chip key={o.value} label={o.label} active={x.learningType === o.value} onPress={() => set({ learningType: o.value, score: isScored(course?.kind, o.value) ? x.score : "" })} />
            ))}
          </View>
        </>
      ) : null}
      {scored ? (
        <>
          <Text style={shared.label}>Score %</Text>
          <TextInput value={x.score} onChangeText={(score) => set({ score })} placeholder="0 to 100" placeholderTextColor={color.faint} accessibilityLabel="Score" keyboardType="decimal-pad" maxLength={6} style={shared.input} />
          {errors.score ? <Text style={shared.error}>{errors.score}</Text> : null}
        </>
      ) : null}
    </>
  )
}
