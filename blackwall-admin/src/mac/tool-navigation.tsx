import type { ReactNode } from "react"
import "./tool-navigation.css"

type Item<T extends string> = { value: T; label: string; icon: ReactNode }

/** A tool window's own navigation, measured against the window instead of the outer Mac display. */
export function MacToolNavigation<T extends string>({ label, value, items, onChange, children }: {
  label: string
  value: T
  items: readonly Item<T>[]
  onChange: (value: T) => void
  children: ReactNode
}) {
  return <div className="mac-tool-layout">
    <nav className="mac-tool-navigation" aria-label={`${label} views`} onKeyDown={event => {
      if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return
      const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("button")]
      const index = buttons.indexOf(event.target as HTMLButtonElement)
      if (index < 0) return
      event.preventDefault()
      const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 :
        (index + (event.key === "ArrowUp" || event.key === "ArrowLeft" ? -1 : 1) + items.length) % items.length
      onChange(items[next].value)
      buttons[next]?.focus()
    }}>
      <span className="mac-tool-navigation-label">{label}</span>
      {items.map(item => <button key={item.value} type="button" aria-current={value === item.value ? "page" : undefined} onClick={() => onChange(item.value)}>
        <span aria-hidden="true">{item.icon}</span>{item.label}
      </button>)}
    </nav>
    <div className="mac-tool-view">{children}</div>
  </div>
}
