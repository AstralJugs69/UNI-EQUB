# KYC History Priority Decision

Date: 2026-05-19

The user promoted KYC history/submission tables into the active Phase 2 implementation wave by requesting: "continue with KYC history/submission tables if promoted: P2-601 to P2-605".

Implementation scope for this batch:

- Add `kyc_submissions` and `kyc_documents` as additive companion tables.
- Preserve canonical MVP `User.Student_ID_Img` compatibility.
- Move KYC submission/review state toward submission/document rows.
- Add durable notification and audit writes for submit, approval, resubmission request, and rejection/ban decisions.

Device UAT and sample real document evidence remain user-only follow-up tasks.
