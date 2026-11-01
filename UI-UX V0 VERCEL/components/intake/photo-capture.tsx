'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, ImagePlus, RefreshCcw, SwitchCamera, Trash2, X, Aperture, Expand } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import type { IntakePhoto } from '@/lib/types'
import { cn } from '@/lib/utils'

const MAX_PHOTOS = 12

function newPhoto(url: string): IntakePhoto {
  return { id: crypto.randomUUID(), url, takenAt: new Date().toISOString() }
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

interface PhotoCaptureProps {
  photos: IntakePhoto[]
  onChange: (photos: IntakePhoto[]) => void
}

export function PhotoCapture({ photos, onChange }: PhotoCaptureProps) {
  const [cameraOpen, setCameraOpen] = useState(false)
  const [preview, setPreview] = useState<IntakePhoto | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const remaining = MAX_PHOTOS - photos.length

  async function handleFiles(files: FileList | null) {
    if (!files) return
    const selected = Array.from(files).filter((f) => f.type.startsWith('image/')).slice(0, remaining)
    const urls = await Promise.all(selected.map(readFileAsDataUrl))
    onChange([...photos, ...urls.map(newPhoto)])
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setCameraOpen(true)}
          disabled={remaining <= 0}
          className="group flex flex-col items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/8 px-4 py-6 text-center transition-colors hover:border-primary/60 hover:bg-primary/12 disabled:opacity-50"
        >
          <span className="grid size-11 place-items-center rounded-full bg-primary text-primary-foreground transition-transform group-hover:scale-105">
            <Camera className="size-5" aria-hidden="true" />
          </span>
          <span className="text-sm font-semibold">Tomar foto</span>
          <span className="text-xs text-muted-foreground">Usar cámara del equipo</span>
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={remaining <= 0}
          className="group flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-input bg-secondary/40 px-4 py-6 text-center transition-colors hover:border-foreground/30 hover:bg-secondary disabled:opacity-50"
        >
          <span className="grid size-11 place-items-center rounded-full bg-secondary text-foreground ring-1 ring-border transition-transform group-hover:scale-105">
            <ImagePlus className="size-5" aria-hidden="true" />
          </span>
          <span className="text-sm font-semibold">Subir fotos</span>
          <span className="text-xs text-muted-foreground">JPG, PNG o HEIC</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="sr-only"
          aria-label="Subir fotos del equipo"
          onChange={(e) => {
            handleFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Galería previa</span>
        <span className="font-mono">
          {photos.length}/{MAX_PHOTOS}
        </span>
      </div>

      {photos.length === 0 ? (
        <div className="grid grid-cols-4 gap-2" aria-hidden="true">
          {['Frontal', 'Trasera', 'Puertos', 'Detalle'].map((label) => (
            <div
              key={label}
              className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border text-[10px] uppercase tracking-wider text-muted-foreground/70"
            >
              <Aperture className="size-4" />
              {label}
            </div>
          ))}
        </div>
      ) : (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((photo, index) => (
            <li key={photo.id} className="group relative aspect-square overflow-hidden rounded-lg ring-1 ring-border">
              <img
                src={photo.url || '/placeholder.svg'}
                alt={`Foto ${index + 1} del estado físico del equipo`}
                className="size-full object-cover"
              />
              <span className="absolute left-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[10px] text-white">
                {String(index + 1).padStart(2, '0')}
              </span>
              <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1 bg-gradient-to-t from-black/80 to-transparent p-1.5 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
                <button
                  type="button"
                  onClick={() => setPreview(photo)}
                  className="grid size-7 place-items-center rounded-md bg-white/15 text-white backdrop-blur hover:bg-white/25"
                  aria-label={`Ampliar foto ${index + 1}`}
                >
                  <Expand className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onChange(photos.filter((p) => p.id !== photo.id))}
                  className="grid size-7 place-items-center rounded-md bg-destructive/80 text-white hover:bg-destructive"
                  aria-label={`Eliminar foto ${index + 1}`}
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <CameraDialog
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        remaining={remaining}
        onCapture={(url) => onChange([...photos, newPhoto(url)])}
        capturedCount={photos.length}
      />

      <Dialog open={!!preview} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="max-w-[calc(100%-2rem)] p-2 sm:max-w-3xl">
          <DialogTitle className="sr-only">Vista ampliada</DialogTitle>
          {preview && (
            <img
              src={preview.url || '/placeholder.svg'}
              alt="Vista ampliada del estado físico del equipo"
              className="max-h-[80dvh] w-full rounded-lg object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface CameraDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCapture: (dataUrl: string) => void
  remaining: number
  capturedCount: number
}

function CameraDialog({ open, onOpenChange, onCapture, remaining, capturedCount }: CameraDialogProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment')
  const [error, setError] = useState<string | null>(null)
  const [flash, setFlash] = useState(false)
  const [ready, setReady] = useState(false)

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setReady(false)
  }, [])

  const startStream = useCallback(async () => {
    stopStream()
    setError(null)
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Este navegador no permite acceder a la cámara. Usa "Subir fotos".')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => {})
      }
      setReady(true)
    } catch {
      setError('No pudimos acceder a la cámara. Revisa los permisos del navegador o usa "Subir fotos".')
    }
  }, [facingMode, stopStream])

  useEffect(() => {
    if (open) startStream()
    else stopStream()
    return stopStream
  }, [open, startStream, stopStream])

  function capture() {
    const video = videoRef.current
    if (!video || !ready || remaining <= 0) return
    const canvas = document.createElement('canvas')
    const maxWidth = 1600
    const scale = Math.min(1, maxWidth / video.videoWidth)
    canvas.width = video.videoWidth * scale
    canvas.height = video.videoHeight * scale
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height)
    onCapture(canvas.toDataURL('image/jpeg', 0.85))
    setFlash(true)
    setTimeout(() => setFlash(false), 150)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-w-[calc(100%-1rem)] gap-0 overflow-hidden bg-black p-0 sm:max-w-2xl"
      >
        <DialogTitle className="sr-only">Cámara de ingreso</DialogTitle>
        <DialogDescription className="sr-only">
          Toma fotos del estado físico en que llega el equipo.
        </DialogDescription>
        <div className="relative aspect-[3/4] w-full bg-black sm:aspect-video">
          <video
            ref={videoRef}
            playsInline
            muted
            className={cn('size-full object-cover', facingMode === 'user' && '-scale-x-100')}
          />
          {flash && <div className="absolute inset-0 bg-white/80" aria-hidden="true" />}

          <div className="pointer-events-none absolute inset-6 rounded-2xl border border-white/20" aria-hidden="true">
            {['left-0 top-0 border-l-2 border-t-2', 'right-0 top-0 border-r-2 border-t-2', 'bottom-0 left-0 border-b-2 border-l-2', 'bottom-0 right-0 border-b-2 border-r-2'].map(
              (pos) => (
                <span key={pos} className={cn('absolute size-6 rounded-sm border-primary', pos)} />
              ),
            )}
          </div>

          <div className="absolute inset-x-0 top-0 flex items-center justify-between p-3">
            <span className="flex items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 font-mono text-[11px] text-white backdrop-blur">
              <span className={cn('size-2 rounded-full', ready ? 'animate-pulse bg-red-500' : 'bg-white/40')} />
              {capturedCount} foto{capturedCount === 1 ? '' : 's'}
            </span>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="grid size-9 place-items-center rounded-full bg-black/60 text-white backdrop-blur hover:bg-black/80"
              aria-label="Cerrar cámara"
            >
              <X className="size-4.5" />
            </button>
          </div>

          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8 text-center text-sm text-white">
              <Camera className="size-8 text-white/50" aria-hidden="true" />
              <p className="max-w-xs text-pretty">{error}</p>
              <Button variant="secondary" onClick={startStream}>
                <RefreshCcw data-icon="inline-start" />
                Reintentar
              </Button>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between bg-black px-6 py-5">
          <Button
            variant="ghost"
            className="h-auto flex-col gap-1 px-2 py-1 text-xs text-white/80 hover:bg-white/10 hover:text-white"
            onClick={() => onOpenChange(false)}
          >
            Listo
          </Button>
          <button
            type="button"
            onClick={capture}
            disabled={!ready || remaining <= 0}
            className="grid size-18 place-items-center rounded-full border-4 border-white/90 transition-transform active:scale-95 disabled:opacity-40"
            aria-label="Capturar foto"
          >
            <span className="size-14 rounded-full bg-primary" />
          </button>
          <button
            type="button"
            onClick={() => setFacingMode((m) => (m === 'environment' ? 'user' : 'environment'))}
            className="grid size-11 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
            aria-label="Cambiar cámara"
          >
            <SwitchCamera className="size-5" />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
