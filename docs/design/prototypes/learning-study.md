# Learning redesign study — review only

This study is separate from the native Learning visual redesign. The native real-data work is proposed in Android build 12 (PR #33). `learning-preview.html` is a self-contained layout study and uses labeled sample data. Its completion, editing, notes, page updates, and resources only change in-memory examples; reloading resets them. No network/API calls or external assets are required.

## Current capability inventory

The Android build 12 native Learning screen now uses real workspace records for all five kinds. It can create and edit Learning entries, linked tasks, and linked notes. Its current layout is a functional bridge while this study is reviewed.

The existing web/shared model is the baseline for the redesign:

- Five kinds: Course, Certification, Self-paced, Skill, Reading. Missing kind means Course for older records.
- Shared metadata: title/code/person/term, dates, schedule/location, URL, description, tags, color, linked documents.
- Learning work is existing Task records, with courseId and learningType; due/scheduled dates, completion, score, notes/context, reflection, and record/document links remain available through the Planner editor.
- Course: assignments, exams, milestones, events, schedule/instructor/site, task completion.
- Certification: objective domains, study tasks, practice tests and their actual scores, exam date; progress measures completed domains.
- Self-paced: sections and exercises, platform/link, completed sections.
- Skill: goal, milestones, practice, resources; no invented mastery score.
- Reading: author/link, pages read/total pages, chapter/goals and linked notes.
- Existing web views offer type and status filters, cross-learning Upcoming, dated exam rows, course details, notes and resources.
- Study-session logging and study-hour statistics were explicitly deferred in the design documentation; do not introduce them as part of this redesign.

## Proposed direction A

Collection level: a compact Library / Upcoming switch, search, horizontal kind chips, and one contextual display button. Dense learning rows show title, kind, meaningful progress, and a next action. Cross-course Upcoming groups actual work into Overdue / This week / Later; certification exam dates are distinct rows. Avoid a dashboard of giant summary cards.

Detail level: a small identity row and one wrapping fact strip above Overview / Work / Notes. Work starts selected for Course, Certification, Self-paced and Skill. Reading starts in Overview, where actual page progress can be updated quickly. Overview contains context, schedule/dates and real resources. Work uses Open / Done / All controls and compact task rows. Notes are actually linked records, not empty hardcoded category cards.

The header's + opens a small kind-aware menu: Assignment/Exam/etc for a Course, Exam domain/Practice test/etc for a Certification, Chapter/Reading goal for Reading, plus Note and Resource. Editors default to a title, a few pills and a small text area; + More exposes additional fields. Reuse the existing Planner task/editor behavior rather than building a second task system.

Completion stays a direct checkbox action. Reflection is available from the item menu and the editor's Reflection tab, never forced by marking something done. There is no new study-time widget.

## Alternative B

A notebook canvas keeps a small identity/progress strip above collapsible Overview, Work, Notes and Resources sections. This is closer to a handheld desk/notebook, makes nearby context visible, and reduces tab switching, but can demand more scrolling. A compact Display dialog switches between the alternatives in the study.

## Kind-specific integrity

- A practice score is not certification readiness or proof of passing. A past exam date is not a pass result.
- Domain completion, course task completion, pages, and section completion are different measures. Do not force all of them into a uniform percentage or call milestones mastery.
- A Skill with no measurable items should show its goal and no fabricated progress.
- course.links and course.url are resources. Notes linked via note.courseId are notes. Count and label them separately.
- All existing records must load unchanged, including academic learningType event items and older Courses without kind. Any event semantics need explicit design review rather than silent conversion.
- Search/filter/display choices belong to the device. Real edits use the shared workspace API and existing revision/outbox behavior.

## Additional capabilities that require no AI or parsing

1. **Manual review date and queue.** Let a task or topic carry an explicit review date; Upcoming can show due reviews beside deadlines. The user decides when to review; no spaced-repetition algorithm or invented readiness score.
2. **Practice attempt history.** A certification practice test can have multiple dated scores rather than overwriting one score. Show the actual attempts as a small list and trend only when there are enough results. This needs optional shared fields and an older-workspace validation test.
3. **Actual certification outcome.** Store an explicit passed/failed/not taken result and issue or expiry date, entered by the user. Keep it separate from practice scores and scheduled exam date. This also needs optional fields.
4. **Next action.** Pin one real task within each learning item as its next step. Library rows can expose that task directly; if no task is selected, show the soonest open task by date. No algorithmic study plan is required.
5. **Reading position.** In addition to pages read, save a chapter or section label and perhaps one bookmark. This is manual progress, useful even when total pages are unknown.
6. **Resource shelf.** Group existing course URL and document links into a compact Resources section. A lightweight label and link editor would make the existing data useful without scraping or parsing source content.

The first and fourth ideas fit the existing task model well and should be explored before adding new record fields. Attempt history and certification outcome are valuable but need deliberate data-model work. Study-session logs and hours remain deferred.

## Primary-source research

1. [Obsidian Bases views](https://obsidian.md/help/bases/views): multiple views can display/filter/sort the same underlying records; phone Display menus retain advanced controls, including grouping and visible properties. Applied here as compact Library/Upcoming and contextual Display controls, not feature removal or a new note database.
2. [RemNote Flashcard Home](https://help.remnote.com/en/articles/7925835-the-flashcard-home): documents, progress and exam dates coexist, with exam deadlines prioritized and further options in menus. Applied here only as prominent actual exam/date/domain context; no spaced-repetition engine, flashcards, forecasts or study streaks are proposed.
3. [Readwise Reader filtering](https://docs.readwise.io/reader/guides/filtering/syntax-guide): filtering by type, tags, progress and notes can expose distinct slices of one library. Applied here as kind filters shared across Library and Upcoming; the first preview deliberately avoids a complex query-language builder.

## Preview states to review

1. Library vs cross-course Upcoming with the same kind chips, dense rows and meaningful progress.
2. Certification Work with domains, practice scores, optional reflection, and the compact item editor.
3. Reading Overview with page updates, resources and linked notes, then compare the tabbed workspace to notebook canvas.

## Decisions for Blake before implementation

- A tabbed detail workspace, B notebook canvas, or a preference combining both?
- Should Reading open in Overview while other kinds open Work, or should all kinds remember the last-used tab per device?
- Which facts should always remain in the compact summary strip for each kind?
- Are richer course-specific source categories useful later? Current hardcoded Lecture notes / Assignment notes / Study log are placeholders and should not become empty permanent panels.
- Is an actual certification outcome needed later? The current model does not store passed/failed/certified, so the preview does not pretend to know it.

## Validation boundary

The HTML is a design study, not a native implementation or data migration. The demo deliberately uses short example date labels and illustrative grouping instead of production scheduling rules; real implementation must reuse shared date/task/progress rules, not copy the demo's data handling. Modal resource URLs are disabled to make the sample-only boundary clear.
