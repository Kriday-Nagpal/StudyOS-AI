# StudyOS Learning Companion BETA — Chrome Web Store Private Beta

## Recommended listing

**Name**
StudyOS Learning Companion BETA

**Category**
Education

**Short description**
Automatically sync supported learning-video progress into your private StudyOS workspace. Private beta for trusted testers.

**Detailed description**
THIS EXTENSION IS FOR BETA TESTING.

StudyOS Learning Companion connects supported educational video pages to a student's private StudyOS academic workspace.

After a one-time StudyOS pairing, the Companion can:
- automatically detect supported HTML5 lesson playback on YouTube, Physics Wallah/PW, DIKSHA and Khan Academy;
- sync the current lesson position, duration and completion percentage;
- save a resume point and recent learning evidence;
- help StudyOS resurface unfinished lessons in future study plans;
- allow the student to manually capture the current page or deliberately selected learning notes into the StudyOS review screen;
- open the StudyOS Learning Tracker and Companion settings quickly.

The Companion does not request Chrome browser-history permission. Automatic tracking is limited to the supported educational domains declared in the extension. It does not silently copy full lesson transcripts.

This Private Beta is intended only for trusted testers approved by the publisher.

## Single purpose statement

StudyOS Learning Companion automatically saves progress from supported educational video lessons and lets the student deliberately capture learning context into the student's private StudyOS workspace.

## Homepage
https://studyos-web-production.up.railway.app/

## Privacy policy
https://studyos-web-production.up.railway.app/privacy/companion

## Permission justifications

### activeTab
Used only after the student opens the Companion to inspect the currently active page for deliberate Capture to StudyOS actions and selected-text preview.

### scripting
Used when the student deliberately opens the popup to read text the student has selected on the active page for the Capture flow.

### contextMenus
Provides “Capture selection to StudyOS” and “Open StudyOS Learning Tracker” shortcuts.

### storage
Stores the paired StudyOS session locally in the extension, automation preferences, and a small recent-sync health history.

### Host permissions
Restricted to the StudyOS production origin and supported educational domains. These permissions let the installed Companion observe supported lesson video progress only on those sites.

## Privacy Practices / data disclosure notes

The extension processes:
- website content: current supported lesson page URL/title and deliberately selected text when the student chooses Capture;
- website activity: playback position/duration/completion for supported educational videos;
- authentication information: StudyOS access/refresh session stored locally so the Companion can act as the signed-in student;
- user activity: learning progress necessary for the extension's single purpose.

The extension does NOT use data for:
- personalized advertising;
- sale to data brokers or third parties;
- creditworthiness or lending;
- unrelated analytics.

## Reviewer notes

1. Install the extension.
2. Open the popup. Before pairing it shows NOT PAIRED.
3. Choose Connect Companion.
4. Sign in to the provided trusted-test StudyOS account if necessary.
5. Click Connect Companion on /companion/connect.
6. Open a supported YouTube educational video.
7. Play for at least 30 seconds.
8. The popup shows the detected lesson/progress and Sync Health.
9. The same lesson appears in StudyOS → Learning.
10. Popup “Sync now” forces an immediate progress update.
11. Popup “Capture notes” opens the review-first /capture page.
12. Settings allow the tester to pause auto-sync, change interval, disconnect the browser and clear local recent-sync history.

No remote code is executed by the extension. All extension logic is shipped in the Manifest V3 package.
