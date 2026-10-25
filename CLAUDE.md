# Platoon helper

Hebrew RTL helper for a platoon/company: who is in/out, auto guard roster (שמירות), requests, equipment (ציוד, sergeant). Plain ES modules, no bundler, no framework, no tests. The app is the static site in `app/www/` (an installable PWA: `manifest.webmanifest`, `sw.js`, `icons/`), published to GitHub Pages by `.github/workflows/pages.yml`. The site holds no data. An Android build via Capacitor (`app/`, same setup as `../tshuva-helper/app`) is optional and no longer the main route. All relative URLs, so it works under a `/repo-name/` path. Everything works offline; data is one JSON object in `localStorage` (`lib/store.js`).

- `app/www/lib/scheduler.js` is the roster algorithm. It has no DOM code, so it can be tried in node. Shift points = hours × weight (night/evening/day). The lowest points inside the rolling window (`settings.windowHours`) gets the seat. Hard filters: absent, overlapping shift, missing qualification. Soft penalties added to the score: short rest, night after night, "not together" pairs. Soldiers new or back from absence start at the window average. `assess()` re-checks existing shifts live, so the roster shows yellow/red chips when something changes.
- `lib/store.js` holds the permission table (`PERMS`). Roles: admin, officer, sergeant. Soldiers don't log in and only view. The login (`lib/auth.js`) only changes what the UI shows. The real access control is meant to be Drive folder sharing (Viewer for soldiers, Editor for staff).
- Views are in `www/views/*.js` and export `render(el, ctx)`. Each assigns `el.onclick`, not addEventListener, because `render` is called again on every data change.
- Soldier = first/last name + `place` (מסגרת: מ"מ/סמל/כיתה א..) + `job` (תפקיד: מ"כ/נגב/קלע..) + `service` (מלא/חלקי/סטודנט). A job also works as a qualification for posts. Places and jobs are editable lists in settings. `state.round` = the service round (start/end); `newRound()` in store.js resets a round and keeps soldiers. Names are imported by pasting (`parseNames` in views/soldiers.js).
- `views/calendar.js` + `lib/hebdate.js` (copied from tshuva-helper) give the Hebrew calendar with holidays, expected presence per day and job coverage.
- Demo data is `lib/demo.js` (`state.demo` is set). It can be deleted from Settings.

- UI: mobile first. Bottom tab bar on phones (with an "עוד" menu for requests/settings/login), sidebar from 900px. Design tokens and dark mode are at the top of `styles/app.css`. Icons are inline SVG from `lib/icons.js`; `avatar()` in `lib/ui.js` gives the colored initials circle.

## Not done yet
- Google Drive sync (JSON files in a shared folder, check for newer file before saving). It needs a Google Cloud OAuth setup, so see `../tshuva-helper/app/www/lib/drive-app.js` for how that app did it.
- Release signing (`app/build-apk.cmd` makes a debug-signed `platoon-helper.apk` for testing; tools are in `C:\dev\tools`), icons, shift reminders.
- Export (to discuss): Excel report and WhatsApp-ready summaries of various data (attendance, roster, equipment). Only the roster share exists so far.
- Import from the user's reserve-duty Excel (`מעקב מילואים - נוכחות ותפקידים.xlsx`): names are done (paste). Equipment is entered in the app, not imported. Possible later: the פקל sheet (expected kit per position) to compare with what a soldier actually signed for.
- Roll call (מסדר) checklist, company/platoon hierarchy (the `platoon` field exists on soldiers).
