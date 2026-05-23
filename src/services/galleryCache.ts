export const GALLERY_STORAGE_KEY = 'gallery_recent'
export const MAX_GALLERY_ITEMS = 5

export interface CachedImage {
  imageUrl: string
  prompt: string
  savedAt: string
}

export function loadCachedGallery(): CachedImage[] {
  try {
    const raw = localStorage.getItem(GALLERY_STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return []
}

export function saveCachedGallery(images: CachedImage[]) {
  try {
    localStorage.setItem(GALLERY_STORAGE_KEY, JSON.stringify(images))
  } catch {}
}

export function addToGallery(imageUrl: string, prompt: string): CachedImage[] {
  const current = loadCachedGallery()
  const next: CachedImage[] = [
    { imageUrl, prompt, savedAt: new Date().toISOString() },
    ...current.filter((img) => img.imageUrl !== imageUrl),
  ].slice(0, MAX_GALLERY_ITEMS)
  saveCachedGallery(next)
  return next
}
