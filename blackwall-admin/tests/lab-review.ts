/** Helpers for tests that drive the practice run the way the review screen does: ask for a plan, then confirm exactly that plan. */

/** Sends a request twice: first as a plan, then as the write that confirms the plan's token with a commit message. */
export async function confirmed(send: (body: object) => Promise<Response>, extra: object = {}): Promise<Response> {
  const planned = await send({ plan: true })
  if (!planned.ok) return planned
  const { plan } = (await planned.json()) as { plan: { token: string; head: string; stamp?: string } }
  return send({ token: plan.token, expectedHead: plan.head, stamp: plan.stamp, message: "Test change", ...extra })
}

/** The connection query a site request carries. There is no fallback to "the first connection", so every request names it. */
export const withConnection = (lab: { connection: string }, path: string) => `${path}${path.includes("?") ? "&" : "?"}connection=${lab.connection}`
