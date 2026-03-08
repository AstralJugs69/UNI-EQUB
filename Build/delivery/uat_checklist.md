# UniEqub UAT Checklist

Last Updated: 2026-03-08

## Auth and KYC
- Register a new member account
- Receive OTP and complete registration
- Capture Front ID, Back ID, and Selfie
- Submit KYC and confirm pending state
- Approve KYC from admin workspace
- Log in again with OTP after approval

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
