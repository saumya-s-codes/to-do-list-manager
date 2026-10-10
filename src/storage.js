// The app was first built as a Claude artifact, which provides `window.storage`.
// In a normal browser that doesn't exist, so this gives the same small API on top of localStorage.
// Your data stays on this device and in this browser.
if (!window.storage) {
  const PREFIX = "clear-the-deck:";
  window.storage = {
    async get(key) {
      const value = localStorage.getItem(PREFIX + key);
      if (value === null) throw new Error("Key not found");
      return { key, value, shared: false };
    },
    async set(key, value) {
      localStorage.setItem(PREFIX + key, value);
      return { key, value, shared: false };
    },
    async delete(key) {
      localStorage.removeItem(PREFIX + key);
      return { key, deleted: true, shared: false };
    },
    async list(prefix = "") {
      const keys = Object.keys(localStorage)
        .filter((k) => k.startsWith(PREFIX + prefix))
        .map((k) => k.slice(PREFIX.length));
      return { keys, prefix, shared: false };
    },
  };
}
