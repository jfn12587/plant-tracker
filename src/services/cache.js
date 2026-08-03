const CACHE_KEY = 'vera-pwa-data';
const CACHE_VERSION = 1;

export function getCachedData() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (cached.version !== CACHE_VERSION) return null;
    return cached;
  } catch {
    return null;
  }
}

export function setCachedData(data) {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        version: CACHE_VERSION,
        timestamp: Date.now(),
        data,
      })
    );
  } catch {
    // localStorage full or unavailable
  }
}

export function getCacheTimestamp() {
  const cached = getCachedData();
  return cached?.timestamp || null;
}
