# Changelog

## 10.11
- **The cannons fire once.** Each of the two bottom-corner cannons now fires a single volley (with one flash), instead of repeated volleys that felt jittery. The volleys are bigger to make up for it, and confetti still rains from the top. A finished task gets about 200 pieces; clearing the day or finishing Plan tomorrow gets about 580.
- **Finished tasks vanish after about a second.** A task you tick off stays for a second, checked and struck through, then fades out and its gap closes, on Today (all three sort views), Future and Radar. Un-ticking it before it goes keeps it. Finished tasks are still in Dashboard, See what you finished.

## 10.10
- **A lot more confetti, from two cannons and the sky.** The confetti is now drawn on a canvas, so it can be big and stay smooth. Two cannons, bottom left and bottom right, fire volleys up toward the middle (with a flash at each muzzle), and confetti rains from the top.
  - **Every finished task:** two volleys from each cannon plus a shower, about 200 pieces.
  - **Clearing the last task on Today, or Done in Plan tomorrow:** six volleys from each cannon, a heavy shower from the top and a pop from each top corner, about 850 pieces over about six seconds, with a longer buzz.
  - The pieces flutter and spin, in rectangles, dots and streamers, in festive colors. Phones set to reduce motion get none.

## 10.9
- **No Save button on Edit details.** An existing task saves itself a moment after every change (and when the sheet closes), and a small "Saved" tag shows next to the title. A change that can't be saved yet, like moving a task to Today before it has an effort and impact, waits until it's complete. A new task still has an Add item button.
- **Much more confetti.** Every finished task now gets a burst from both bottom corners (about 60 pieces, in several shapes and bright festive colors, with a flutter). Finishing the last task on Today, or tapping Done in Plan tomorrow, gets the big one: five cannon shots plus a shower from the top, about 300 pieces over four seconds, with a stronger buzz. Phones set to reduce motion get no confetti.

## 10.8
- **One way to edit a task, everywhere.** Tapping a task on Future or Radar (Watching and Someday) now opens Edit details straight away, like Today. The pop-up menu and the separate date sheet are gone.
- **"Goes to" is the same four places for every task:** Today, Tomorrow, This week, Future. Picking one fills in the date (today, +1, +3, +7 days); typing a date by hand moves the choice to match. A task in Someday or Watching has none selected until you pick one.
- **The due date sits right under "Goes to", on the same line as Category.** Effort and Impact are on the line below.
- **A separate "Move or remove" section** at the bottom of the sheet has Someday, Watch and Delete. A task already in Someday has no Someday button, and one already in Watching has no Watch button; on Today and Future both show, next to Delete. Finished tasks show Delete only. Whatever you've just edited is kept when you tap Someday or Watch.
- Saving a task for tomorrow now sets its urgency to Now, the same as Plan tomorrow does.

## 10.7
- **Calendar is the main view of Future.** It's listed first and is the default. If your phone was left on Matrix, it moves to Calendar once when this version first opens; after that, whichever you pick is remembered.
- **The Today icon is the same everywhere.** On Fairway, the "move to Today" button on Tomorrow rows now shows the colored sunrise from the tab bar. The green "Today" pills and the "Move to Today" menu item use the sunrise too, instead of a generic arrow.

## 10.6
- **New Fairway tab icons from your icon set:** Today (sunrise over the fairway with the flag), Radar (binoculars), Dashboard (scorecard), and the Inbox circle now shows your cream basket on the green. Future keeps its existing picture. Unselected tabs are softened and greyed; the selected tab shows full color.

## 10.5
- **Sharper Fairway empty-screen drawings.** "The deck is clear" on Today now shows your new green with the flag, hole, ball and bunker, and "All sorted" in the Inbox shows your new basket of golf balls. The old versions were tiny (the basket was about 100 pixels wide, shown about 130 points tall); the new ones are cut at about three times the size they're shown. The trophy ("Nothing finished yet", "Someday is empty", "Nothing sorted here yet") and the binoculars ("Nothing to watch") are still the old pictures.

## 10.4
- **Sharper Fairway tab pictures.** The Today (sunrise over the fairway with the flag), Inbox (basket of golf balls, in cream on the green circle) and Radar (binoculars) pictures are now your new line drawings, made transparent and cut at several times the size they're shown. The old pictures were about 100 pixels wide and were washed grey, which is why they looked blurry. Future and Dashboard still use the old pictures until they get the same treatment.

## 10.3
- **The Today icon is a sunrise** (a sun coming up over a horizon line), simpler than the clubhouse picture. It's on the Today tab in both themes and on the "move to Today" buttons on the Future page, so the button looks like the tab it sends the task to.

