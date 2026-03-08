# Implementation Traceability Matrix

| ID | Stage | Master Spec Source | Planned Capability | Current Repo Evidence | Current Status |
| --- | --- | --- | --- | --- | --- |
| T-01 | Stage A | Sections 3, 4, 5 | Workspace bootstrap, repo structure, tooling baseline | `mobile/`, `supabase/`, root scripts, `README.md` | Completed |
| T-02 | Stage A | Sections 3, 7 | Fixed schema captured without table expansion | `supabase/sql/001_fixed_schema.sql` | Completed |
| T-03 | Stage B | Sections 5, 6, 7 | Domain types and service contracts aligned to fixed entities | `mobile/src/types/domain.ts`, `mobile/src/services/contracts/index.ts` | Completed |
| T-04 | Stage B | Sections 6.1, 6.2 | Mirrored auth, OTP, KYC submission/review/ban behavior | `mobile/src/services/mock/mockBackend.ts`, auth screens/tests | Completed in mock |
| T-05 | Stage B | Section 6.3 | Mirrored group create request, approval, rejection, join, freeze behavior | mock backend + member/admin group screens | Completed in mock |
| T-06 | Stage B | Section 6.4 | Mirrored contribution initiation and reconciliation path, including USSD verification behavior | payment screen, mock backend payment flow, `mockBackend.test.ts` | Completed in mock |
| T-07 | Stage B | Sections 6.5, 6.6 | Mirrored automatic draw and payout creation/withdrawal | mock backend auto-draw logic, wallet/withdraw screens, tests | Completed in mock |
| T-08 | Stage B | Section 6.7 | Mirrored reminder generation and notification center behavior | notification service, reminder queue, admin reports screen | Completed in mock |
| T-09 | Stage B | Section 3.2.5 | Mirrored admin reports and export payload contract | report service and admin export UI | Completed in mock |
| T-10 | Stage C | Sections 6.1, 6.2, 7.1 | Real backend auth/token/KYC implementation | `supabase/functions/register-login/`, `supabase/functions/kyc-submit-review/`, `_shared/auth.ts`, `_shared/twilioVerify.ts`, signed KYC upload path, `mobile/src/services/live/`, `Build/delivery/evidence/kyc-upload-validation.json` | In Progress |
| T-11 | Stage D | Sections 6.3, 7.2, 7.3 | Real backend group lifecycle implementation | `supabase/functions/group-lifecycle/`, `mobile/src/services/live/liveGroupsService.ts`, hosted runtime check for create/approve/join/dashboard | In Progress |
| T-12 | Stage E | Section 6.4, 7.5 | Real backend contribution and reconciliation implementation with Android-native USSD launch | `supabase/functions/contribution-reconcile/`, `_shared/paymentProviders.ts`, `_shared/phone.ts`, `mobile/src/services/live/livePaymentsService.ts`, Android USSD launcher, hosted runtime contribution check | In Progress |
| T-12A | Stage E | Section 6.4 | Hosted provider-style USSD simulator for sandbox development, including Arkesel-compatible callback handling | `supabase/functions/ussd-simulator/`, `mobile/scripts/validate-ussd-simulator.js`, `Build/delivery/tools/ussd_simulator_harness.html` | Completed |
| T-13 | Stage F | Sections 6.5-6.7 | Real backend auto draw, payout, reminder implementation | `_shared/roundLifecycle.ts`, `contribution-reconcile`, `liveNotificationsService.ts`, seeded final-draw script | In Progress |
| T-14 | Stage G | Sections 3.2.5, 3.3 | Real admin metrics, exports, hardening, UX state completion | `report-export`, `liveReportsService.ts`, `Build/delivery/evidence/report-export-validation.json`, admin screens and docs | In Progress |
| T-15 | Stage H | Testing and deployment methodology | APK, emulator/device validation, UAT evidence | tests, startup automation | In Progress |

## Traceability rules
- `Completed in mock` means the capability exists in the mirrored mock service layer and UI flow, but not yet in live Supabase-backed runtime.
- `Completed` means the repo already satisfies the capability at the intended implementation layer.
- `Not Started` means real implementation work for that capability has not begun.
- Any contract change must be reflected in `types`, `service contracts`, `mock backend`, and the eventual Edge Function implementation to preserve parity.


