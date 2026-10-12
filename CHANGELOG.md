# Changelog

## 6.2
- **Fix: the Inbox card disappeared when you edited its text.** The keyboard used up the screen and squeezed the card to nothing. Now the controls below the card step aside while you edit, and the illustration in the header shrinks while the keyboard is open.
- The Inbox card is bigger: the Inbox header is shorter, and the card has a minimum height.

## 6.1
- Button colors: **Watch** is now gold (#D4A84F) and **Someday** is the red. Same on every screen: the Inbox cards, Evening Clean Up, the Radar tabs and the menus.

## 6.0
- **One look: Café.** All the other themes (Papyrus, Vibrant, Botanical, Celestial, Sanctuary, Clean) and the theme setting are gone. Settings no longer has a theme section, and everyone gets Café, including anyone who had picked another theme.
- Only the two fonts Café uses (Newsreader and Inter) are loaded now, so the app loads a little less. The Papyrus background picture is no longer used, so `src/assets/papyrus-bg.jpg` can be deleted.

## 5.5
- **Tomorrow takes a task off Today.** In Evening Clean Up (and "Move to tomorrow" in the menu), a task sent to Tomorrow gets tomorrow's date and leaves the Today list. It comes back on its day. "Everything to tomorrow" does the same for all that are left.
- **Today is only for what is due today or overdue.** A task with a later date lives in Future until its day arrives, wherever the date came from (Edit date, Edit details, and so on). Overdue tasks in Future are moved to Today too.
- **The day starts at 5 AM.** Between midnight and 5 AM it is still the day before: at 1 AM on Monday, "today" is still Sunday, so "tomorrow" is Monday. This applies everywhere the app asks what today is (due dates, finished today, the Today bar, and so on).
- Evening Clean Up's recap lists everything that will be on tomorrow's Today.

## 5.4
- **Fix: Evening Clean Up forgot your Tomorrow choices.** A task you sent to Tomorrow stays on Today, so when you closed Evening Clean Up early and came back, it asked about that task again. Tasks you've already handled tonight are now remembered, and the Today bar counts only what's still unsorted.
- Evening Clean Up saves each choice the moment you tap it (before, it waited for the card to slide away).
- New **Complete** button under the six buttons, three buttons wide: it closes out the day right away and leaves whatever is left as it is.
- The Inbox remembers which cards you sent to the back, so switching tabs and coming back doesn't reshuffle the deck.

## 5.3
- Removed the **Loading icon** setting. The loading screen always shows the ink illustration (the app's icon), and there is nothing to change in Settings. Any choice an older version remembered is cleared.

## 5.2
- Café: a hand-drawn ink line under the header on every screen, matching the card outlines.

## 5.1
- The Café pictures are built into the app, so no separate image files are needed (nothing to add to `public/`).
- **Settings:** themes are a dropdown. It shows the current theme, and tapping it opens the list.

## 5.0
- New theme: **Café**. Cream paper, black ink outlines drawn a little wobbly, red and olive green, a serif title font, and an illustrated header on each screen (Today, Inbox, Future, Radar, Dashboard). Empty screens show small ink drawings (a cat, books, an open book, flowers).

## 4.8
- The automatic backup is now a single copy that is replaced each day (it used to keep the last 7 days). Today's copy is written first, then older ones are removed.

## 4.7
- A backup file is now always named `clear-the-day-backup.json` (it used to include the date). Saving it again to the same place in Files offers Replace, so you keep one backup instead of one for every day.

## 4.6
- The app is now called **Clear the Day** (it was "Clear the Deck"): the Today header, Settings, the page title, backup and Excel file names, and the README.
- Where your data is saved is unchanged, so nothing is lost. Backups made before this still restore.

## 4.5
- **New app icon**: the ink illustration (checklist, coffee and pen). It is the new default loading icon, and it is the first choice in Settings, Loading icon (the colored icons are still there). New Home Screen icon files are in `public/` (`apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `favicon.png`).

## 4.4
- **Loading icon** setting (Settings, Loading icon): choose from ten icons and six colors for the picture shown while the app opens. The choice is remembered so the right icon is on screen from the first moment, and it is included in backups. The icon on your Home Screen can't be changed from inside the app (iOS only reads it when the app is added).
- The launch pictures (`public/splash/`) are plain again, since they can't follow your choice. Your icon appears as soon as the page starts.

## 4.3
- The loading screen now shows the app icon (the same rust-colored check icon as the home screen) instead of a plain beige screen with a dot. It holds still at first and breathes gently if loading takes a while.
- New launch pictures (`public/splash/`) and `index.html` show the same icon, so what you see from the first frame to the app is one continuous screen.

## 4.2
Consistent button colors. Each kind of button is the same color on every screen:
- **Prioritize, Today, Tomorrow, This week, Future**: the theme's main color.
- **Someday**: its own color (Inbox, Evening Clean Up, the Radar tab, the menus).
- **Watch**: its own, different color.
- Prioritize no longer switches from light to dark. It is always the main color, dimmed until effort, impact and urgency are set. Someday and Watch are solid colors too.

## 4.1
- **Today:** the three-dot menu on a task has Move to someday (and so does the menu of a task in the Inbox).
- **Evening Clean Up:** the six buttons are smaller, in a 3 by 2 grid (Tomorrow, This week, Future / Someday, Watch, Everything to tomorrow), and the task card is bigger. "Everything to tomorrow" (it used to be "Keep the rest for tomorrow") is a different color.

## 4.0
- **The rule:** a task on Today or in Future always has a date, urgency, effort and impact (Someday is parked, so it's exempt). The app enforces it everywhere: adding, editing, moving, loading and restoring a backup. Effort and impact need you to choose them, so a task missing either waits in the Inbox, and the editor won't save one on Today or Future without them. A date and urgency are filled in automatically from each other.
- **Today view:** the "Due today" and "Urgent" tags are gone from Today's tasks.
- **Categories:** deleting a category that has items asks what to do with them: move them to another category (or a new one), or re-sort them in the Inbox. You can also change any category's color (Settings, Categories).

## 3.9
- **Today:** tapping a task now offers Move to tomorrow, Move to this week, Move to future, Move to watch, Edit details and Delete. Tomorrow, this week and future set the date the same way the Inbox and Evening Clean Up do (Now, Next, Later).
- **Evening Clean Up:** every button is dark, and there is a new Someday button.
- **Celestial:** the text on the big cards is bold.
- **Soft Sanctuary** is now called **Sanctuary**.

## 3.8
Faster launch.
- A new service worker (`public/sw.js`) opens the app from a saved copy straight away and updates it quietly in the background, so a launch no longer waits on the network. It also keeps the fonts, so the app opens fully offline.
- Launch pictures (`public/splash/`): iPhone shows a soft-white screen while the app starts instead of plain white. They take effect when the app is added to the Home Screen.
- No fade-in at launch, and the loading dot only appears if loading takes longer than half a second.

## 3.7
- Fixed a flash of raw, unstyled text when the app starts. The fonts used to be an `@import` inside the app's own stylesheet, which made Safari hold the stylesheet back until the fonts downloaded. They now load through normal `<link>` tags.
- The app now waits (up to 1.5 seconds) for the saved theme's fonts before showing, so it no longer flashes in fallback fonts and then jumps. Switching themes waits for the new theme's fonts the same way.

## 3.6
- A soft-white strip (the bottom bar's color) now sits at the very top of every screen, above the header. iOS tints the status bar from the top edge of the page, so this keeps the top band soft white on every theme instead of picking up a colored header.
- The loading screen uses the same soft white.

## 3.5
- The band at the top of the screen (the iPhone status bar area) is now the same soft white as the bottom bar (Today, Inbox, and so on) in every theme, instead of one fixed cream. Each theme's bottom bar is now a solid color so the two match exactly.

## 3.4
Final font pass.
- **Clean**: Courier Prime Regular for the page title and big card titles, Plus Jakarta Sans for everything else, and nothing bold anywhere.
- Includes the earlier font changes: Botanical (Manrope + Lato), Celestial (Nixie One + Comfortaa) and Soft Sanctuary (Rouge Script + Klee One). Papyrus and Vibrant keep their fonts.

## 3.3
- Clean fonts first pass (Plus Jakarta Sans SemiBold for smaller headings). Superseded by 3.4.

## 3.2
- **Soft Sanctuary** fonts: Rouge Script for the page title and big card titles, Klee One SemiBold for smaller headings, Klee One for body text.
- Inbox card titles now follow a theme's title scale (capped so long titles still fit).

## 3.1
- **Celestial** fonts: Nixie One for the page title and big card titles, Comfortaa Bold for smaller headings, Comfortaa for body text.
- **Botanical** fonts: Manrope Bold for headings, Lato for body text.
- Themes can now set a separate font for smaller headings (`--font-display-sm`) and scale the page title (`--display-scale`).

## 3.0
A big release: the Radar tab, and one consistent set of rules for dates and urgency.
- **Radar** replaces the Watching tab. Watching and Someday live together, one tap apart, each with a count. Future is now just Matrix and Calendar.
- **Dates and urgency follow one rule everywhere**: Now = today, Next = within 3 days, Later = further out. The Inbox, Evening Clean Up, the item menu, Edit date and Edit details all agree. See the README.
- **Evening Clean Up** has Tomorrow (Now), This week (Next) and Future (Later), and Tomorrow now moves the date too.
- Watching can keep a due date, and Someday keeps effort and impact. Neither holds an urgency.
- Smoother keyboard handling for the thought dump, a neutral status bar, backup and restore, and the Completed screen (all added since 2.0).

## 2.8.1
- The Parked tab is now called **Radar**, with a radar icon.

## 2.8.0
- New **Radar** tab (first named Parked) replaces Watching in the bottom bar. It has two lists, Watching and Someday, each with a count, so Someday is one tap away instead of buried inside Future.
- Future now has just Matrix and Calendar.
- Moving a task to Someday or Watching shows a toast with a View button that jumps to it.

## 2.7.3
- Watching items can keep a due date. They still have no urgency or effort. The date shows on the Watching row, and Edit date and the item editor work on Watching items.

## 2.7.2
- Parking rules adjusted: Someday clears only the date and urgency (it keeps effort and impact). Watching clears the date, urgency and effort (it keeps impact).
- Moving an item out of Someday or Watching sends it to the Inbox with its labels pre-filled, so it only needs an urgency to get its date.
- The item editor shows effort and impact for Someday items, and impact for Watching items.

## 2.7.1
- Evening Clean Up: Tomorrow now moves the date too (urgency Now, due tomorrow), for a single task and for "Keep the rest for tomorrow". Undo restores the old dates.
- The Edit details sheet moves the date with the status: Today = Now (due today), Future = Later (due in 7 days). A task added straight to Today gets today's date.
- The red Urgent tag shows only when a Now task is due today or overdue.
- Someday and Watch it have one-liners ("Save it. No date", "Track it. No date") like Prioritize, and they now show on shorter screens.

## 2.7.0
- Dates, urgency and tags now follow one set of rules everywhere (see "How dates and urgency work" in the README).
- Someday and Watching items never carry a due date, urgency, effort or impact. Anything sent there is cleared.
- Moving an item to Today sets it to Now (due today). Moving it from Today to Future sets it to Later (due in 7 days).
- Moving an item out of Someday sends it to the Inbox, where it is sorted and dated like any other.
- Editing a date by hand updates the item's urgency to match (today or overdue = Now, within 3 days = Next, later = Later).
- Someday items no longer offer "Edit date" and no longer show Urgent or impact tags.
- Dashboard: Someday items no longer count as due, overdue, in Future, or in the Matrix chart.

## 2.6.1
- Evening Clean Up now matches the Inbox urgency levels: Tomorrow = Now (stays on the deck), This week = Next (due in 3 days), Future = Later (due in 7 days). Each sets the task's urgency and due date the same way the Inbox does.

## 2.6.0
- Evening Clean Up: the Done button is gone. The top two choices are now Tomorrow (stays on the deck) and This week (moves off Today, due by Sunday). Future and Watch are unchanged.

## 2.5.9
- Thought dump keyboard: the app no longer dips down and snaps back when the keyboard opens. The frame stays still and the keyboard just takes space off the bottom; the bottom bars come back only after the keyboard has finished closing.

## 2.5.8
- Effort threshold changed from 15 to 20 minutes: Quick is under 20 minutes, Deep is over 20.

## 2.5.7
- Prioritize now needs all of it: category, effort, impact and urgency. Urgency is no longer optional and no longer cycles back to None.

## 2.5.6
- Inbox: every control below the card (toggles, Prioritize, Someday, Watch it) is greyed out until a category is chosen. Tapping one shakes the category picker and says what to do.
- While the keyboard is open, the bottom bar and Evening Clean Up bar are hidden so they can't cover what you're typing, and the field scrolls into view.

## 2.5.5
- Backup reminder stays on screen for 5 seconds (was 9) and starts at 10 tasks (was 5).

## 2.5.4
- Backup reminder briefly removed. It came back in 2.5.5.

## 2.5.3
- The phone's status bar now uses one fixed neutral color for every theme. iOS only reads that color at launch, so a per-theme color showed the previous theme's color after switching. The restart workaround from 2.5.2 is removed.

## 2.5.2
- Switching themes in the installed iPhone app now restarts the page once, so the status bar matches the new theme (iOS only reads that color at launch). Not needed, and not done, with the translucent status bar.

## 2.5.1
- The page now draws behind the iPhone status bar (translucent status bar), so the top of the screen always matches the active theme and can't keep a previous theme's color.

## 2.5
- The phone's status-bar tint now follows the active theme, fixing a stale color (such as Vibrant's blue) after switching themes.
- A gentle backup reminder: at most once a day, when there's no backup in the last 7 days.
- Back up & restore shows the date of your last backup.

## 2.4
- **Back up & restore** in Settings: download a JSON backup, restore from a backup file, or restore from an automatic daily snapshot (the last 7 days).
- The app now keeps one automatic snapshot per day.
- If saved data exists but can't be read, the app no longer saves over it.
- Storage keys are saved exactly as the app names them, so data from earlier builds is found. The storage key must never change.
- Asks the browser to keep this site's data when storage is tight.

## 2.3
- New **Completed** screen, reached from the Dashboard, with finished tasks grouped by day.
- Tap the circle on a completed task to uncheck it. The row slides out, the task returns to the list it came from, and a toast offers Undo.
- Finished tasks no longer show a due date.
- **Edit details** on a finished task has an editable **Date completed** field.
- Date fields always fit the width of their card.
- Dashboard button to open Completed, styled like Evening Clean Up.

## 2.2
- Inbox uses a four-quadrant layout again: Prioritize (top left), toggles (bottom left), Someday and Watch it (right).
- Effort, Impact and Urgency are tap-to-cycle toggles, each color-coded.
- Urgency: Now (today, goes to Today), Next (in 3 days), Later (in 7 days).
- Prioritize only lights up when category, effort and impact are set.
- Thought dump "send" animation drops toward the Inbox instead of shaking.
- Smoother hand-off between Inbox cards after a swipe.
- Papyrus: solid background behind the Evening Clean Up button.

## 2.1
- Urgent option, color-coded impact, effort definitions (under or over 15 minutes).
- Manage and delete categories from Settings.
- Satisfying effects: pop on check, press feedback, confetti when the deck is cleared, haptics.
- "Left to sort in Inbox" count on the thought dump.
- Edit details moved to the top of each item's menu.
- Fixes for keyboard layout, duplicate toasts, lost edits on close, Clear everything Undo, and stale Someday flags.

## 2.0
- Six themes: Papyrus, Vibrant, Botanical, Celestial, Soft Sanctuary, Clean.
- New top bar on every screen with a theme-specific settings button.
- Compact Settings with a theme grid and a version label.
- Matrix-style cards for Calendar and Someday; colored category headers on Watching.

## 1.0
- First version: Today, Inbox, Future, Watching and Dashboard.