## 10.2
- **The Future page no longer shows Today.** The Calendar view now has Tomorrow, This week and Later.
- **Up and down buttons on the Future page's calendar rows,** like Plan tomorrow: down pushes a task back (tomorrow → this week → later → Someday), up pulls it forward. On a Tomorrow task the up button is the **Today picture**, because it moves the task to Today; on This week and Later it's an up arrow that pulls the task to tomorrow. Each move has a short message with Undo. The Matrix view is unchanged.
- **New Today icon on the tab bar:** a sun (Fairway keeps its clubhouse picture). "Move to tomorrow" now uses a moon, so sun = today and moon = tomorrow everywhere.

## 10.1
- **The Future page's Calendar view uses the same rungs as Plan tomorrow:** Now, Tomorrow, This week and Later, instead of one card per date. This week lists its days under each other; Later lists its months. The Tomorrow card has a Plan button that opens the planner. Overdue tasks stay in "Needs attention" at the top. The Matrix view is unchanged.

## 10.0
- **Plan tomorrow replaces Evening Clean Up.** The card deck, its swipes and its recap are gone. The bar on Today now says "Plan tomorrow" and opens one screen with everything on a ladder of time: left over today, tomorrow, this week, later, and parked (Someday and Watching).
  - **▼** pushes a task back one rung (left over → tomorrow → this week → later → Someday). **▲** pulls a task from This week, Later or Parked straight to tomorrow. "All to tomorrow" moves every leftover at once. Undo takes back the last move.
  - **Long lists:** This week and Later show the soonest five (then highest impact, then major focus), with a button to show more.
  - **Load bar:** how many tasks are planned for tomorrow, how many are deep focus, and how many you usually finish (the average on the days you finished things in the last two weeks).
  - Tapping a task opens Edit details and returns you to the planner.
  - Tasks you pull forward get a "Pulled forward" tag when they reach Today (like "Migrated from yesterday").
  - After you tap Done, the bar says "Tomorrow is planned" for the rest of the day.

## 9.16
- **The Inbox circle is the same color as the Evening Clean Up bar** (deep forest green in Fairway; olive in Café, where they already matched).

## 9.15
- **Fairway's Inbox circle is green**, like Café's, with a new cream icon: a golf ball about to drop into the inbox tray.

## 9.14
- **A default category you choose.** In Settings, Manage categories, a star marks the default category. It's what new Inbox cards start as, and what Fast add files things under. Tap another star to change it. There is always exactly one: the default can't be deleted (make another one the default first), and if it's ever missing, the app falls back to Miscellaneous (and creates it if needed). Backups remember it.

## 9.13
- **Tab bar alignment.** The "Inbox" label now sits inside the big circle, and all five tabs share one centre line, so the row is balanced instead of the circle standing above the others. The bar is also a little shorter.

## 9.12
- **Fairway Inbox header:** the dog's head is no longer cut off. The picture now starts below the status bar, where it can be seen.
- **Inbox starting labels.** Every card starts as Miscellaneous, Quick, High impact, due Now, so most cards need only Prioritize. Nothing is saved until you tap, and you can change any of them. "Miscellaneous" is created the first time it's needed.
- **Future page:** the Matrix or Calendar choice is remembered when you leave the page (and when you reopen the app), and so is the category filter while you move around the app. The category filter now sits on the same line as Matrix and Calendar.
- **Today:** tapping a task (or its "...") opens Edit details straight away. Move to tomorrow and Delete are in that sheet; the other moves are available through "Goes to".
- **Tab bar:** Future and Inbox swap places, and Inbox is now a big circle in the middle with the other four around it.

## 9.11
- **The Screen fit setting is gone.** The bottom bar now sits at the bottom of the screen on its own: in the installed iPhone app with the see-through status bar, the app uses a page as tall as the screen. There is nothing to choose in Settings any more.

## 9.10
- **Screen fit, to cure the empty band under the tab bar.** 9.9 tried to stretch the app to the full screen height, but the phone cuts off a fixed layout at the page height, so the tab labels were clipped. The app now offers a "page" layout that is as tall as the screen. Settings has a new **Screen fit** setting: **Auto** (turns it on only when the phone reports the page as exactly one status-bar shorter than the screen), **Stretch** (forces it in the installed app) and **Standard** (never). A small line under it shows the numbers the phone reports, so the right setting can be chosen quickly. The choice is kept on that phone only.

## 9.9
- **Fix: a big empty band under the tab bar** in the installed iPhone app with the see-through status bar. The phone reports the page as shorter than the screen by the height of the status bar, so the Evening bar and tab bar stopped short of the bottom. In exactly that situation the app now uses the full screen height. Nothing changes anywhere else.

## 9.8
- **The sort button on Today is a plain toggle.** No pop-up any more: each tap moves to the next way of sorting (My order, then the matrix, then category, then round to My order again). The button's picture shows which one you're on (arrows, grid, folder), and the line under "Today's To Do" says it in words.

