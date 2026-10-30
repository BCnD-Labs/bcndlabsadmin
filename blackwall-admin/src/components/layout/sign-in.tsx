import { Loader2, LockKeyhole } from "lucide-react"
import { useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useSession } from "@/services/connector"

/** Shown when the panel is served by the home server and you're not signed in. */
export function SignIn() {
  const login = useSession((s) => s.login)
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await login(password)
    } catch (err) {
      setError((err as Error).message)
      setPassword("")
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <form onSubmit={submit} className="brutal w-full max-w-sm rounded-xl bg-card p-6" aria-labelledby="signin-title">
        <p className="wordmark mb-1 text-4xl text-teal">Blackwall</p>
        <h1 id="signin-title" className="eyebrow mb-5 flex items-center gap-1.5">
          <LockKeyhole className="size-3.5" aria-hidden /> Sign in
        </h1>
        <label htmlFor="password" className="mb-1.5 block text-xs text-muted-foreground">
          Password
        </label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={!!error}
        />
        {error && (
          <p role="alert" className="mt-2 text-sm text-red-text">
            {error}
          </p>
        )}
        <Button type="submit" className="mt-4 w-full" disabled={!password || busy}>
          {busy && <Loader2 className="animate-spin" />} Sign in
        </Button>
      </form>
    </main>
  )
}
