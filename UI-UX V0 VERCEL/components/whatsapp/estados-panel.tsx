'use client'

import { useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  ImagePlus,
  Loader2,
  Send,
  CalendarClock,
  Trash2,
  X,
  Palette,
  Video,
  Clock,
  CheckCircle2,
  TriangleAlert,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { formatDate } from '@/lib/business'
import { compressImage } from '@/lib/image'
import { blobToDataUrl, waCreateEstado, waDeleteEstado, waListEstados, type EstadoProgramado } from '@/lib/wa'
import { cn } from '@/lib/utils'

const COLORS = ['#101014', '#7f1d1d', '#14532d', '#1e3a8a', '#3b0764', '#78350f']
const MAX_VIDEO_BYTES = 12 * 1024 * 1024

interface Media {
  dataUrl: string
  type: 'image' | 'video'
  name: string
  bytes: number
}

export function EstadosPanel({
  estados,
  connected,
  onChange,
}: {
  estados: EstadoProgramado[]
  connected: boolean
  onChange: () => void
}) {
  const [caption, setCaption] = useState('')
  const [media, setMedia] = useState<Media | null>(null)
  const [color, setColor] = useState(COLORS[0])
  const [scheduledAt, setScheduledAt] = useState('')
  const [busy, setBusy] = useState<'now' | 'later' | null>(null)
  const [removing, setRemoving] = useState<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function pickFile(file: File | undefined) {
    if (!file) return
    try {
      if (file.type.startsWith('video/')) {
        if (!file.type.includes('mp4')) {
          toast.error('El video debe estar en formato MP4.')
          return
        }
        if (file.size > MAX_VIDEO_BYTES) {
          toast.error(`El video pesa ${(file.size / 1024 / 1024).toFixed(1)} MB; el máximo es 12 MB (graba un clip más corto).`)
          return
        }
        setMedia({ dataUrl: await blobToDataUrl(file), type: 'video', name: file.name, bytes: file.size })
      } else {
        const dataUrl = await compressImage(file, { maxSize: 1600, quality: 0.85 })
        setMedia({ dataUrl, type: 'image', name: file.name, bytes: Math.round((dataUrl.length * 3) / 4) })
      }
      toast.success('Archivo listo para el estado.')
    } catch {
      toast.error('No se pudo leer el archivo.')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function quickSchedule(kind: 'hour' | 'tonight' | 'tomorrow') {
    const date = new Date()
    if (kind === 'hour') date.setHours(date.getHours() + 1, 0, 0, 0)
    if (kind === 'tonight') date.setHours(19, 0, 0, 0)
    if (kind === 'tomorrow') {
      date.setDate(date.getDate() + 1)
      date.setHours(9, 0, 0, 0)
    }
    const pad = (n: number) => String(n).padStart(2, '0')
    setScheduledAt(`${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`)
  }

  async function submit(mode: 'now' | 'later') {
    if (!caption.trim() && !media) {
      toast.error('Escribe un texto o adjunta una imagen/video.')
      return
    }
    if (mode === 'later' && !scheduledAt) {
      toast.error('Elige la hora de publicación.')
      return
    }
    if (mode === 'now' && !connected) {
      toast.error('WhatsApp no está conectado: no se puede publicar el estado.')
      return
    }

    setBusy(mode)
    try {
      await waCreateEstado({
        text: caption.trim(),
        caption: caption.trim(),
        mediaDataUrl: media?.dataUrl,
        mediaType: media?.type,
        backgroundColor: media ? undefined : color,
        scheduledAt: mode === 'later' ? new Date(scheduledAt).toISOString() : undefined,
      })
      toast.success(
        mode === 'now'
          ? 'Estado publicado en WhatsApp.'
          : `Estado programado para ${formatDate(new Date(scheduledAt).toISOString(), true)}.`,
      )
      setCaption('')
      setMedia(null)
      setScheduledAt('')
      onChange()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo publicar el estado.')
    } finally {
      setBusy(null)
    }
  }

  async function remove(estado: EstadoProgramado) {
    setRemoving(estado.id)
    try {
      await waDeleteEstado(estado.id)
      toast.success('Estado eliminado.')
      onChange()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo eliminar.')
    } finally {
      setRemoving(null)
    }
  }

  const pendientes = estados.filter((e) => e.status === 'pendiente').length

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-2xl border border-border bg-card/70 p-4 ring-1 ring-foreground/5 md:p-5">
        <header className="flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-lg bg-status-waiting/12 text-status-waiting">
            <ImagePlus className="size-4" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-sm font-semibold">Nuevo estado</h2>
            <p className="text-xs text-muted-foreground">Imagen o video con texto, o solo texto con color de fondo.</p>
          </div>
        </header>

        <div className="mt-4 flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="estado-caption" className="text-xs text-muted-foreground">
              Texto del estado
            </Label>
            <Textarea
              id="estado-caption"
              value={caption}
              onChange={(e) => setCaption(e.target.value.slice(0, 700))}
              rows={3}
              placeholder="Ej. ¡Llegaron controles de PS5 nuevos! 🎮"
              className="min-h-20 rounded-xl bg-background/40 text-base"
            />
            <p className="text-right text-[11px] text-muted-foreground">{caption.length}/700</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,video/mp4"
              onChange={(e) => pickFile(e.target.files?.[0])}
              className="hidden"
              id="estado-media"
            />
            <Button
              type="button"
              variant="secondary"
              className="h-10 rounded-xl"
              onClick={() => fileRef.current?.click()}
            >
              <ImagePlus className="size-4" aria-hidden="true" />
              {media ? 'Cambiar archivo' : 'Adjuntar imagen o video'}
            </Button>
            {media && (
              <>
                <span className="flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1.5 text-xs text-muted-foreground">
                  {media.type === 'video' ? <Video className="size-3.5" /> : <ImagePlus className="size-3.5" />}
                  {media.name} · {(media.bytes / 1024).toFixed(0)} KB
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 rounded-lg text-muted-foreground hover:text-destructive"
                  onClick={() => setMedia(null)}
                >
                  <X className="size-3.5" aria-hidden="true" />
                  Quitar
                </Button>
              </>
            )}
          </div>

          {media && (
            <div className="overflow-hidden rounded-xl border border-border bg-background/40 p-2">
              {media.type === 'video' ? (
                /* eslint-disable-next-line jsx-a11y/media-has-caption */
                <video src={media.dataUrl} controls className="max-h-64 w-full rounded-lg" />
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={media.dataUrl} alt="Vista previa del estado" className="max-h-64 w-full rounded-lg object-contain" />
              )}
            </div>
          )}

          {!media && (
            <div className="flex flex-col gap-1.5">
              <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Palette className="size-3.5" aria-hidden="true" />
                Color de fondo (solo para texto)
              </Label>
              <div className="flex items-center gap-2">
                {COLORS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setColor(value)}
                    aria-label={`Color ${value}`}
                    aria-pressed={color === value}
                    style={{ backgroundColor: value }}
                    className={cn(
                      'size-8 rounded-lg border transition-all',
                      color === value ? 'border-primary ring-2 ring-primary/50' : 'border-border hover:scale-105',
                    )}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="mt-1 flex flex-col gap-3 rounded-xl border border-border bg-background/40 p-3">
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex min-w-52 flex-1 flex-col gap-1.5">
                <Label htmlFor="estado-when" className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarClock className="size-3.5" aria-hidden="true" />
                  Programar publicación
                </Label>
                <Input
                  id="estado-when"
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="h-10 rounded-xl bg-background/60 text-base"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-xl"
                onClick={() => quickSchedule('hour')}
              >
                +1 hora
              </Button>
              <Button type="button" variant="outline" className="h-10 rounded-xl" onClick={() => quickSchedule('tonight')}>
                Hoy 7 pm
              </Button>
              <Button type="button" variant="outline" className="h-10 rounded-xl" onClick={() => quickSchedule('tomorrow')}>
                Mañana 9 am
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Puedes dejar programados varios estados al día (3 a 5 funcionan bien para no saturar a los clientes).
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              className="h-11 flex-1 rounded-xl text-sm font-semibold"
              disabled={busy !== null || !connected}
              onClick={() => submit('now')}
            >
              {busy === 'now' ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              {busy === 'now' ? 'Publicando…' : 'Publicar ahora'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="h-11 flex-1 rounded-xl text-sm font-semibold"
              disabled={busy !== null}
              onClick={() => submit('later')}
            >
              {busy === 'later' ? <Loader2 className="size-4 animate-spin" /> : <CalendarClock className="size-4" />}
              {busy === 'later' ? 'Programando…' : 'Programar estado'}
            </Button>
          </div>
          {!connected && (
            <p className="rounded-lg border border-status-review/30 bg-status-review/10 px-3 py-2 text-[11px] text-status-review">
              WhatsApp está desconectado: puedes programar estados, pero no publicarlos hasta vincular la sesión.
            </p>
          )}
        </div>
      </section>

      <aside className="flex flex-col gap-3 rounded-2xl border border-border bg-card/80 p-4 ring-1 ring-foreground/10">
        <header className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-primary" aria-hidden="true" />
            <h2 className="text-sm font-semibold">Estados</h2>
          </div>
          {pendientes > 0 && (
            <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[11px] tabular-nums text-muted-foreground">
              {pendientes} programados
            </span>
          )}
        </header>

        <div className="max-h-[62vh] overflow-y-auto">
          {estados.length === 0 ? (
            <p className="px-1 py-8 text-center text-xs text-muted-foreground">
              Todavía no has publicado ni programado estados.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {estados.map((estado) => (
                <li key={estado.id} className="rounded-xl border border-border bg-background/40 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide',
                        estado.status === 'publicado' && 'bg-status-done/12 text-status-done',
                        estado.status === 'pendiente' && 'bg-status-review/12 text-status-review',
                        estado.status === 'error' && 'bg-destructive/12 text-destructive',
                      )}
                    >
                      {estado.status === 'publicado' ? (
                        <CheckCircle2 className="size-3" aria-hidden="true" />
                      ) : estado.status === 'error' ? (
                        <TriangleAlert className="size-3" aria-hidden="true" />
                      ) : (
                        <Clock className="size-3" aria-hidden="true" />
                      )}
                      {estado.status}
                    </span>
                    <button
                      type="button"
                      onClick={() => remove(estado)}
                      disabled={removing === estado.id}
                      aria-label={`Eliminar estado ${estado.id}`}
                      className="grid size-7 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    >
                      {removing === estado.id ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                    </button>
                  </div>

                  <div className="mt-2 flex gap-2">
                    {estado.mediaUrl && estado.mediaType === 'image' && (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={estado.mediaUrl} alt="" className="size-14 shrink-0 rounded-lg object-cover" />
                    )}
                    {estado.mediaUrl && estado.mediaType === 'video' && (
                      <span className="grid size-14 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                        <Video className="size-5" aria-hidden="true" />
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="line-clamp-3 text-sm">{estado.caption || estado.text || '—'}</p>
                      <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                        {estado.status === 'publicado' && estado.sentAt
                          ? `Publicado ${formatDate(estado.sentAt, true)}`
                          : estado.scheduledAt
                            ? `Programado ${formatDate(estado.scheduledAt, true)}`
                            : `Creado ${formatDate(estado.createdAt, true)}`}
                      </p>
                      {estado.error && <p className="mt-1 text-[10px] text-destructive">{estado.error}</p>}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  )
}
