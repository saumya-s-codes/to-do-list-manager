// storage.js - Clear the Day
//
// Gives the app the small `window.storage` it saves with (get / set / delete / list), kept in the phone's localStorage.
// (The app was first built to run as a Claude artifact, which provides its own window.storage; in a normal browser,
// this file provides the same thing.)
//
// IMPORTANT: keys are saved exactly as the app names them. Never change how keys are named, or everything already
// saved on a phone will look lost. scripts/check-storage.mjs guards the two lines marked CHECK below.

const OLD_PREFIX = "clear-the-deck:";   // CHECK: older versions saved every key with this in front; it is still read as a fallback

const storage = {
  // Resolves with { key, value }. Like the artifact version, a missing key throws.
  async get(key) {
    let value = localStorage.getItem(key);
    if (value === null) value = localStorage.getItem(OLD_PREFIX + key);   // data saved by an older version
    if (value === null) throw new Error("Key not found: " + key);
    return { key, value, shared: false };
  },

  // Throws if the phone refuses to keep it (for example, storage is full or blocked), so the app can say so.
  async set(key, value) {
    localStorage.setItem(key, value);   // CHECK: keys are saved exactly as the app names them
    return { key, value, shared: false };
  },

  async delete(key) {
    const had = localStorage.getItem(key) !== null;
    localStorage.removeItem(key);
    return { key, deleted: had, shared: false };
  },

  // The keys that start with a prefix (no prefix: all of them).
  async list(prefix = "") {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k !== null && k.startsWith(prefix)) keys.push(k);
    }
    return { keys, prefix, shared: false };
  },
};

// Use the artifact's own window.storage if there is one; otherwise this one.
if (typeof window !== "undefined" && !window.storage) window.storage = storage;

export default storage;