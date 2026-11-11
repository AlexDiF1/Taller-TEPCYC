'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, ShieldCheck } from 'lucide-react'

type TokenResponse = { access_token?: string; error?: string; error_description?: string }

type GoogleAccounts = {
  accounts: {
    oauth2: {
      initTokenClient: (config: {
        client_id: string
        scope: string
        callback: (response: TokenResponse) => void
        error_callback?: (error: { type?: string; message?: string }) => void
      }) => { requestAccessToken: (options?: { prompt?: string }) => void }
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
  if (window.google?.accounts?.oauth2) return Promise.resolve(true)
  return new Promise<boolean>((resolve) => {
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null
    if (existing) {
      existing.addEventListener('load', () => resolve(Boolean(window.google?.accounts?.oauth2)))
      existing.addEventListener('error', () => resolve(false))
      return
    }
    const script = document.createElement('script')
    script.id = SCRIPT_ID
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () => resolve(Boolean(window.google?.accounts?.oauth2))
    script.onerror = () => resolve(false)
    document.head.appendChild(script)
  })
}

/** Logo oficial de Google (decorativo). */
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className="size-5 shrink-0">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59A14.5 14.5 0 0 1 9.77 24c0-1.6.28-3.14.76-4.59l-7.97-6.19A23.94 23.94 0 0 0 0 24c0 3.88.93 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.46-9.9l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  )
}

export function LoginCard() {
  const router = useRouter()
  const params = useSearchParams()
  const nextPath = params.get('next') || '/'
  const tokenClient = useRef<{ requestAccessToken: (options?: { prompt?: string }) => void } | null>(null)
  const [clientId, setClientId] = useState<string | null>(null)
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const enter = useCallback(
    async (accessToken: string) => {
      setBusy(true)
      setError(null)
      try {
        const response = await fetch('/api/auth/google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accessToken }),
        })
        const data = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(data?.error ?? 'No se pudo entrar.')
        router.replace(nextPath.startsWith('/') ? nextPath : '/')
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo entrar.')
        setBusy(false)
      }
    },
    [nextPath, router],
  )

  // 1) Configuración del servidor.
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

  // 2) Cliente OAuth de Google: abre la ventana de selección de cuenta.
  //    Se usa el flujo de token (no el botón oficial) para poder pintar un botón
  //    propio: el iframe de Google dejaba un recuadro blanco alrededor.
  useEffect(() => {
    if (!clientId) return
    let alive = true
    loadGoogleScript().then((loaded) => {
      if (!alive) return
      const oauth2 = window.google?.accounts?.oauth2
      if (!loaded || !oauth2) {
        setError('No se pudo cargar el acceso de Google. Revisa la conexión y recarga.')
        return
      }
      tokenClient.current = oauth2.initTokenClient({
        client_id: clientId,
        scope: 'openid email profile',
        callback: (response) => {
          if (response?.access_token) {
            void enter(response.access_token)
            return
          }
          setBusy(false)
          if (response?.error === 'access_denied') {
            setError('Cancelaste el acceso con Google.')
            return
          }
          setError(response?.error_description || 'Google no devolvió el acceso. Inténtalo otra vez.')
        },
        error_callback: (err) => {
          setBusy(false)
          if (err?.type === 'popup_closed') return
          setError('La ventana de Google no está disponible. Revisa que no esté bloqueada y reintenta.')
        },
      })
      setReady(true)
    })
    return () => {
      alive = false
    }
  }, [clientId, enter])

  function signIn() {
    if (!tokenClient.current || busy) return
    setError(null)
    setBusy(true)
    tokenClient.current.requestAccessToken({ prompt: 'select_account' })
  }

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

        <div className="mt-6 flex flex-col items-stretch gap-3">
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

          {enabled !== false && (
            <button
              type="button"
              onClick={signIn}
              disabled={!ready || busy}
              className="flex h-12 w-full items-center justify-center gap-3 rounded-xl bg-white px-4 text-sm font-semibold text-[#1f1f1f] transition-colors hover:bg-white/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : <GoogleMark />}
              {busy ? 'Validando tu cuenta…' : 'Continuar con Google'}
            </button>
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
