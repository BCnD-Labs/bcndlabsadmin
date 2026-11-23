import { create } from "zustand"
import type { PlanOptions, PublishChoice, PublishPlan } from "@shared/publish-plan"

/**
 * Review before anything is committed to a repository: the files that would change and a diff of each. The screen itself is
 * `PublishReviewHost` (features/cms/publish-review.tsx); anything that commits asks through `reviewPublish`.
 */
export interface ReviewRequest {
  title: string
  plan: (options?: PlanOptions) => Promise<PublishPlan>
  /** A picture to show in the review (an image about to be uploaded). */
  preview?: { src: string; alt: string }
  run: (choice: PublishChoice) => Promise<unknown>
  resolve: (value: unknown) => void
  reject: (e: Error) => void
}

export const useReview = create<{ req?: ReviewRequest; plan?: PublishPlan; error?: string; busy: boolean }>()(() => ({ busy: false }))

/** Works out the changes, asks the owner, then runs the publish with their choice. Resolves with the publish result, or undefined if they cancelled. */
export function reviewPublish<T>(input: { title: string; preview?: ReviewRequest["preview"]; plan: (options?: PlanOptions) => Promise<PublishPlan>; run: (choice: PublishChoice) => Promise<T> }): Promise<T | undefined> {
  return new Promise<T | undefined>((resolve, reject) => {
    useReview.setState({ req: { ...input, resolve: resolve as (v: unknown) => void, reject }, plan: undefined, error: undefined, busy: false })
    input.plan().then((plan) => useReview.setState({ plan }), (e: Error) => { useReview.setState({ req: undefined }); reject(e) })
  })
}

export const closeReview = (value?: unknown) => { useReview.getState().req?.resolve(value); useReview.setState({ req: undefined, plan: undefined, error: undefined, busy: false }) }
