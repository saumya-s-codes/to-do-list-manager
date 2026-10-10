// Runs automatically before every build (`npm run build`, including on GitHub).
// It stops the build if the two settings that decide WHERE your data is saved have been changed.
// Changing either one makes everything already saved on a phone look lost.
//
// If you ever need to change them on purpose, write a migration that copies the old data across first,
// then update the expected values below.
import { readFileSync } from "node:fs";

const EXPECTED_KEY = 'const STORAGE_KEY = "clear-the-deck:v4";';
const EXPECTED_PREFIX = 'const OLD_PREFIX = "clear-the-deck:";';
const EXPECTED_RAW_KEY = "localStorage.setItem(key, value);";   // keys are saved exactly as the app names them

const app = readFileSync("src/App.jsx", "utf8");
const storage = readFileSync("src/storage.js", "utf8");
const problems = [];
if (!app.includes(EXPECTED_KEY)) problems.push("STORAGE_KEY in src/App.jsx has changed.");
if (!storage.includes(EXPECTED_PREFIX) || !storage.includes(EXPECTED_RAW_KEY)) problems.push("How src/storage.js saves keys has changed (or the file was replaced).");

if (problems.length) {
  console.error("\n✖ Storage check failed. Building was stopped to protect saved data:\n");
  problems.forEach((p) => console.error("  - " + p));
  console.error("\nIf this was an accident, restore the old line with `git diff` / `git checkout`.");
  console.error("If it was on purpose, migrate the saved data first, then update scripts/check-storage.mjs.\n");
  process.exit(1);
}
console.log("✔ Storage check passed.");
