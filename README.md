# Clear the Day

A mobile-first task app built around one idea: get everything out of your head, sort it quickly, and clear the day.

> Capture. Choose. Do what matters.

<!-- Add screenshots here, for example: ![Today screen](docs/today.png) -->

## The five tabs

The tab bar runs **Today, Future, Inbox, Radar, Dashboard**. Inbox is the big circle in the middle, with a count of what's waiting to be sorted.

- **Today**: your list for the day.
  - **Thought dump**: type one thought per line, then tap **Fast add** (straight onto Today as a small, quick, low-impact task in your default category) or **Move to inbox** (sort it later).
  - Tap a task to open **Edit details**. Hold and drag to reorder.
  - The sort button next to **+** cycles through **My order**, **By the matrix**, **By category** and **By time of day** with each tap. Time of day splits Today into **Morning, Afternoon and Evening**; hold and drag a task across a divider to move it between them (or pick it in Edit details). The icon shows which one you're on, and the choice is remembered.
  - Tasks sent on from yesterday carry a "Migrated from yesterday" tag; tasks pulled up from later carry "Pulled forward".
  - The dark bar at the bottom, **Plan tomorrow**, opens the planner (below).
  - Finishing a task sets off confetti: two cannons at the bottom left and right each fire once toward the middle while confetti rains from the top. Clearing the last task on Today, or tapping Done in Plan tomorrow, sets off the big one (about 580 pieces). Phones set to reduce motion get none.
  - A finished task stays for about a second, checked off, then fades out. It's still listed under Dashboard, See what you finished.
  - **Undo after finishing:** ticking a task off (on Today, Future or Radar) shows a short message at the top with an **Undo** button, for about 5 seconds. Undo puts the task back where it came from, even after it has faded away. Finishing the last task of the day shows "The day is clear." with the same Undo. If you finish several tasks quickly, Undo covers the most recent one; older ones can be un-finished from Dashboard, See what you finished.
