# Companion privacy implementation notes

The production Privacy Policy is served at:
https://studyos-web-production.up.railway.app/privacy/companion

Keep these implementation facts synchronized with the policy and Chrome Web Store Privacy tab:

- No chrome.history permission.
- Automatic tracking only runs on the declared supported learning host permissions.
- Pairing tokens are stored in chrome.storage.local and are removed on Disconnect.
- Recent sync health is local and can be cleared in Companion Settings.
- Automatic progress is sent over HTTPS to StudyOS.
- Server-side learning data uses authenticated Supabase RLS.
- Selected text is only collected when the student deliberately uses Capture.
- Full transcripts are not automatically copied.
- AI-assisted curriculum classification may process the lesson title/curriculum candidates through the configured StudyOS AI gateway.
- Study-kit AI only receives notes/text deliberately supplied by the student.
- No personalized advertising or sale of Companion data.
