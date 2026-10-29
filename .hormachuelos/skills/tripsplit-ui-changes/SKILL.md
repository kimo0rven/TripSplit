---
name: tripsplit-ui-changes
description: Make UI and bug changes in the TripSplit Expo app the way the owner wants: small verified edits, the app's settled UI conventions, and honest reporting.
---

# TripSplit change loop

How to change TripSplit: small focused edits, verified, reported honestly, following the UI conventions the owner settled on.

## 1. Start from the code, never from assumption

- Read the file before editing it. When the report names a screen ("the payments page", "the trip card"), grep for the label or component to find the real file — several screens share components.
- Never guess a route: Expo Router turns file names into routes, so check `src/app` for what actually exists.
- Before claiming something is or isn't in the app, search the source. `grep` for the exact string, and for the pieces it may be built from (`allLabel`, template strings).
- The owner pastes the same screenshot repeatedly when a fix doesn't show. Do not keep re-explaining — search the source, then inspect what the device actually runs.

## 2. Make the edit

- Pass every change for a file in one `edits` array, applied in order, all-or-nothing.
- Read the returned `after` lines and check they are what you meant. A doubled or partial edit is fixed right then.
- After a refactor, grep for what you orphaned — imports, styles, props, doc comments — and delete them in the same run.
- Keep the change as small as the request. No polish nobody asked for.

## 3. Verify, in this order

1. `npx tsc --noEmit` — zero errors required.
2. `npm run lint` — 0 errors. The ~71 warnings are pre-existing React Compiler advisories; leave them.
3. `npm test` — `node --test` over `tests/`; all must pass. Add a test when fixing maths, sorting, filtering or time logic.
4. `npx prettier --write <changed files>`.

- The Android line from the project checker (`gradlew.bat`) is a Windows-only script that always fails on this Mac. It is not a real error — say so plainly instead of chasing it.
- When a maths or comparison bug is suspected, prove it first with a small `node -e` script that reproduces the wrong numbers, then fix.
- **Testable helpers must have no imports at all.** `node --test` cannot resolve the `@/` alias, so a helper that imports anything is untestable. Keep pure logic (splitting, timing, grouping, sorting) in a file with zero imports, use `.ts` extensions on test imports, and note that `tests/` is excluded from tsconfig.
- Test the real types first; small fixtures. If a test fails, decide whether the test or the product is wrong before changing either — a wrong expectation is the more common cause.

## 4. Report honestly

- Never say the app was run, clicked through, or checked on a device. The owner tests. State plainly in `done` what could not be checked.
- Give the check counts (types, lint, tests) and name every changed file in backticks.
- **Do not claim "stale build" without hard evidence.** `strings` on a Hermes bundle proves nothing (bytecode) — that kind of "proof" must be withdrawn in one plain sentence. What counts: the source has zero matches, the string exists only inside `android/app/build/...`, and mtimes show the APK predates the fix.
- Never repeat a claim the owner has already rejected twice; go look instead.
- Dev servers go in background and get stopped when done. An old server already on a port belongs to the owner — leave it, but tell them to restart it.

## 5. UI conventions settled in this app

- **Pick one of N modes** (Equal / Percent / Custom / Itemised) → `TabSlider` tabs, equal widths, sliding highlight. **Not** chips.
- **Filter a list** → one compact row of pills, e.g. `All · You paid · You received`. Never two chip rows asking the same question. Remember the choice when returning to the page.
- **Destructive action** → `ConfirmSheet` sliding up from the bottom, red button with a matching icon. Close any underlying sheet first. Never a box in the middle of the screen.
- **Long history lists** → group by day with `DayDivider` (day + that day's total). Sort by day first even when the user sorts by amount; undated records sort last.
- **Previews** → cap at 3 rows, with a "View All" link that is always rendered, even when the list is empty.
- **An icon already says it** → drop the words (the crown means owner).
- **Icon-only controls** → always an accessibility label. Avatar pickers announce each name, with "(you)" for the current user.
- **Dates** → `formatDay` gives `Oct 21, 2026`; times via `formatTime`. Day-group headings use `dayHeading` ("Today", "Yesterday", else the date).
- **Avatars** → always pass `photoURL` to `<Avatar>`. A shared face/row component that forgets it shows coloured initials everywhere, on every screen that uses it.
- **Edit history** → its own page `/edit-log`, opened by an "Edit log (N changes)" link. The log travels in the route params, not by re-reading the database.
- **Routes** → `/dashboard`, `/trips`, `/profile/statistics`, `/profile/payments`. Moving a route file means sweeping every link; typed routes catch the misses. `NavBar` matches by prefix so sub-pages keep their tab lit.
- **Categories and icons** → one source, `src/constants/expense-categories.ts`.
- **An optional "everyone/everything" field** → empty means *all*, so the picker shows all as chosen without forcing the user to tick each face. Resolve to "all" in the display layer, keep the stored field empty.
- **"What's next" on a day-based list** → put the soonest upcoming item in a card above the list, and dim rows already past. Recompute from the current clock on render, not a timer.
- **A place name is tappable** → `mapUrlFor` builds a `maps.google.com/?q=` search and `Linking.openURL`. No mapping package. The map control must `stopPropagation()` so it does not also trigger the card's own press.

## 6. Native and Firebase

- The app name and icon live in `app.json` and are baked into `ios/` and `android/`. Run `npx expo prebuild --clean`, then rebuild — a JS reload never changes an icon, and Expo Go always shows Expo Go's own icon.
- Do not change `slug` or the Android package without being asked; they are tied to existing builds and store identity.
- Security rules live on the server. `database.rules.json` is only a copy: after editing it, deploy with `npx firebase deploy --only database` and read the rules back to confirm.
- A `PERMISSION_DENIED` while the UI allows the action means the server rule is stricter than the app — fix the rule, not the screen.
- The join page is hosted at `https://tripsplit-14f93.web.app` (folder `public/`, site in `.firebaserc`). Deploy with `npx firebase deploy --only hosting`.
