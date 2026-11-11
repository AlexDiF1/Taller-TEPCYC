/**
 * Compresión de imágenes en el navegador antes de subirlas:
 * reescala al lado mayor indicado y exporta JPEG para que pesen poco.
 */
export type CompressOptions = {
  maxSize?: number
  quality?: number
}

export function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('No se pudo leer la imagen'))
    image.src = src
  })
}

export async function compressImage(file: File, { maxSize = 1280, quality = 0.72 }: CompressOptions = {}) {
  const dataUrl = await readAsDataUrl(file)

  // createImageBitmap aplica la orientación EXIF: sin esto, las fotos
  // verticales del celular salían giradas en el ingreso y el comprobante.
  let source: HTMLImageElement | ImageBitmap
  let width0: number
  let height0: number
  try {
    source = await createImageBitmap(file, { imageOrientation: 'from-image' })
    width0 = source.width
    height0 = source.height
  } catch {
    source = await loadImage(dataUrl)
    width0 = source.width
    height0 = source.height
  }

  const scale = Math.min(1, maxSize / Math.max(width0, height0))
  const width = Math.max(1, Math.round(width0 * scale))
  const height = Math.max(1, Math.round(height0 * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) return dataUrl

  context.drawImage(source, 0, 0, width, height)
  if (typeof ImageBitmap !== 'undefined' && source instanceof ImageBitmap) source.close()
  return canvas.toDataURL('image/jpeg', quality)
}
