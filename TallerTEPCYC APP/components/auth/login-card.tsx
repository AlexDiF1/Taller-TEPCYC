'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, ShieldCheck } from 'lucide-react'

type GoogleAccounts = {
  accounts: {
    id: {
      initialize: (config: { client_id: string; callback: (response: { credential?: string }) => void }) => void
      renderButton: (element: HTMLElement, options: Record<string, string>) => void
    }
  }
}

declare global {
  interface Window {
    google?: GoogleAccounts
  }
}

const SCRIPT_ID = 'google-identity-services'

function loadGoogleScript() {
  if (typeof window === 'undefined') return Promise.resolve(false)
  if (window.google?.accounts?.id) return Promise.resolve(true)
  return new Promise<boolean>((resolve) => {
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null
    if (existing) {
      existing.addEventListener('load', () => resolve(Boolean(window.google?.accounts?.id)))
      existing.addEventListener('error', () => resolve(false))
      return
    }
    const script = document.createElement('script')
    script.id = SCRIPT_ID
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () => resolve(Boolean(window.google?.accounts?.id))
    script.onerror = () => resolve(false)
    document.head.appendChild(script)
  })
}

export function LoginCard() {
  const router = useRouter()
  const params = useSearchParams()
  const nextPath = params.get('next') || '/'
  const buttonRef = useRef<HTMLDivElement>(null)
  const [clientId, setClientId] = useState<string | null>(null)
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // 1) Configuración del servidor y script de Google.
  useEffect(() => {
    let alive = true
    fetch('/api/auth/config')
      .then((response) => response.json())
      .then((data: { enabled: boolean; clientId: string | null }) => {
        if (!alive) return
        setEnabled(data.enabled)
        setClientId(data.clientId)
      })
      .catch(() => alive && setEnabled(false))
    return () => {
      alive = false
    }
  }, [])

  // 2) Botón oficial de Google cuando hay client ID.
  useEffect(() => {
    if (!clientId) return
    let alive = true
    loadGoogleScript().then((ready) => {
      if (!alive) return
      if (!ready || !window.google || !buttonRef.current) {
        setError('No se pudo cargar el botón de Google. Revisa la conexión y recarga.')
        return
      }
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response) => {
          if (!response.credential) {
            setError('Google no devolvió la credencial. Inténtalo otra vez.')
            return
          }
          setBusy(true)
          setError(null)
          try {
            const result = await fetch('/api/auth/google', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ credential: response.credential }),
            })
            const data = await result.json().catch(() => ({}))
            if (!result.ok) throw new Error(data?.error ?? 'No se pudo entrar.')
            router.replace(nextPath.startsWith('/') ? nextPath : '/')
            router.refresh()
          } catch (err) {
            setError(err instanceof Error ? err.message : 'No se pudo entrar.')
            setBusy(false)
          }
        },
      })
      buttonRef.current.innerHTML = ''
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: 'filled_black',
        size: 'large',
        text: 'continue_with',
        shape: 'pill',
        logo_alignment: 'left',
        width: '320',
      })
    })
    return () => {
      alive = false
    }
  }, [clientId, nextPath, router])

  return (
    <div className="flex min-h-dvh items-center justify-center bg-grid px-4 py-10">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-card/80 p-7 shadow-2xl shadow-black/40 ring-1 ring-foreground/10 backdrop-blur-xl">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          <ShieldCheck className="size-3.5" aria-hidden="true" />
          Acceso al taller
        </div>
        <h1 className="mt-3 text-2xl font-bold tracking-tight">TODOENPCYCONSOLAS</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Entra con tu cuenta de Google autorizada para ver las órdenes, ventas y comprobantes del taller.
        </p>

        <div className="mt-6 flex flex-col items-center gap-3">
          {enabled === null && (
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Preparando acceso…
            </span>
          )}

          {enabled === false && (
            <p className="rounded-xl border border-status-review/40 bg-status-review/10 px-3 py-2 text-xs text-status-review">
              El acceso con Google todavía no está configurado en el servidor (falta el client ID). Avisa al
              administrador.
            </p>
          )}

          <div ref={buttonRef} className="flex min-h-11 items-center justify-center" />

          {busy && (
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Validando tu cuenta…
            </span>
          )}

          {error && (
            <p role="alert" className="text-center text-xs text-destructive">
              {error}
            </p>
          )}
        </div>

        <p className="mt-6 text-center text-[11px] leading-relaxed text-muted-foreground">
          Solo los correos autorizados pueden entrar. La sesión dura 7 días en este dispositivo.
        </p>
      </div>
    </div>
  )
}
