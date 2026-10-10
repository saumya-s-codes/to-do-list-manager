# Clear the Deck

A mobile-first task app built around one idea: get everything out of your head, sort it quickly, and clear the deck every day.

> Capture. Choose. Do what matters.

<!-- Add screenshots here, for example: ![Today screen](docs/today.png) -->

## Features

- **Today**: your list for the day, with drag-to-reorder, a thought dump box, and an Evening Clean Up flow that sorts what's left.
- **Inbox**: a swipeable card deck for sorting thoughts. Set a category, effort, impact and optional urgency, then send each card to Future, Someday, or Watching.
  - **Effort**: Quick (under 15 minutes) or Deep (over 15 minutes). Tap to cycle.
  - **Impact**: High (green) or Low (red). Tap to cycle.
  - **Urgency**: Now (due today, goes straight to Today), Next (in 3 days), Later (in 7 days).
  - The Prioritize button only lights up once category, effort and impact are all set.
- **Future**: your sorted tasks as a Matrix (Quick Wins, Major Focus, Admin, Deferral), a Calendar by due date, and a Someday list.
- **Watching**: things you're waiting on, grouped by category. Swipe left to send one back to the Inbox.
- **Dashboard**: momentum stats, today's focus, open items by category, and the matrix at a glance.
- **Completed**: everything you've finished, grouped by day. Tap the circle to uncheck a task and send it back. Edit a finished task to change its completion date.
- **Categories**: add them anywhere, delete them from Settings → Manage categories.
- **Export**: download everything as an Excel workbook (Settings → Export).
- **Satisfying details**: haptic buzzes on supported phones, pop and slide animations, and confetti when you clear the deck.

## Themes

Switch themes in Settings (the round button at the top right of every screen; its icon changes with the theme).

| Theme | Feel | Headings | Body |
| --- | --- | --- | --- |
| Papyrus | Warm paper, painted shapes | Fraunces | Inter |
| Vibrant | Primary colors, clean and playful | Poppins | Roboto |
| Botanical | Earthy, organic, grounded | Lora | Inter |
| Celestial | Airy, starlit, dreamy | Cormorant Garamond | Inter |
| Soft Sanctuary | Gentle, dreamy, peaceful | Playfair Display | Inter |
| Clean | Fresh whites and greys | Plus Jakarta Sans | Plus Jakarta Sans |

Fonts load from Google Fonts. If they can't load, each theme falls back to a similar system font.

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

- Data is per browser and per device; it doesn't sync.
- Clearing your browser data clears your tasks. Use **Settings → Export** to keep a copy.

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
    ├── App.jsx         # the whole app: themes, styles, views, logic
    └── assets/
        └── papyrus-bg.jpg   # painted background for the Papyrus theme
```

`App.jsx` is one large file on purpose, in this order: Excel export, themes, helpers and sample data, styles, shared components, then one section per screen. Search for the section banners (for example `TODAY`, `INBOX`, `COMPLETED`) to jump around.

### Adding or changing a theme

Every color, font, radius and shadow comes from a CSS variable set by the active theme. To add a theme, add an entry to the `THEMES` object in `App.jsx` (copy an existing one). The theme picker lists every entry automatically.

## Versioning

The version shown at the bottom of Settings comes from `"version"` in `package.json`. Bump it there when you ship a change, and add a line to [CHANGELOG.md](CHANGELOG.md).

## License

[MIT](LICENSE). Remember to put your name in the license file.