- **Future**: everything not for today, as a **Calendar** (the main view) made of three cards, **Tomorrow**, **This week** and **Later**, or as a **Matrix** (Quick Wins, Major Focus, Admin / Fillers, Deferral). On the Calendar, every task has an up and a down button: down pushes it back (tomorrow, this week, later, Someday); up pulls it forward (on a Tomorrow task the up button is the Today icon, because it sends the task to Today). Past-due tasks collect in "Needs attention". Your Matrix/Calendar choice is remembered, and so is the category filter while you move around the app.
- **Inbox**: a swipeable card deck for sorting thoughts. Every card starts as your **default category**, **Quick**, **High impact** and **Now**, so most cards need only **Prioritize**. Change anything that's different, or send the card to **Someday** or **Watch**. Nothing is saved until you tap. Swipe left to skip to the back of the deck, swipe right to go to the previous card. Every send (Prioritize, Someday, Watch, Delete) has an **Undo** button on its message, and there's an Undo pill in the header.
- **Radar**: **Watching** (things you're waiting on; swipe left to send one back to the Inbox) and **Someday** (ideas for later), one tap apart. Watching is laid out like Today: a header with the count, a round **sort button** and **+**. The sort button switches between **By category** (a colored card per category, the default) and **My order** (one list; hold and drag items into any order, across categories; each item shows its category as a small colored label). The two orders are kept separately, so changing one never scrambles the other, and your choice is remembered. The **+** on the Watching page opens a short sheet with just a title and a category (your default category is pre-selected); open an item afterwards to add a due date or impact.
- **Dashboard**: momentum stats, today's focus, open items by category, and the matrix at a glance. **See what you finished** lists everything completed, grouped by day.

### Plan tomorrow

One screen replaces the old evening card deck. Tasks sit on a ladder of time: **left over today**, **tomorrow**, **this week**, **later**, and **parked** (Someday and Watching).

- **Down arrow** pushes a task back one rung (left over, tomorrow, this week, later, Someday). **Up arrow** pulls a task from This week, Later or Parked straight to tomorrow. **All to tomorrow** moves every leftover at once. **Undo** takes back the last move, and every move shows a short message.
- This week and Later can be long, so each shows the soonest five (then highest impact, then major focus) with a button for more.
- A load bar shows how many tasks are planned for tomorrow, how many are deep focus, and how many you usually finish (the average on the days you finished things in the last two weeks).
- Tap a task to open Edit details; closing it brings you back. **Done** changes the Today bar to "Tomorrow is planned".
- Whenever Today goes from having open tasks to none (you finish the last one, or move the rest with **All to tomorrow** or from Edit details), the big confetti goes off with a "The day is clear." message. Tapping **Done**, or leaving the planner after planning with the day clear, sets it off too. Two big ones never stack.

### Undo

Most actions show a short message with an **Undo** button for about 5 seconds: finishing a task (on any page), adding a task, deleting, sending something to the Inbox (including swiping it off Watching), Someday and Watch, the **Today** shortcut on Future and Someday, pushing and pulling in Plan tomorrow, deleting a category, changing the default category, and restoring or clearing data. Closing **Edit details** after you changed something shows "Changes saved" with an Undo that puts the task back exactly as it was when you opened it. Undo covers the most recent action; if you do several things in a row, the earlier ones can't be undone from the message. Dragging to reorder has no Undo.

### Categories and the default

Add categories anywhere; manage them in **Settings, Manage categories**. A **star** marks the **default category**: new Inbox cards and Fast add start as that category. There is always exactly one default. It can't be deleted (make another one the default first), and if it's ever missing the app falls back to **Miscellaneous** (and creates it if needed).

### Edit details

Tapping a task on **any** page (Today, Future, Radar, finished tasks) opens the same Edit details sheet; there is no pop-up menu.

- **Goes to**: Today, Tomorrow, This week or Future. Picking one fills in the date (today, +1, +3 or +7 days); typing a date by hand moves the choice to match. A task in Someday or Watching has none selected until you pick one.
- **Due date and Category** sit on one line under it, then **Effort** and **Impact**.
- **There is no Save button.** An existing task saves itself a moment after every change (and when the sheet closes), and a small "Saved" tag shows by the title. A change that can't be saved yet, like moving a task to Today before it has an effort and impact, waits until it's complete. A new task is added with the **Add item** button.
- **Move or remove** is a separate section at the bottom: **Someday**, **Watch** and **Delete**. A task already in Someday has no Someday button, and one already in Watching has no Watch button; on Today and Future both show, next to Delete. Finished tasks show Delete only. Whatever you've just edited is kept when you tap Someday or Watch.

## How dates and urgency work

| Rung | Date | Where it lives |
| --- | --- | --- |
| Now | Today (or overdue) | Today |
| Tomorrow | Tomorrow | Future (Tomorrow) |
| This week | 2 to 6 days out (pushed there = +3) | Future (This week) |
| Later | 7 or more days out (pushed there = +7) | Future (Later) |

- **The day starts at 5 AM.** At 1 AM on Monday, "today" is still Sunday and "tomorrow" is Monday. The app rechecks on focus and every minute.
- Urgency values (Inbox and the Edit sheet): **Now** (due today), **Next** (+3 days), **Later** (+7 days). Changing a date by hand updates the urgency to match.
- **The rule:** a task on Today or in Future always has a date, urgency, effort and impact. If effort or impact is missing, the task waits in the Inbox.
- **Effort**: Quick (under 20 minutes) or Deep (over 20 minutes). **Impact**: High or Low. A deep, high-impact task is a **Major focus**.
- **Someday** and **Watching** are parking places and never have an urgency. Someday has no date and keeps effort and impact. Watching can keep a due date and its impact, but has no effort.
- Tasks sent to tomorrow (or pushed back) leave Today and come back on their day. A Future task that's overdue moves to Today when you open the app (once a day).

## The look

Two themes share one sketchbook look: cream paper, ink outlines drawn a little wobbly, and an illustration at the top of each screen. Choose between them in **Settings, Theme**.

- **Café** (the default): red and olive green with an ink-sketch café. Titles use Newsreader. Tab icons are simple line icons (a sunrise for Today).
- **Fairway**: clubhouse greens, a red flag and gold, with a golf course on every screen. Titles use Playfair Display. Tab icons are golf pictures, and the Inbox circle shows a basket of golf balls.

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
2. In the repository, go to **Settings, Pages** and set **Source** to **GitHub Actions**.
3. Push to `main`. The workflow builds the app and publishes it. Your site will be at `https://<your-username>.github.io/<repository-name>/`.

The build uses relative paths (`base: "./"` in `vite.config.js`), so it works from a project subpath without extra setup.

### Updating the app safely

Most updates change only `src/App.jsx` (the whole app lives in that one file), sometimes plus `index.html`.

1. **Replace single files, never whole folders.** On a Mac, dragging a folder onto a folder of the same name and choosing Replace deletes the files that weren't in the dragged folder (for example `src/main.jsx` and `src/storage.js`, or everything in `public/` such as the manifest and splash images). Drag the individual files in, or choose Merge.
2. Check **Source Control** before committing: only the files you meant to change should show, and **nothing should show as deleted**.
3. Push, then open the repository's **Actions** tab and wait for the green check.
4. Close the app completely and open it twice. Settings shows the version at the bottom.

If a build fails with `Rollup failed to resolve import "/src/main.jsx"`, a file was deleted by a folder replace. Restore it from git: `git restore --source=<last-good-commit> -- src/main.jsx src/storage.js`.

## Installing on an iPhone

Open the site in Safari, tap **Share, Add to Home Screen** (leave **Open as Web App** on if it is shown). The app runs full screen with the default status bar (`apple-mobile-web-app-status-bar-style` in `index.html`): the clock and battery sit on their own strip, and the app starts below it and runs to the bottom of the screen. It has its own icon (`public/`) and a `manifest.webmanifest`. iPhone reads these when the app is first added, so after changing any of them (the icon, the manifest, the status bar style), back up your data, delete the Home Screen app, add it again, and restore.

Why the status bar is `default` and not `black-translucent`: with the see-through style the app drew behind the clock, but on recent iPhones iOS then reported the page 62 points shorter than the screen (the height of the status bar) and only painted down to that line, which left a gap under the tab bar. Anything stretched past that line was cut off, and measuring the screen with code made it blink. The default status bar has none of that, and it is what the Meal Loop app uses. There are no launch pictures (startup images) either: they are optional and weren't showing.

## Your data

Tasks are saved in your browser's `localStorage` on the device you use. Nothing is sent to a server. This means:

- Data is per browser and per device; it doesn't sync. An installed home-screen app on iPhone keeps its own separate data from Safari.
- Clearing your browser data, or **deleting the Home Screen app**, clears your tasks.
- Pushing code to GitHub never touches the data on your phone.

### Keeping your data safe

- **Back up regularly:** Settings, **Back up & restore**, **Download a backup** saves a JSON file (always named `clear-the-day-backup.json`) with your tasks, categories, their colors, the default category and your settings.
- **Restoring takes almost any file.** **Restore from a file** looks at what is *inside* the file, not its name or ending: this app's own backup (`.json`), a spreadsheet (`.xlsx` from Excel, Numbers or Sheets, or `.csv` with commas, semicolons or tabs), another app's JSON list, or a plain text list with one task per line. Columns are matched by name (Title, List, Category, Effort, Impact, Due date, Created, Completed, and common alternatives such as Text, Status, Task, Due), so a file from another app usually works. Before anything changes, the app shows what it found (for example "Found 8 tasks · Today 2 · Inbox 1 …"). A backup file replaces what is in the app (with Undo). A spreadsheet or list is **added** to what is there by default (anything already here is skipped, so importing twice never doubles your list), or can replace everything. A task on Today or Future with no effort or impact waits in the Inbox, as everywhere else in the app. Anything that can't be read gets a message saying what files work.
- **You can see that it is saving.** The bottom of Settings shows when the last save worked and how many tasks it held ("Saved on this phone · 2:14 PM · 48 tasks"), or a red warning if saving is failing.
- **Automatic snapshots:** the app saves one snapshot per day (the last 7 are kept). Restore one from Settings, Back up & restore.
- **Never change `STORAGE_KEY`** in `src/App.jsx` (it's `clear-the-deck:v4`), and don't change how `src/storage.js` names keys. Either change makes existing data look lost, because the app looks for it in a new place. If the shape of the saved data changes, migrate it when loading instead. An optional check script, `scripts/check-storage.mjs`, confirms this before a release; the app doesn't need it to run.
- **Don't overwrite `src/storage.js` or `src/App.jsx` wholesale** when updating from another source without comparing them first (`git diff`).
- If saved data exists but can't be read, the app shows a message and won't save until it loads, so it can't overwrite recoverable data.
- **If the app goes back to the sample tasks every time you open it, check `src/storage.js` first.** It must be this project's file: it defines `window.storage` (get, set, delete, list) and saves keys exactly as the app names them. A different file with the same name (for example a task-list helper) loads fine, but then nothing is ever saved or loaded. `scripts/check-storage.mjs` spots this (it looks for `const OLD_PREFIX = "clear-the-deck:";` and `localStorage.setItem(key, value);`); run it with `node scripts/check-storage.mjs`, or add it as a `prebuild` step in `package.json` so a bad file stops the build.
- After every save the app reads the data back to check it was really stored. If the phone refuses to keep it (or pretends to and keeps nothing), the app says so once per launch and points to **Download a backup**, instead of failing silently.

The storage layer is in `src/storage.js`. The app was first built to run as a Claude artifact, which provides its own `window.storage`; this file gives the same small API in a normal browser.

## Project structure

```
clear-the-deck/
├── index.html          # page, icons, status bar style
├── package.json
├── vite.config.js
├── .github/workflows/deploy.yml
├── public/             # favicon, app icons, manifest.webmanifest
└── src/
    ├── main.jsx        # entry point
    ├── storage.js      # localStorage version of window.storage
    └── App.jsx         # the whole app: the looks, styles, views, logic, pictures
```

`App.jsx` is one large file on purpose, in this order: saving a file, the looks (themes), helpers, styles, shared components, then one section per screen (Today, Inbox, Future, Radar, Plan tomorrow, Dashboard, the sheets, the app itself). Search for the section banners (for example `TODAY`, `INBOX`, `PLAN TOMORROW`) to jump around. The pictures are embedded in it as images, so there are no separate image files to keep in step.

### Changing a look

Every color, font, radius and shadow comes from a CSS variable. They are all in the `THEMES` entries (`cafe` and `golf`) near the top of `App.jsx`. The shared sketchbook styles start with `.cd[data-look="ink"]` in the stylesheet.

### The Fairway pictures

They live in `GOLF_ART` (Café's are in `CAFE_ART`), in three groups: `hdr` (the banner at the top of each screen, 900 by 462), `nav` (the five tab pictures; the Inbox one is see-through and cream, for the green circle) and `empty` (the drawings on empty screens). To swap one, replace its embedded image with a new WebP cut at about three times the size it's shown, with a white background (or see-through, for the Inbox circle).

## Versioning

The version shown at the bottom of Settings is `APP_VERSION` near the top of `src/App.jsx` (the `version` in `package.json` is separate and not shown). Update it when you ship a change, and add a line to [CHANGELOG.md](CHANGELOG.md).

## License

[MIT](LICENSE). Remember to put your name in the license file.
