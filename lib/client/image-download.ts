export function imageExtensionFromUrl(url: string) {
  const extension = url.split("?")[0].match(/\.(png|jpe?g|webp|avif)$/i)?.[0]
  return extension || ".png"
}

export async function downloadImageAsset(url: string, fileName: string) {
  if (!url) return

  if (isDirectBrowserUrl(url)) {
    triggerAnchorDownload(url, fileName)
    return
  }

  triggerAnchorDownload(downloadImageEndpoint(url, fileName), fileName)
}

export async function downloadCompareImage(originalUrl: string, generatedUrl: string, fileName: string) {
  const [original, generated] = await Promise.all([loadImageElement(canvasSafeImageUrl(originalUrl)), loadImageElement(canvasSafeImageUrl(generatedUrl))])
  const sourceWidth = Math.max(original.naturalWidth || original.width, generated.naturalWidth || generated.width, 1)
  const width = Math.min(1600, sourceWidth)
  const originalAspect = imageAspectRatio(original)
  const generatedAspect = imageAspectRatio(generated)
  const cellHeight = Math.max(Math.round(width / originalAspect), Math.round(width / generatedAspect))
  const separator = Math.max(2, Math.round(width * 0.002))
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = cellHeight * 2 + separator
  const context = canvas.getContext("2d")
  if (!context) throw new Error("Unable to create comparison image.")
  context.fillStyle = "#050607"
  context.fillRect(0, 0, canvas.width, canvas.height)
  drawContainedImage(context, original, 0, 0, width, cellHeight)
  context.fillStyle = "#262832"
  context.fillRect(0, cellHeight, width, separator)
  drawContainedImage(context, generated, 0, cellHeight + separator, width, cellHeight)
  const blob = await canvasToBlob(canvas)
  const objectUrl = URL.createObjectURL(blob)
  try {
    triggerAnchorDownload(objectUrl, fileName)
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 2000)
  }
}

export function downloadImageEndpoint(url: string, fileName: string) {
  const params = new URLSearchParams({ url: serverReadableImageUrl(url), filename: fileName })
  return `/api/download-image?${params.toString()}`
}

export function canvasSafeImageUrl(url: string) {
  if (!url || isDirectBrowserUrl(url) || isSameOriginUrl(url)) return url
  return `/api/proxy-image?url=${encodeURIComponent(url)}`
}

function triggerAnchorDownload(url: string, fileName: string) {
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = fileName
  anchor.rel = "noopener"
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}

function isDirectBrowserUrl(url: string) {
  return url.startsWith("blob:") || url.startsWith("data:")
}

function isSameOriginUrl(url: string) {
  if (url.startsWith("/")) return true
  try {
    return new URL(url, window.location.href).origin === window.location.origin
  } catch {
    return false
  }
}

function serverReadableImageUrl(url: string) {
  if (url.startsWith("/")) return url
  try {
    const parsed = new URL(url, window.location.href)
    if (parsed.origin === window.location.origin) return `${parsed.pathname}${parsed.search}`
  } catch {
    // Keep the original value and let the server validate it.
  }
  return url
}

function loadImageElement(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error("Image failed to load for saving."))
    image.src = url
  })
}

function imageAspectRatio(image: HTMLImageElement) {
  const width = image.naturalWidth || image.width || 1
  const height = image.naturalHeight || image.height || 1
  return Math.max(0.1, width / height)
}

function drawContainedImage(context: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, width: number, height: number) {
  const imageWidth = image.naturalWidth || image.width || 1
  const imageHeight = image.naturalHeight || image.height || 1
  const scale = Math.min(width / imageWidth, height / imageHeight)
  const drawWidth = Math.round(imageWidth * scale)
  const drawHeight = Math.round(imageHeight * scale)
  const drawX = x + Math.round((width - drawWidth) / 2)
  const drawY = y + Math.round((height - drawHeight) / 2)
  context.drawImage(image, drawX, drawY, drawWidth, drawHeight)
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error("Comparison image save failed."))
    }, "image/png")
  })
}
