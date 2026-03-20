export function getShareNameStorageKey(shareId: string) {
  return `trav-share-name:${shareId}`
}

export function getSharePasswordStorageKey(shareId: string) {
  return `trav-share-pass:${shareId}`
}

export function getStoredShareName(shareId: string | null | undefined) {
  if (!shareId || typeof window === "undefined") return null
  return window.localStorage.getItem(getShareNameStorageKey(shareId))
}

export function setStoredShareName(shareId: string, name: string) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(getShareNameStorageKey(shareId), name)
}

export function getStoredSharePasswordHash(shareId: string | null | undefined) {
  if (!shareId || typeof window === "undefined") return null
  return window.localStorage.getItem(getSharePasswordStorageKey(shareId))
}

export function setStoredSharePasswordHash(shareId: string, passwordHash: string) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(getSharePasswordStorageKey(shareId), passwordHash)
}

export function clearStoredSharePasswordHash(shareId: string) {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(getSharePasswordStorageKey(shareId))
}
