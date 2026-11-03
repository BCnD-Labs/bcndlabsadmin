import { Loader2 } from "lucide-react"
import { useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Field } from "@/components/common/field"
import { Panel } from "@/components/common/panel"
import { useSession } from "@/services/connector"

/** Shown when the panel is served by the home server and you're not signed in. */
export function SignIn() {
  const login = useSession((s) => s.login)
  const [password, setPassword] = useState("")
  const [remember, setRemember] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await login(password, remember)
    } catch (err) {
      setError((err as Error).message)
      setPassword("")
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <Panel tool="blackwall" command="login" className="w-full max-w-sm" label="Sign in">
        <form onSubmit={submit} className="flex flex-col gap-4 px-5 py-5">
          <div className="flex items-center gap-3">
            <span aria-hidden className="flex size-[34px] items-center justify-center rounded-[8px] border-r-[3px] border-b-[3px] border-red-ledge bg-red font-pixel text-xs text-white">
              BW
            </span>
            <div>
              <h1 className="font-heading text-xl leading-tight font-bold">Sign in</h1>
              <p className="text-[11px] text-muted-foreground">Blackwall on your home server</p>
            </div>
          </div>
          <Field label="Password" htmlFor="password" error={error}>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <label className="-my-1 flex min-h-8 cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <Checkbox checked={remember} onCheckedChange={(v) => setRemember(v === true)} />
            Remember me for 30 days
          </label>
          <Button type="submit" size="lg" className="w-full" disabled={!password || busy}>
            {busy && <Loader2 className="animate-spin" />} Sign in
          </Button>
        </form>
      </Panel>
    </main>
  )
}
