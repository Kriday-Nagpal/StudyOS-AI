# Private Beta publishing checklist

## Before uploading

- [ ] Keep the extension name ending in BETA.
- [ ] Keep “THIS EXTENSION IS FOR BETA TESTING” in the description.
- [ ] Confirm manifest version is higher than the previous uploaded build.
- [ ] Generate real PNG icons at 16, 32, 48 and 128 pixels from the StudyOS mark.
- [ ] Capture at least one screenshot of the actual Companion popup/options UI.
- [ ] Confirm the privacy policy URL is live.
- [ ] Test pairing, YouTube auto-sync, Sync Now, Capture, pause auto-sync and Disconnect.
- [ ] Do not include development-only files outside the companion package.

## Chrome Web Store Dashboard

1. Sign in to the Chrome Web Store Developer Dashboard.
2. Complete the developer account/contact-email setup if this publisher account has not been configured.
3. In Account → Management → Trusted testers, add the Google Account email addresses that should be allowed to install the Private Beta.
4. Create a new item and upload the prepared StudyOS Companion ZIP.
5. Complete Store Listing using STORE_LISTING_PRIVATE_BETA.md.
6. Upload the 128×128 store icon and at least one real screenshot.
7. In Privacy, enter the single purpose exactly and complete the data-use disclosure so it matches the extension privacy policy.
8. Set the privacy policy URL to:
   https://studyos-web-production.up.railway.app/privacy/companion
9. In Distribution, select **Private** and restrict it to the trusted testers / approved Google Group you control.
10. Submit for review.
11. After approval, open the Private Web Store listing using one of the trusted tester Google accounts and install normally with Add to Chrome.
12. On the first install, open the Companion → Connect Companion → sign in to StudyOS → Connect once.

## Important

Private visibility does not bypass Chrome, Family Link, school, or administrator restrictions. If the supervised account still requires parent/admin approval for Chrome Web Store extensions, use the normal approval flow.
