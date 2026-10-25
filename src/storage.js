// The app was first built as a Claude artifact, which provides `window.storage`.
// In a normal browser that doesn't exist, so this gives the same small API on top of localStorage.
//
// Keys are stored exactly as the app names them (no prefix), so data saved by earlier builds is found.
// A key saved by the first GitHub build (with the "clear-the-deck:" prefix added) is still read as a fallback.
// IMPORTANT: don't change how keys are stored here without migrating, or existing data will look lost.
if (!window.storage) {
  const OLD_PREFIX = "clear-the-deck:";
  window.storage = {
    async get(key) {
      let value = localStorage.getItem(key);
      if (value === null) value = localStorage.getItem(OLD_PREFIX + key);
      if (value === null) throw new Error("Key not found");
      return { key, value, shared: false };
    },
    async set(key, value) {
      localStorage.setItem(key, value);
      return { key, value, shared: false };
    },
    async delete(key) {
      localStorage.removeItem(key);
      localStorage.removeItem(OLD_PREFIX + key);
      return { key, deleted: true, shared: false };
    },
    async list(prefix = "") {
      const keys = new Set();
      for (const k of Object.keys(localStorage)) {
        if (k.startsWith(prefix)) keys.add(k);
        if (k.startsWith(OLD_PREFIX + prefix)) keys.add(k.slice(OLD_PREFIX.length));
      }
      return { keys: [...keys], prefix, shared: false };
    },
  };
}

// Ask the browser not to clear this site's data when it's short on space (a request; browsers may ignore it)
try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (_) { /* ignore */ }
