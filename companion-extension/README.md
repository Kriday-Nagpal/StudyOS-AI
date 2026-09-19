# StudyOS Learning Companion — Private Beta

StudyOS Learning Companion is the browser-side automation layer for StudyOS learning tracking.

## Private Beta UI

Version 1.2 adds:
- premium command-center popup;
- live supported-site and lesson detection;
- current video progress;
- Auto Sync toggle;
- Sync Now;
- Capture Notes / Study Kit shortcut;
- StudyOS Learning shortcut;
- sync health and recent sync state;
- full Companion Settings page;
- pairing/disconnect controls;
- configurable 30 sec / 1 min / 2 min / 5 min sync intervals;
- pause/end sync controls;
- toolbar badge preference;
- local recent-sync clearing.

## Automatic mode

After pairing once at:

`https://studyos-web-production.up.railway.app/companion/connect`

the extension watches HTML5 learning-video progress on supported learning domains and periodically syncs:
- lesson URL and title;
- current playback position;
- lesson duration;
- calculated completion percentage;
- pause/end resume position.

Supported automatic domains currently include YouTube, Physics Wallah / PW, DIKSHA, and Khan Academy.

## Study-kit capture

The toolbar/context-menu capture remains deliberate and review-first. It can pass the current page URL/title and text the student has deliberately selected to StudyOS. Study Kits can then create summaries, flashcards and explicit doubts from that student-supplied learning context.

Automatic progress does **not** silently copy full transcripts or private browser history.

## Store preparation

See:
- `STORE_LISTING_PRIVATE_BETA.md`
- `PRIVATE_BETA_PUBLISHING.md`
- `PRIVACY_IMPLEMENTATION.md`

The public Companion privacy policy is:
`https://studyos-web-production.up.railway.app/privacy/companion`