## 9.7
- **Fast add is now Low impact** (Miscellaneous, Quick, Low impact, due today). Chores land in the Admin / Fillers group in the matrix view instead of Quick Wins, so Quick Wins stays for things that really matter. Tasks you already added with Fast add keep High impact.

## 9.6
- **Smaller Today header, bigger Thought dump.** Today now uses the same compact header as the Inbox, and the room that frees up goes to the Thought dump: its box and the two buttons beside it are about 50 points taller.

## 9.5 (a trial)
- **Both Thought dump buttons on the right.** Fast add and Move to inbox sit side by side to the right of the box, full height, instead of under it. This is a try-out: `revert-to-9.4.zip` puts the two-buttons-underneath layout back in one step (replace `src/App.jsx`).

## 9.4
- **Two big buttons in the Thought dump.** The small "left to sort in Inbox" chip and the little Type/Send square are gone. Under the box there are now two chunky buttons side by side: a red **Fast add** (straight onto Today as Miscellaneous, Quick, High impact) and **Move to inbox** (sort it later). Tapping either with an empty box just puts the cursor in the box. The Inbox tab still shows its count.

## 9.3
- **Fast add.** A red button in the Thought dump, just before the "left to sort in Inbox" chip. Type one or more chores (one per line) and tap it: they go straight onto Today as Miscellaneous, Quick, High impact, due today, with an Undo. The box stays open for the next one. The category "Miscellaneous" is created the first time you use it. The Type/Send button still sends to the Inbox.

## 9.2
- **Typing in the thought dump no longer rearranges the screen.** The header picture and the tab bars used to vanish, with a blank gap flashing, every time the keyboard opened or closed. The screen now only rearranges when the keyboard would actually cover the box you are typing in (for example a box low on the screen), and it goes back to normal the instant the keyboard closes.

## 9.1
- **Fairway Inbox header uses the rule of thirds.** The left third is kept clear for the title, the picture fills the right two thirds, and the dog's face sits on the right-hand third line. (It was a little too wide in 9.0.)

## 9.0
- **Fairway Inbox picture fills the header.** It now starts much further left (it filled two thirds of the width before, and on a short screen only about a third), so the header is no longer mostly blank. On a short header the picture is cropped instead of shrunk, so it stays big.

## 8.9
- **Sharper Fairway headers.** All five header illustrations (Today, Inbox, Future, Radar, Dashboard) are replaced with your higher-quality versions, cut to fit the headers and placed so the title always sits on plain paper.

## 8.8
- **No more loading screen.** The picture shown while the app opens is gone, and so is the wait for fonts (up to a second and a half). The app appears as soon as your saved data is read, and its fonts swap in when they arrive. `index.html` now starts the font download at the very beginning, before the app's code, so that swap is quick.

## 8.7
- **Fix: the whole screen could be pulled around, with the header scrolling away.** A swipe that landed on the header, the tab bar or the end of a list could drag the entire window up and let it bounce. Swipes now only move something that can really scroll, in the direction it can still scroll; everywhere else they're ignored, so the header and bars stay put. Normal scrolling of the lists, sheets and text boxes is unchanged.

## 8.6
- **A count on "Today's To Do":** a small badge next to the heading shows how many tasks are open today. It goes down as you finish tasks or move them to another day.

## 8.5
- **Fix: the screen could get stuck as if the keyboard were open.** After typing, the tab bar, the Evening Clean Up bar and the header picture could disappear, leaving a keyboard-sized gap at the bottom. The app now only treats the keyboard as open while you are really typing in a text box, re-checks whenever focus moves or you come back to the app, and re-checks every half second while it thinks the keyboard is up, so it can't stay stuck.

## 8.4
- **Fix: dragging a task to reorder Today.** The list used to scroll by itself too eagerly, so a task you lifted could shoot past where you wanted it, especially when the list area is short. The automatic scrolling now has a small zone at the very top and bottom of what you can see, moves slowly, and only starts once you've actually moved the task.

## 8.3
- **Prioritize is always its true green.** It used to fade to about half strength until Effort, Impact and Urgency were all set, which made the green look pale. It now keeps its full color, and "not ready yet" is shown by the faint arrow and the "Set all three first" caption. (With no category chosen, the three tiles still fade on purpose.)

## 8.2
- **Fairway green is now #387F23** (taken from the picture you sent), for Prioritize, Tomorrow, This week, Future and the Today tag. Small green text uses a slightly deeper shade (#2D6A1D).

## 8.1
- **Fairway green is now #009B16** (Prioritize, Tomorrow, This week, Future, the Today tag). Small green text, such as the "Major focus" and "Migrated" tags, uses a deeper shade (#00700F) so it stays easy to read, and text on the green buttons is white.

## 8.0
- **Fairway button colors:** the scheduling buttons (Prioritize, Tomorrow, This week, Future and the Today tag) are golf green #4F743F, Someday is red #C9472C, and Watch is yellow #E5B83F. The red is also used for the plus button and Delete. Café is unchanged.

