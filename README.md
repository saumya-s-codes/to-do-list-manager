# Clear the Day

A mobile-first task app built around one idea: get everything out of your head, sort it quickly, and clear the day.

> Capture. Choose. Do what matters.

<!-- Add screenshots here, for example: ![Today screen](docs/today.png) -->

## Features

- **Today**: your list for the day, with drag-to-reorder, a thought dump box, and an Evening Clean Up flow that sorts what's left.
- **Inbox**: a swipeable card deck for sorting thoughts. Set a category, effort, impact and urgency, then send each card to Future, Someday, or Watching.
  - **Effort**: Quick (under 20 minutes) or Deep (over 20 minutes). Tap to cycle.
  - **Impact**: High (green) or Low (red). Tap to cycle.
  - **Urgency**: Now (due today, goes straight to Today), Next (in 3 days), Later (in 7 days). Required.
  - The Prioritize button only lights up once category, effort, impact and urgency are all set. Every control stays greyed out until a category is chosen.
- **Future**: your sorted tasks as a Matrix (Quick Wins, Major Focus, Admin, Deferral) and a Calendar by due date.
- **Radar**: Watching (things you're waiting on, grouped by category; swipe left to send one back to the Inbox) and Someday (ideas for later), one tap apart.
- **Dashboard**: momentum stats, today's focus, open items by category, and the matrix at a glance.
- **Completed**: everything you've finished, grouped by day. Tap the circle to uncheck a task and send it back. Edit a finished task to change its completion date.
- **Categories**: add them anywhere, delete them from Settings → Manage categories.
- **Export**: download everything as an Excel workbook (Settings → Export).
- **Satisfying details**: haptic buzzes on supported phones, pop and slide animations, and confetti when you clear the day.

## How dates and urgency work

| Urgency | Date | Where it lives |
| --- | --- | --- |
| Now | Today (or overdue) | Today |
| Next | Within 3 days (the Inbox sets +3) | Future |
| Later | Further out (the Inbox sets +7) | Future |

- The Inbox, Evening Clean Up, Edit date and the item menu all use this same mapping.
- **The rule:** a task on Today or in Future always has a date, urgency, effort and impact. If effort or impact is missing, the task waits in the Inbox.
- **Someday** and **Watching** are parking places and never have an urgency. Someday has no date and keeps effort and impact. Watching can keep a due date and its impact, but has no effort. An item gets urgency when it moves to Today or Future.
- Moving an item to Today makes it Now. Moving it out of Someday or Watching sends it to the Inbox with its labels pre-filled, so it only needs an urgency.
- Changing a date by hand updates the urgency to match.

## The look

Two themes share one sketchbook look: cream paper, black ink outlines drawn a little wobbly, and an illustration at the top of each screen. Choose between them in Settings, under Theme.

- **Café** (the default): red and olive green with an ink-sketch café. Titles use Newsreader.
- **Fairway**: clubhouse greens, a red flag and gold, with a golf course on every screen and golf pictures in the tab bar. Titles use Playfair Display.

Body text uses Inter in both, from Google Fonts. If they can't load, the app falls back to similar system fonts.


## Getting started

You need [Node.js](https://nodejs.org) 18 or newer.

```bash
npm install
npm run dev
```

Then open the address Vite prints. The app is designed for phones, so it looks best in your browser's mobile view (or on a real phone on the same network).

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Build for production into `dist/` |
| `npm run preview` | Serve the production build locally |

## Deploying to GitHub Pages

A workflow is included at `.github/workflows/deploy.yml`.

1. Push this project to a GitHub repository with a `main` branch.
2. In the repository, go to **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Push to `main`. The workflow builds the app and publishes it. Your site will be at `https://<your-username>.github.io/<repository-name>/`.

The build uses relative paths (`base: "./"` in `vite.config.js`), so it works from a project subpath without extra setup.

## Your data

Tasks are saved in your browser's `localStorage` on the device you use. Nothing is sent to a server. This means:

- Data is per browser and per device; it doesn't sync. An installed home-screen app on iPhone keeps its own separate data from Safari.
- Clearing your browser data clears your tasks.

### Keeping your data safe

- **Back up regularly:** Settings → **Back up & restore** downloads a JSON backup you can restore later, and **Settings → Export** gives you an Excel copy.
- **Automatic snapshots:** the app saves one snapshot per day (the last 7 are kept). Restore one from Settings → Back up & restore.
- **Never change `STORAGE_KEY`** in `src/App.jsx`, and don't change how `src/storage.js` names keys. Either change makes existing data look lost, because the app looks for it in a new place. If the shape of the saved data changes, migrate it when loading instead.
- **Don't overwrite `src/storage.js` or `src/App.jsx` wholesale** when updating from another source without comparing them first (`git diff`).
- If saved data exists but can't be read, the app shows a message and won't save until it loads, so it can't overwrite recoverable data.

The storage layer is in `src/storage.js`. The app was first built to run as a Claude artifact, which provides its own `window.storage`; this file gives the same small API in a normal browser.

## Project structure

```
clear-the-deck/
├── index.html
├── package.json
├── vite.config.js
├── public/
│   └── favicon.svg
└── src/
    ├── main.jsx        # entry point
    ├── storage.js      # localStorage version of window.storage
    └── App.jsx         # the whole app: the look, styles, views, logic
```

`App.jsx` is one large file on purpose, in this order: Excel export, the looks (themes), helpers and sample data, styles, shared components, then one section per screen. Search for the section banners (for example `TODAY`, `INBOX`, `COMPLETED`) to jump around.

### Changing a look

Every color, font, radius and shadow comes from a CSS variable. They are all in the `THEMES` entries (`cafe` and `golf`) near the top of `App.jsx`. The shared sketchbook styles start with `.cd[data-look="ink"]` in the stylesheet. Each theme's pictures live in `CAFE_ART` and `GOLF_ART`.

## Versioning

The version shown at the bottom of Settings comes from `"version"` in `package.json`. Bump it there when you ship a change, and add a line to [CHANGELOG.md](CHANGELOG.md).

## License

[MIT](LICENSE). Remember to put your name in the license file.
