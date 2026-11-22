'use client'

import { useEffect, useState } from 'react'
import { LogOut } from 'lucide-react'

/** Solo aparece si hay sesión de Google activa en el servidor. */
export function LogoutButton({ compact = false }: { compact?: boolean }) {
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    fetch('/api/auth/me')
      .then((response) => response.json())
      .then((data: { email: string | null; enabled: boolean }) => {
        if (alive && data?.enabled && data?.email) setEmail(data.email)
      })
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [])

  if (!email) return null

  async function salir() {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined)
    window.location.href = '/login'
  }

  if (compact) {
    return (
      <button
        type="button"
        onClick={salir}
        aria-label={`Cerrar sesión (${email})`}
        title={`Cerrar sesión (${email})`}
        className="grid size-10 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <LogOut className="size-5" aria-hidden="true" />
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={salir}
      className="mt-3 flex w-full items-center gap-2 rounded-lg border border-border bg-surface px-2.5 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
    >
      <LogOut className="size-3.5 shrink-0" aria-hidden="true" />
      <span className="truncate">Cerrar sesión ({email.split('@')[0]})</span>
    </button>
  )
}
