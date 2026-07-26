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

export function downloadImageEndpoint(url: string, fileName: string) {
  const params = new URLSearchParams({ url: serverReadableImageUrl(url), filename: fileName })
  return `/api/download-image?${params.toString()}`
}

export function canvasSafeImageUrl(url: string) {
  if (!url || isDirectBrowserUrl(url)) return url
  const dynamicPath = dynamicImagePath(url)
  if (dynamicPath) return `/api/proxy-image?url=${encodeURIComponent(dynamicPath)}`
  if (isSameOriginUrl(url)) return url
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

function dynamicImagePath(url: string) {
  try {
    const parsed = new URL(url, window.location.href)
    if (parsed.origin !== window.location.origin) return ""
    return isDynamicImagePath(parsed.pathname) ? `${parsed.pathname}${parsed.search}` : ""
  } catch {
    return isDynamicImagePath(url.split("?")[0]) ? url : ""
  }
}

function isDynamicImagePath(pathname: string) {
  return pathname.startsWith("/uploads/") || pathname.startsWith("/results/")
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
