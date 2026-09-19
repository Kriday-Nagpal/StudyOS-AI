# StudyOS Learning Companion

The Companion is the browser-side part of StudyOS automatic learning tracking.

## Automatic mode

After pairing once at:

`https://studyos-web-production.up.railway.app/companion/connect`

the extension watches HTML5 learning-video progress on supported learning domains and periodically syncs:

- lesson URL and title
- current playback position
- lesson duration
- calculated completion percentage
- pause/end resume position

Supported automatic domains currently include YouTube, Physics Wallah / PW, DIKSHA, and Khan Academy.

StudyOS then:

1. identifies the platform,
2. reuses an existing subject/chapter/topic mapping when present,
3. attempts a high-confidence curriculum mapping for new lessons,
4. saves progress using the signed-in student's own Supabase session and RLS,
5. creates a continue-learning or review recommendation,
6. lets the daily planner resurface unfinished lessons.

## Study-kit capture

The toolbar/context-menu capture remains available for deliberate notes or selected text. That flow can create summaries, flashcards, and explicit doubts after review.

Automatic video progress does **not** silently copy full transcripts or private account history.

## Permissions

The extension requests:

- `activeTab`
- `scripting`
- `contextMenus`
- `storage`
- host access only for the StudyOS production origin and supported learning domains

It does not request Chrome browser-history permission.

## Local installation

1. Open your Chromium browser's extensions page.
2. Enable developer mode.
3. Choose **Load unpacked**.
4. Select this `companion-extension` folder.
5. Open the StudyOS Companion popup and choose **Connect automatic sync**.
6. Sign in to StudyOS if needed and press **Connect Companion** once.

After pairing, keep the extension enabled while using supported lesson sites.
