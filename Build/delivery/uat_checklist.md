# UniEqub UAT Checklist

Last Updated: 2026-05-18

## Auth and KYC
- Register a new member account
- Receive OTP and complete registration
- Capture Front ID, Back ID, and Selfie
- Submit KYC and confirm pending state
- Approve KYC from admin workspace
- Log in again with phone number and password after approval

## Group lifecycle
- Create a new group request as a verified member
- Review pending group in admin workspace
- Approve the group and verify `Virtual_Acc_Ref`
- Join the active group from another verified member
- Freeze an active group and confirm contribution blocking

## Contributions and draw
- Open the seeded final-draw scenario
- Complete the final USSD contribution
- Confirm automatic draw trigger
- Confirm pending payout creation
- Confirm group cycle completion when every member has already won once

## Wallet clearance
- Open wallet after automatic draw
- Confirm pending payout amount
- Execute wallet clearance
- Confirm pending payout count becomes zero
- Confirm payout moves to successful history

## Notifications and reminders
- Confirm contribution-due notification appears when the current round is unpaid
- Confirm contribution-recorded notification appears after payment
- Confirm payout-ready notification appears after automatic draw
- Mark all notifications as read
- Run reminder batch from admin workspace

## Reports
- Load admin overview
- Load report list
- Export CSV report
- Export PDF report
- Confirm PDF payload begins with `%PDF-`

## Release checks
- Build debug APK
- Install on Android device or emulator
- Run basic smoke pass on splash, auth, dashboard, group, payment, wallet, admin

## Phase 2 UAT planning note
Phase 2 UAT scenarios, user-only validation tasks, required evidence files, and final delivery gates are tracked in `Build/delivery/phase2_development_progress_tracker.md`.

## Phase 2 in-app demo smoke pass
- Launch the app and tap **Try Demo Mode** on the splash screen.
- Launch Member Demo and confirm the dashboard shows the demo banner.
- Open Explore, tap Join With Code, preview `FORM-2026`, accept terms, and confirm accepted participant state.
- Create a forming group and confirm submit/start is disabled until five accepted participants are present.
- Pay the current round through direct mock payment or the USSD simulator.
- Confirm payment success, wallet, history, and notification state update.
- Log out, return to **Try Demo Mode**, and launch Admin Demo.
- Confirm admin dashboard shows the demo banner.
- Open group review and confirm the seeded Phase 2 formation request is available for approval.
- Open reports and confirm export actions remain accessible.

For a demo of completed Phase 2 features, use:

- `Build/delivery/demo/phase2_completed_features_demo.md`
- `Build/delivery/demo/phase2_demo_operator_checklist.md`
- `npm run qa:phase2-demo-readiness`
- `npm run qa:phase2-in-app-demo`
- `npm run qa:direct-login`

The checklist above remains valid for the original MVP baseline. The Phase 2 demo runbook narrows the presentation to implemented features and explicitly calls out unfinished notification/audit, freeze/poll/refund, release, screenshot, and UAT evidence work.
