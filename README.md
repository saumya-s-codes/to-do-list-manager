# Clear the Deck

A mobile-first task app built around one idea: **capture, choose, do what matters.**
Dump thoughts fast, sort them when you're ready, and close out each day with a short cleanup.

Built with React and Vite. No backend: everything is stored in your browser.

## Features

- **Today**: a thought dump (one thought per line, one tap to send), your task list with hold-and-drag reordering, and an Evening Clean Up that walks through what's left, one item at a time.
- **Inbox**: a swipeable card deck. Tap a card's text to edit it, delete with Undo, and sort each card with Prioritize (effort and impact), Someday, or Watch it.
- **Future**: your sorted tasks as a matrix (Quick Wins, Major Focus, Admin, Deferral), a calendar view, and Someday. Overdue items get their own "Needs attention" group.
- **Watching**: things to keep an eye on, grouped by category. Check them off, reorder them, or swipe left (Apple Mail style) to send one back to the Inbox. Undo is always one tap away.
- **Dashboard**: momentum stats, today's major-focus progress, open items by category, and a matrix breakdown.
- **Export**: Settings → Export to Excel downloads every item (Today, Inbox, Future, Someday, Watching, and finished) as one workbook, with an "All items" sheet plus one sheet per list. On a phone it opens the share sheet so you can save to Files.
- **Themes**: Earthy & Refined, Minimal & Professional, and Vibrant & Gamer.

## Getting started

```bash
npm install
npm run dev
```

Open the local URL it prints. The layout is designed for a phone-sized screen, so use your browser's device toolbar (or open it on your phone) for the intended experience.

```bash
npm run build     # production build in dist/
npm run preview   # serve the production build locally
```

## Install it on your phone

The app ships with a web app manifest and icons, so once it's deployed you can add it to your home screen and it opens full screen like a native app: in Safari use **Share → Add to Home Screen**, in Chrome use **Install app** or **Add to Home screen**. A service worker caches the app after your first visit, so it opens offline too. Visit it once online and let it finish loading. New deploys reach you the next time you open the app with a connection.

## Deploying to GitHub Pages

A workflow is included at `.github/workflows/deploy.yml`.

1. Push this repo to GitHub with `main` as the default branch.
2. In the repo, go to **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Push to `main` (or run the workflow manually). Your site appears at `https://<username>.github.io/<repo>/`.

## How your data is stored

Items, categories, and your theme choice are saved to `localStorage` under the key `clear-the-deck:v4`. Data lives only in the browser and device you used, and clearing site data erases it. Settings → **Load sample data** and **Clear everything** reset it from inside the app.

`src/storage.js` provides the small `window.storage` interface the app saves through. To sync across devices later, replace its `get` and `set` with calls to a backend.

## Project structure

```
src/
  App.jsx       the whole app: themes, helpers, views, and sheets
  main.jsx      entry point
  storage.js    localStorage-backed storage shim
  exportData.js Excel export
public/
  sw.js         service worker (offline support)
  manifest.webmanifest, icons, favicon.svg
```

## Adding a theme

Every colour, font, radius and shadow comes from a CSS variable set by the active theme. Open `src/App.jsx`, copy any entry in the `THEMES` object, and change its `vars`, `catPalette` and `swatches`. The picker in Settings lists every entry automatically.

## Notes

- To force every device to drop its cached files, bump `CACHE` in `public/sw.js`.
- `AUTO_SAVE` in `src/App.jsx` (Inbox) makes a card sort itself as soon as category, effort and impact are set. It's off by default.
- The app's version is baked into its storage key. If the data shape changes, bump `STORAGE_KEY` so old data doesn't load into a new shape.