## 7.9
- **One app icon.** The checklist, pen and golf ball is now the icon for both themes, shown while the app opens and used for the Home Screen. The App icon setting is gone.

## 7.8
- Removed the "Save this picture" button from the App icon screen. Nothing needs to be downloaded: the choice is made right there and remembered.

## 7.7
- **New Fairway app icon:** a checklist with a pencil and a golf ball in the grass. It's used on the App icon screen and for the opening picture, and it's in `golf-icon-files.zip` for the Home Screen.

## 7.6
- **Fairway: the line under each title is readable.** It used to run over the picture (on Radar, "hold to" disappeared into the binoculars). It now stays in the clear part of the header, wrapping to a second line if needed, with a soft paper glow behind it.

## 7.5
- **Fairway Inbox picture is bigger.** It's now the same size as the pictures on the other screens and runs to the right edge, instead of sitting small in the middle of the header. (On a short screen it still fits the smaller header.)

## 7.4
- **New Fairway graphics** from the updated sheet: new header illustrations on every screen (the Yorkie now looks out over the course on Future), redrawn tab-bar pictures, new empty-screen drawings, and the new app icon (the flag between two bunkers).

## 7.4
- **New Fairway graphics** from the updated sheet: a new header illustration on every screen (the pond view with the planner, the Yorkie in the golf bag, the Yorkie looking out over the course, the binoculars and ball basket, the clubhouse board), new tab-bar pictures, new empty-screen drawings, and a new Fairway app icon (the flag between the bunkers).

## 7.3
- Corrected the note on the App icon sheet. It used to suggest using the saved picture for a Home Screen shortcut, but a shortcut opens the website in Safari with its own empty copy of your data, so that was misleading.

## 7.2
- **Fairway Inbox:** the Undo button moved under the settings button, so it no longer covers the dog's face.

## 7.1
- **Fix: the theme showed up twice in the Settings dropdown.** The list now offers only the other theme, since the one you're using is already shown above it.

## 7.0
- **A second theme: Fairway.** The same sketchbook look in clubhouse greens with a red flag and gold. Its own header illustration on every screen, its own tab-bar pictures (clubhouse, basket of balls, calendar with a flag, binoculars, scoreboard), its own empty-screen drawings, and Playfair Display for titles. Café is still the default. Choose between them in Settings (Theme).
- **App icon setting.** Settings, App icon: choose Café or Fairway. It changes the picture shown while the app opens, and you can save the picture. iPhone doesn't let an app change its own Home Screen icon.

## 6.8
- **Adding a task:** the sheet now offers Today, This week, Future and Watching, and the date fills itself in: today, in 3 days, in 7 days. Change the date by hand and the choice follows it.
- **Today, by the matrix:** each group (Quick Wins, Major Focus, Admin / Fillers, Deferral) is its own card, like the Future page.
- **Today, by category:** a new sort option, with one card per category.
- **Inbox deck:** swipe right goes back to the previous card, and from the first card it goes round to the last one. It only moves through cards still waiting, so a card you have already sorted never comes back (the Undo button is for that).
- **Future tags** (High impact, Low impact) use the same green and red as the Inbox.

## 6.7
- **Fix: text spilled out of the empty Inbox card** on shorter screens. The message is now one short line, and the picture shrinks first when the card is short, so everything stays inside it with room to spare.

## 6.6
- **Inbox swipes match Evening Clean Up:** swipe a card left to skip it (it goes to the back of the deck), or right to go back to the previous card (the same as Undo). The left and right arrow keys do the same. The card shows a small hint.
- **An empty Inbox keeps all its controls** (the category picker, Prioritize, Someday, Watch and the Effort, Impact and Urgency buttons), switched off and greyed out, instead of hiding them.

## 6.5
- **Swipe through the cards in Evening Clean Up.** Swipe a card left to skip it (the task stays as it is), or right to go back to the previous card (the same as Undo). The recap lists how many you skipped. The buttons work as before.

## 6.4
- A task you send to tomorrow (Evening Clean Up, Everything to tomorrow, or Move to tomorrow in the menu) now remembers the day it was sent from. When it comes back on Today it carries a **Migrated from yesterday** tag (or "Migrated from Oct 11" if it comes back later). Changing the task's date, or sending it somewhere else, clears the tag.

## 6.3
- **Sort Today by the matrix.** A new sort button next to the plus on "Today's To Do" lets you choose My order (drag to reorder) or By the matrix (Quick Wins, Major Focus, Admin / Fillers, Deferral, with a small heading for each group). Your choice is remembered and included in backups.
- The outline around "Today's To Do" is gone.
- When the phone lets the app draw behind the status bar (see `index.html`), that strip is the app's cream color.

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
