# UniEqub Living Technical Spec

Version: v1  
Status: Working source of truth  
Purpose: A lean but complete technical specification for building the UniEqub Android MVP without having to reopen the full academic report.

---

## 1. Product Summary

UniEqub is an Android-first digital Equb platform for university students. It digitizes group savings cycles by supporting member registration, KYC review, group creation and approval, group joining, round-based contributions, automated winner selection, payout withdrawal, reminders, and admin reporting.

The implementation target is a student-project MVP with production-like architecture, but with a scope conservative enough to defend academically and implement reliably.

---

## 2. Scope and Boundaries

### In Scope
- Android mobile client
- User registration and login
- KYC upload and admin review
- Role-based access for Member and Admin
- Equb creation request and admin approval
- Group joining and membership tracking
- Round lifecycle management
- Contribution payment tracking
- Automated draw and winner recording
- Payout withdrawal flow
- Push/SMS reminders and winner announcements
- Transaction history
- Admin oversight and report export

### Out of Scope for MVP
- Public multi-campus rollout
- iOS support
- Full web app
- Full bank-grade compliance program
- Rich dispute workflow with dedicated dispute tables
- Dedicated penalty subsystem unless added later as an explicit extension

### Academic Scope Constraint
The project is presented as an academic MVP. Real payment integration may use Chapa sandbox or a mocked local USSD/payment workflow if sandbox access is unavailable.

---

## 3. Source-of-Truth Rules

This document is the implementation source of truth.

### Priority Order
1. This spec
2. Actual fixed database schema
3. Submitted project document
4. Original UML/class/use case diagrams

### Critical Rule
The database tables are fixed and may not be changed. Missing behavior must be implemented in code, service logic, derived queries, validation rules, or external/provider logs.

---

## 4. Technology Stack

### Client
- React Native
- Android-first delivery
- Android Studio for emulator testing

### Backend / Data
- Supabase
- PostgreSQL
- Token-based auth/session handling

### Integrations
- Chapa sandbox or equivalent payment gateway path
- Telebirr / banking / mocked USSD simulation depending environment
- SMS / Push notification provider

### Development Environment
- Windows 10/11
- VS Code
- Android Studio emulator

---

## 5. High-Level Architecture

UniEqub follows a client-server architecture with three logical layers.

### Presentation Layer
Runs on Android device.
Responsibilities:
- forms and input validation
- navigation
- dashboard rendering
- history views
- notification display
- offline cache of recent safe-to-read state

### Business Services Layer
Runs in backend/app logic.
Responsibilities:
- auth and registration flow
- KYC gating
- group creation approval flow
- membership rules
- round opening / locking / completion
- webhook reconciliation
- winner selection logic
- payout creation and withdrawal flow
- report generation
- reminder scheduling

### Data Layer
Runs in Supabase/PostgreSQL.
Responsibilities:
- persistent storage
- relational integrity
- status tracking
- query support for dashboard/history/reporting

### External Gateway Layer
Responsibilities:
- receives or simulates money transfer flow
- returns payment status
- sends webhook for payment confirmation

---

## 6. Core Runtime Processes

### 6.1 Authentication and Session Process
- User registers with full name, phone number, password, and student ID image.
- OTP may be used for verification, but OTP state is service-layer logic rather than a required DB table.
- Password is hashed before storage.
- Login authenticates by phone number and password.
- Auth session/token is issued after successful login.
- Banned accounts cannot log in.

### 6.2 KYC Process
- New members are created with `KYC_Status = Unverified`.
- Admin reviews uploaded student ID image.
- Admin sets status to `Verified` or leaves user `Unverified`.
- Admin can set user to `Banned`.

### 6.3 Group Creation and Approval Process
- Verified member submits new Equb request.
- Group is created in `Pending` state.
- Admin reviews request.
- If approved, group becomes `Active`.
- If not approved, group stays `Pending` and is not published.

### 6.4 Contribution Reconciliation Process
- Member chooses to pay contribution for current round.
- System presents supported provider flow or group payment instructions.
- Payment provider returns callback/webhook.
- Backend verifies payload.
- Sender phone is normalized where needed, including `+251 -> 09`.
- Backend matches sender phone against current group members.
- Successful contribution is recorded as transaction.
- Member is considered paid for current round by derived rule.

### 6.5 Automated Draw Process
- System monitors round payment completion.
- When successful contributions for round equal active memberships in group, system locks round.
- Eligible members are members who paid current round and have not already won in this Equb cycle.
- RNG selects winner.
- Winner is stored in round.
- Payout transaction is created in `Pending` state.
- Notifications are sent.
- Round is completed.

### 6.6 Payout Withdrawal Process
- Winner opens withdraw screen.
- System locates winner's pending payout transaction.
- Winner confirms payout destination flow.
- Gateway processes payout.
- Same payout transaction is updated to `Successful` on completion, or left `Pending` / marked `Failed` on failure.

### 6.7 Reminder Process
- System scans active groups and open rounds.
- Unpaid members are derived from active memberships minus successful contribution transactions.
- Reminder is sent through Push/SMS.
- Delivery attempts are logged in application/provider logs.

---

## 7. Immutable Persistence Model

This section reflects the actual database schema that must not be modified.

### 7.1 User
Fields:
- `User_ID : UUID` (PK)
- `Full_Name : varchar(100)`
- `Phone_Number : varchar(15)` unique
- `Password_Hash : varchar(255)`
- `Student_ID_Img : text`
- `KYC_Status : varchar(20)`
- `Role : varchar(10)`
- `Created_At : timestamp`

Meaning:
- Stores both Members and Admins.
- `Role` is the discriminator.

### 7.2 EqubGroup
Fields:
- `Group_ID : UUID` (PK)
- `Creator_ID : UUID` (FK -> User)
- `Group_Name : varchar(50)`
- `Amount : decimal(10,2)`
- `Max_Members : integer`
- `Frequency : varchar(20)`
- `Virtual_Acc_Ref : varchar(50)`
- `Status : varchar(20)`
- `Start_Date : date`

Meaning:
- Stores group setup and lifecycle state.

### 7.3 GroupMembers / Membership
Fields:
- `Membership_ID : UUID` (PK)
- `Group_ID : UUID` (FK -> EqubGroup)
- `User_ID : UUID` (FK -> User)
- `Joined_At : timestamp`
- `Status : varchar(20)`

Meaning:
- Resolves many-to-many membership between users and groups.

### 7.4 Round
Fields:
- `Round_ID : UUID` (PK)
- `Group_ID : UUID` (FK -> EqubGroup)
- `Round_Number : integer`
- `Winner_ID : UUID` (FK -> User, nullable)
- `Draw_Date : timestamp`
- `Status : varchar(20)`

Meaning:
- Stores one cycle/round inside a group.

### 7.5 Transaction
Fields:
- `Trans_ID : UUID` (PK)
- `User_ID : UUID` (FK -> User)
- `Round_ID : UUID` (FK -> Round)
- `Amount : decimal(10,2)`
- `Type : varchar(20)`
- `Payment_Method : varchar(30)`
- `Gateway_Ref : varchar(100)`
- `Status : varchar(20)`
- `Date : timestamp`

Meaning:
- Stores both contributions and payouts.

---

## 8. Domain Model (Code-Level)

The database is the persistence truth. The code-level domain model may expose richer classes and services.

### 8.1 User
Attributes:
- userId
- fullName
- phoneNumber
- passwordHash
- studentIdImg
- kycStatus
- role
- createdAt

Methods:
- isVerified()
- isBanned()
- updateProfile()

### 8.2 Member
Conceptual specialization of User where `role = Member`.

Methods:
- register()
- joinGroup()
- viewHistory()
- requestWithdrawal()

### 8.3 Admin
Conceptual specialization of User where `role = Admin`.

Methods:
- verifyUser()
- banUser()
- approveGroup()
- freezeGroup()
- closeGroup()
- generateAuditReport()

### 8.4 EqubGroup
Attributes:
- groupId
- creatorId
- groupName
- amount
- maxMembers
- frequency
- virtualAccRef
- status
- startDate

Methods:
- activate()
- freeze()
- complete()
- hasOpenSlots()
- getAvailableSlots()
- createRound()

### 8.5 Membership
Attributes:
- membershipId
- groupId
- userId
- joinedAt
- status

Methods:
- isActive()
- remove()

### 8.6 Round
Attributes:
- roundId
- groupId
- roundNumber
- winnerId
- drawDate
- status

Methods:
- isOpen()
- isReadyForDraw()
- getEligibleMembers()
- selectWinner()
- lock()
- complete()

### 8.7 Transaction
Attributes:
- transId
- userId
- roundId
- amount
- type
- paymentMethod
- gatewayRef
- status
- date

Methods:
- isContribution()
- isPayout()
- markSuccessful()
- markFailed()

### 8.8 AuthService
Responsibilities:
- register member
- password hashing/verification
- OTP verification
- session/token issuance
- password recovery
- account lockout policy

### 8.9 PaymentService
Responsibilities:
- initiate contribution flow
- verify webhook signature
- normalize sender phone
- match payment to member
- create/update contribution transaction
- create/update payout transaction

### 8.10 DrawService
Responsibilities:
- compute readiness
- lock round
- select winner
- create pending payout transaction
- open next round when applicable

### 8.11 NotificationService
Responsibilities:
- push notifications
- SMS notifications
- reminders
- winner announcement
- admin alerts

### 8.12 ReportService
Responsibilities:
- generate CSV/PDF
- aggregate users/groups/memberships/rounds/transactions
- provide admin export outputs

---

## 9. Enumerations and Allowed Values

These values are part of implementation truth unless deliberately versioned later.

### 9.1 UserRole
- `Member`
- `Admin`

### 9.2 KYCStatus
- `Unverified`
- `Verified`
- `Banned`

### 9.3 GroupStatus
- `Pending`
- `Active`
- `Frozen`
- `Completed`

Note: `Rejected` is not a persisted DB status. Non-approved groups remain `Pending` and unpublished.

### 9.4 MembershipStatus
- `Active`
- `Removed`

### 9.5 RoundStatus
- `Open`
- `Locked`
- `Completed`

### 9.6 TransactionType
- `Contribution`
- `Payout`

### 9.7 PaymentMethod
- `Telebirr`
- `CBE`
- `Chapa`
- `MockUSSD` (application-level testing value)

### 9.8 PaymentStatus
- `Pending`
- `Successful`
- `Failed`

### 9.9 Frequency
- `Weekly`
- `Bi-weekly`
- `Monthly`

---

## 10. Core Relationships

- One `User` may create many `EqubGroup` records.
- One `User` may hold many `Membership` records.
- One `EqubGroup` has many `Membership` records.
- One `EqubGroup` has many `Round` records.
- One `Round` may reference one winner through `Winner_ID`.
- One `User` may have many `Transaction` records.
- One `Round` has many `Transaction` records.
- `Membership` resolves many-to-many participation between users and groups.

---

## 11. Derived Business Rules

These rules are critical because the fixed database does not store every concept explicitly.

### 11.1 Paid Rule
A member is considered paid for a round iff a transaction exists where:
- `Transaction.User_ID = member.User_ID`
- `Transaction.Round_ID = round.Round_ID`
- `Transaction.Type = Contribution`
- `Transaction.Status = Successful`

### 11.2 Open Slots Rule
`availableSlots = EqubGroup.Max_Members - count(active memberships)`

### 11.3 Membership Uniqueness Rule
A user may not have more than one active membership in the same group.

### 11.4 Contribution Uniqueness Rule
A user may not have more than one successful contribution for the same round.

### 11.5 Draw Readiness Rule
A round is ready for draw iff:
`count(successful contributions for round) == count(active memberships in group)`

### 11.6 Eligibility Rule
Eligible draw participants are active group members who:
- have a successful contribution for the current round
- have not already won in earlier rounds of the same Equb cycle

### 11.7 Payout Creation Rule
When draw is finalized:
- create a `Transaction` with `Type = Payout`
- `Status = Pending`
- `User_ID = Winner_ID`
- `Round_ID = current round`

### 11.8 Group Visibility Rule
Only groups with `Status = Active` are browsable/joinable by members.

### 11.9 Approval Rule
New groups are created as `Pending` and require Admin approval before activation.

### 11.10 Banned Rule
Users with `KYC_Status = Banned` cannot log in or participate in new activity.

### 11.11 KYC Rule
Only `Verified` members may create or join groups, and withdrawal may require identity confirmation.

### 11.12 Virtual Account Lifecycle Rule
Each group may have one virtual account reference that remains active for the group lifecycle and is deactivated when the cycle is completed or dissolved.

---

## 12. Corrected Use Cases

These use cases are the implementation versions, corrected to fit the immutable DB.

### SUC-001 RegisterMember
Actors:
- Member
- System

Preconditions:
- app installed
- valid phone number
- student ID image available

Happy Path:
1. user opens Sign Up
2. enters full name, phone number, password
3. uploads student ID image
4. system validates format and uniqueness of phone number
5. system sends OTP if enabled
6. user verifies OTP
7. system creates `User` with `Role = Member` and `KYC_Status = Unverified`
8. system redirects to login

Alternatives:
- invalid data
- duplicate phone number
- OTP failed/expired

Postcondition:
- new user account exists

### SUC-002 LoginMember
Happy Path:
1. user enters phone and password
2. system verifies password hash
3. system confirms not banned
4. system issues session/token
5. dashboard loads

Alternatives:
- invalid credentials
- banned account
- temporary lockout after repeated failures

Postcondition:
- authenticated session exists

### SUC-003 CreateEqub
Preconditions:
- user logged in
- `KYC_Status = Verified`
- not banned
- not above active-group limit

Happy Path:
1. member fills group form
2. system validates amount/frequency/member limits/start date
3. system creates `EqubGroup` in `Pending`
4. admin is notified
5. admin approves
6. system sets group `Status = Active`
7. system assigns/creates `Virtual_Acc_Ref` if enabled

Alternatives:
- admin does not approve -> group remains `Pending`
- creation limit reached

Postcondition:
- group exists; if approved it is active and joinable

### SUC-004 JoinEqub
Preconditions:
- group `Active`
- member `Verified`
- open slot exists

Happy Path:
1. member browses groups
2. selects active group
3. clicks join
4. system checks capacity and duplicate membership
5. system creates `Membership(Status = Active)`

Alternatives:
- group full
- already joined
- user not verified

Postcondition:
- active membership exists

### SUC-005 ContributePayment
Preconditions:
- group `Active`
- current round `Open`
- active membership exists
- no prior successful contribution for same round

Happy Path:
1. member selects Pay Contribution
2. system identifies current round and amount
3. member uses payment method / virtual account flow
4. gateway/provider confirms payment
5. backend verifies callback/webhook
6. backend normalizes sender phone if needed
7. backend matches member and round
8. system records successful contribution transaction

Alternatives:
- failed gateway result
- duplicate payment attempt
- unmatched sender phone -> reconciliation failure queue/application log

Postcondition:
- successful contribution exists for round

### SUC-006 ViewEqubStatus
Happy Path:
1. member opens My Equbs
2. selects group
3. system loads group, current round, active memberships, successful contributions, winner history
4. system shows progress bar, paid members, round number, next expected draw timing, prior winners

Postcondition:
- no data changed

### SUC-007 ProcessAutomatedDraw
Trigger:
- successful contributions count equals active member count

Happy Path:
1. system locks round
2. computes eligible members
3. executes RNG
4. stores `Winner_ID`
5. creates pending payout transaction
6. marks round completed
7. sends winner announcement

Alternatives:
- incomplete contributions -> reminders sent, round remains open

Postcondition:
- winner recorded and payout transaction pending

### SUC-008 ViewPaymentHistory
Happy Path:
1. member opens history
2. system loads transactions by user id
3. user filters by date/group/type if needed
4. paginated results display

Alternatives:
- no history
- retrieval failure

Postcondition:
- no data changed

### SUC-009 ManageMembers
Happy Path:
1. admin opens member management
2. system lists target members
3. admin reviews uploaded student ID image
4. admin sets verified or banned status as needed
5. user is notified
6. action is logged in application/server logs

Alternatives:
- KYC not accepted -> keep/reset `Unverified`

Postcondition:
- user status updated

### SUC-010 OverseeEqubCompliance
Happy Path:
1. admin opens active groups
2. reviews current status, round progress, transaction trends, winner history
3. exits or takes action

Alternatives:
- freeze group -> `Status = Frozen`
- administratively close group -> `Status = Completed`

Restriction:
- admin cannot manually transfer group funds for personal use

Postcondition:
- group remains unchanged, frozen, or completed

### SUC-011 SendReminderNotification
Happy Path:
1. scheduler scans active groups/open rounds
2. system derives unpaid members
3. reminder is sent through push/SMS
4. delivery attempt is logged

Postcondition:
- unpaid members notified

### SUC-012 WithdrawPayout
Preconditions:
- pending payout transaction exists for user
- user logged in and not banned

Happy Path:
1. winner opens withdraw funds
2. system shows pending payout amount and context
3. winner confirms withdrawal destination flow
4. system calls payout gateway/service
5. on success, same payout transaction becomes `Successful`

Alternatives:
- gateway failure -> remain `Pending` or move to `Failed`

Postcondition:
- payout settled or waiting retry

### SUC-013 GenerateAuditReport
Happy Path:
1. admin chooses report type/date range
2. system aggregates users/groups/memberships/rounds/transactions and relevant logs
3. system generates CSV/PDF
4. admin downloads file

Alternatives:
- no matching data
- generation failure

Postcondition:
- downloadable report produced

---

## 13. UI / Screen Inventory

### Public / Auth
- Splash
- Onboarding
- Login
- Register
- OTP Verification
- Forgot Password / Recovery

### Member
- Home / Dashboard
- Browse Equbs
- Equb Details
- Create Equb
- My Equbs
- Round Status View
- Payment Flow / Pay Contribution
- Payment History
- Withdraw Funds
- Notifications
- Profile / Settings

### Admin
- Admin Dashboard
- Pending Groups Review
- Member Management / KYC Review
- Active Group Oversight
- Report Export

---

## 14. Suggested Backend Module Boundaries

### auth
- register member
- verify OTP
- login
- logout
- password recovery
- lockout policy

### users
- profile read/update
- KYC status update
- role checks

### groups
- create group request
- approve/freeze/complete group
- browse active groups
- group details

### memberships
- join group
- list group members
- enforce duplicate prevention

### rounds
- current round lookup
- winner history
- round status updates

### payments
- initiate contribution
- webhook verify/reconcile
- create/update transactions
- payout withdrawal

### draw
- readiness check
- eligible member computation
- RNG winner selection
- payout preparation

### notifications
- push/SMS senders
- reminder scheduling
- winner broadcast

### reports
- aggregate admin reports
- export CSV/PDF

---

## 15. API-Level Expectations

This spec does not lock endpoint names, but the backend must expose capabilities for:
- register
- login
- logout
- current user/profile
- upload ID image
- browse active groups
- create group request
- approve/freeze/complete group
- join group
- get my groups
- get group detail with round status
- contribute payment initiation
- payment webhook
- get payment history
- withdraw payout
- admin member management
- generate reports

---

## 16. Security Requirements

### Required
- password hashing with bcrypt/Argon2-level approach
- HTTPS for all client-server traffic
- token-based auth
- RBAC based on `Role`
- KYC gating before create/join/withdraw actions as defined by business rules
- immutable confirmed transaction records in business logic
- audit logging for admin actions and draw outputs

### Practical MVP Interpretation
Because the DB is fixed and minimal, audit logging may be implemented in:
- backend logs
- structured application logs
- Supabase logs
- provider logs

It does not need a dedicated DB table in v1.

---

## 17. Performance and Reliability Requirements

- must work acceptably on low-bandwidth networks
- should support local cached read-only state for key screens
- must prevent oversubscription when multiple users join concurrently
- must prevent duplicate successful contribution for same round/user
- should retry transient third-party notification/payment failures when safe
- should remain Android-device friendly with low storage footprint

---

## 18. Testing Strategy

### Unit Tests
- auth validation
- business rule checks
- status transitions
- eligibility calculations
- draw logic

### Integration Tests
- user -> group -> membership flow
- contribution webhook reconciliation
- draw and payout creation
- report generation

### System Tests
- full member lifecycle
- admin review lifecycle
- group lifecycle
- round completion lifecycle

### Specialized Tests
- Chapa sandbox if available
- mocked payment/USSD pipeline if sandbox unavailable

### Deployment Testing Path
- emulator
- alpha APK internal team testing
- beta APK selected users
- final APK submission

---

## 19. Data Integrity Rules

These are non-negotiable.

- phone number must be unique per user
- foreign keys must always resolve
- confirmed transactions must not be silently edited into a different business meaning
- winner must belong to group membership set for the round
- payout must reference a round with a winner
- draw must never run before payment completion rule is satisfied
- active membership count must never exceed max members

---

## 20. Known Schema Gaps and Official Workarounds

### No `Rejected` group status
Workaround:
- non-approved groups remain `Pending` and hidden

### No `Suspended` user status
Workaround:
- use `Banned`

### No OTP table
Workaround:
- service-layer or provider-based OTP state

### No session table
Workaround:
- token/session handled in auth layer

### No audit table
Workaround:
- application/server/provider logs

### No notification log table
Workaround:
- provider logs or backend structured logs

### No dedicated contribution/payout tables
Workaround:
- use `Transaction.Type`

### No dedicated report table
Workaround:
- generate on demand from live data

### No dedicated payout destination field
Workaround:
- use registered phone number flow or gateway-side destination confirmation in service layer

---

## 21. State Transitions

### User KYC Status
- `Unverified -> Verified`
- `Unverified -> Banned`
- `Verified -> Banned`

### Group Status
- `Pending -> Active`
- `Pending -> Pending` (not approved yet)
- `Active -> Frozen`
- `Active -> Completed`
- `Frozen -> Active` (optional admin restore)
- `Frozen -> Completed`

### Round Status
- `Open -> Locked -> Completed`

### Transaction Status
- `Pending -> Successful`
- `Pending -> Failed`

---

## 22. MVP Delivery Checklist

### Must Ship
- registration/login
- KYC upload and admin verify
- create/join active group
- group browsing
- current round status
- contribution tracking
- automated draw
- payout withdrawal
- reminders
- payment history
- admin reporting basic export

### Nice to Have
- password recovery polish
- richer local caching
- admin restore for frozen groups
- advanced analytics dashboards
- polished provider retry dashboards

---

## 23. Immediate Implementation Notes

### Auth
- use phone number as primary login identity
- do not depend on university email in persistence model
- student identity proof is uploaded image, not separate ID-number DB column unless captured only in UI metadata

### Payment
- prefer designing around webhook confirmation rather than trusting client-side success screens
- normalize phone numbers consistently before matching
- preserve gateway reference for auditability

### Draw
- store deterministic draw artifacts in logs if possible, especially seed/result metadata
- keep draw service isolated and testable

### Reporting
- reports should be generated from transactional truth, not cached summaries

### Admin
- admin actions should be explicit and logged
- admin must not directly alter already confirmed transaction meaning

---

## 24. Open Decisions to Revisit in Later Versions

- whether payout destination will remain only phone-number based or gain explicit linked-account storage
- whether a dedicated audit table will be added later
- whether penalties/disputes need first-class modeling
- whether multi-campus support will be introduced
- whether web support will be added

---

## 25. Final Build Philosophy

Build the MVP around a small number of strong truths:
- one user table with role-based behavior
- one transaction table for both contributions and payouts
- one membership table for participation
- one round table for draw and winner state
- service-layer logic for everything the fixed DB cannot express directly

If a choice conflicts with the old diagrams but matches the fixed schema and this spec, follow this spec.



---

## 26. Detailed Access Control and UX Gating Rules

This section resolves the important question of what an account can do while KYC is still pending.

### 26.1 Account Access Modes

UniEqub supports three practical account modes derived from `KYC_Status` and `Role`.

#### A. Pending KYC Member
Definition:
- `Role = Member`
- `KYC_Status = Unverified`

Allowed:
- log in
- access dashboard
- view profile/settings
- upload or re-upload student ID image
- browse/view public active groups in read-only mode if product UX allows it
- view notifications
- view personal transaction history if any exists
- receive KYC status updates and reminders
- log out

Blocked:
- create Equb
- join Equb
- contribute to an Equb
- withdraw payout
- participate in member-only financial workflows

UI Behavior:
- dashboard is accessible
- a persistent status banner is shown: `KYC Pending Verification`
- create/join/pay/withdraw buttons are disabled or hidden
- a primary CTA should exist: `Complete / Re-upload Verification`

Rationale:
- registration and login create an account and dashboard access
- admin verification grants full access to start/join Equbs
- create/join actions explicitly require verified KYC

#### B. Verified Member
Definition:
- `Role = Member`
- `KYC_Status = Verified`

Allowed:
- all pending-KYC safe actions
- create Equb
- join active Equb
- contribute payment
- withdraw payout
- access all member financial features

#### C. Banned Member
Definition:
- `Role = Member`
- `KYC_Status = Banned`

Allowed:
- no normal account access

Blocked:
- login
- all member activity

System Behavior:
- login is denied
- existing sessions should be revoked on status change where possible

#### D. Admin
Definition:
- `Role = Admin`

Allowed:
- admin dashboard access
- member review and KYC actions
- group approval/freeze/close
- report generation

---

### 26.2 Recommended Screen-by-Screen Gating Matrix

#### Guest (not logged in)
- Can access: splash, onboarding, login, register, forgot password
- Cannot access: dashboard, groups, history, payments, withdrawals, admin

#### Member with `Unverified` KYC
- Can access:
  - dashboard
  - profile/settings
  - KYC upload/re-upload screen
  - notifications
  - read-only browse/view group catalog if enabled
- Cannot access:
  - create group
  - join group
  - pay contribution
  - withdraw payout
  - any admin screen

#### Member with `Verified` KYC
- Can access all member screens
- Cannot access admin screens

#### Member with `Banned` KYC
- Cannot access authenticated app after login attempt

#### Admin
- Can access admin screens and standard account screens as required by design
- Should not use member financial screens for ordinary participation unless the product explicitly allows dual-role behavior

---

### 26.3 Recommended Pending-KYC UX Copy

Suggested system messages:
- `Your account is created, but your identity is still under review.`
- `You can explore the app, but creating or joining an Equb is locked until KYC verification is complete.`
- `Please upload a clear student ID image to speed up verification.`

---

## 27. Detailed Validation Rules

These rules should be enforced at service layer and reflected in client-side validation where safe.

### 27.1 Registration Validation
- `Full_Name` required, trimmed, reasonable length
- `Phone_Number` required, unique, normalized before comparison
- `Password` required, must meet minimum complexity rules
- `Student_ID_Img` required for final registration completion unless a two-step draft registration flow is introduced

### 27.2 Login Validation
- phone required
- password required
- repeated failures should trigger temporary lockout or throttling

### 27.3 Group Creation Validation
- creator must be `Verified`
- group name required
- amount must be positive and within platform-defined limits
- frequency must be one of allowed enum values
- max members must be greater than 1 and within platform-defined limits
- start date cannot be invalid or clearly in the past unless product policy explicitly allows it

### 27.4 Join Validation
- group must be `Active`
- membership count must be below `Max_Members`
- user must not already have active membership in group
- user must be `Verified`
- user must not be `Banned`

### 27.5 Contribution Validation
- round must be `Open`
- user must be active member of the group attached to round
- payment amount must match expected amount unless partial-payment policy is intentionally introduced later
- successful duplicate contribution for same user and round must be blocked

### 27.6 Withdrawal Validation
- user must be the owner of the pending payout transaction
- payout transaction must be `Type = Payout`
- payout transaction status must allow execution (`Pending`)
- user must not be `Banned`

---

## 28. Phone Number Normalization and Identity Matching

Phone number normalization must be centralized and deterministic.

### 28.1 Canonical Internal Format
Recommended canonical format for local persistence and comparison:
- Ethiopian local style beginning with `09...`

### 28.2 Input Normalization Rules
Examples:
- `+2519XXXXXXXX` -> `09XXXXXXXX`
- `2519XXXXXXXX` -> `09XXXXXXXX`
- `9XXXXXXXX` -> `09XXXXXXXX` if length/pattern is valid
- whitespace and separators should be stripped before normalization

### 28.3 Usage Points
Normalization must run before:
- registration uniqueness checks
- login lookup where applicable
- webhook sender matching
- payout destination confirmation if tied to registered phone number

### 28.4 Error Handling
If a payment arrives and the sender phone cannot be matched after normalization:
- do not create a successful contribution blindly
- record reconciliation failure in application logs
- optionally create a `Pending` internal reconciliation event in service logic
- notify admin if manual follow-up is required

---

## 29. Detailed Payment and Reconciliation Flow

### 29.1 Contribution Creation Path
Preferred truth source:
- the backend webhook/provider callback, not the mobile client success screen

Recommended sequence:
1. member initiates payment from app
2. provider/virtual account flow is shown
3. provider sends callback/webhook
4. backend verifies authenticity
5. backend identifies target group and current open round
6. backend normalizes sender phone
7. backend matches sender against active memberships in the group
8. backend checks duplicate-success constraint
9. backend creates or updates `Transaction(Type = Contribution)`
10. backend updates any derived round readiness state

### 29.2 Contribution Transaction Rules
- `Pending` may be used when provider result is not final
- `Successful` means the contribution counts toward draw readiness
- `Failed` means it does not count toward draw readiness

### 29.3 Payout Creation Path
Immediately after winner selection:
- create payout transaction with:
  - winner user id
  - round id
  - payout amount
  - type `Payout`
  - status `Pending`

### 29.4 Withdrawal Execution Path
1. winner confirms withdrawal
2. payout gateway/provider executes transfer
3. same payout transaction is updated with gateway ref and final status
4. success notification is shown

### 29.5 Double-Spend / Duplicate Prevention
The system must prevent:
- two successful contributions for same user + round
- two successful payout executions for same payout transaction
- multiple winner assignments for same round

---

## 30. Detailed Round Lifecycle Rules

### 30.1 Round Creation
At group activation or cycle setup time:
- at least the first round should exist, or the backend must be able to lazily create it before first contribution

### 30.2 Round Open State
When `Status = Open`:
- contributions are allowed
- draw is not yet finalized
- winner is not yet fixed

### 30.3 Round Locked State
When `Status = Locked`:
- no new contribution should be accepted into normal successful flow for that round
- draw processing is ongoing or finalized but not fully committed

### 30.4 Round Completed State
When `Status = Completed`:
- winner is known
- payout transaction should already exist or be derivable as required implementation truth
- group may advance to next round if cycle continues

### 30.5 Next Round Opening Rule
If the Equb cycle is not complete:
- after current round completion, backend may create/open next round according to business policy

### 30.6 Cycle Completion Rule
When every participating member has already won once, the cycle may be considered complete and the group may transition toward `Completed`.

---

## 31. Concurrency and Race-Condition Controls

These controls are essential in implementation even if not visible in UML.

### 31.1 Join Race Condition
If two users try to join the final available slot at the same time:
- backend must perform authoritative count check at write time
- only one join should succeed when capacity boundary is reached

### 31.2 Contribution Duplication Race Condition
If webhook retries or duplicate callbacks occur:
- backend should use gateway reference and user+round uniqueness logic to avoid duplicate successful contributions

### 31.3 Draw Trigger Race Condition
If multiple workers/processes detect readiness simultaneously:
- only one process may lock and finalize the round
- locking must happen before winner write/finalization

### 31.4 Withdrawal Retry Race Condition
If user retries withdrawal during uncertain network state:
- same payout transaction must not be finalized twice
- provider reference and final status reconciliation should be authoritative

---

## 32. Error States and User-Facing Behavior

### 32.1 Pending KYC
- show non-blocking dashboard access
- block financial actions with explanation

### 32.2 Network Failure
- show retryable error
- preserve unsaved user input where practical

### 32.3 Gateway Timeout
- show `Payment status pending confirmation` instead of lying that payment failed or succeeded if final state is unknown

### 32.4 Empty States
- no groups available
- no transactions yet
- no pending payouts
- no notifications

### 32.5 Administrative Closure
If a group is frozen or completed administratively:
- member-facing screens must show the group state explicitly
- pay/join/withdraw actions must follow current group policy and be disabled where required

---

## 33. Minimal Internal API Contract Sketch

This is not a locked endpoint spec, but it clarifies required request/response intent.

### Auth
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/verify-otp`
- `POST /auth/forgot-password`

### User/KYC
- `GET /me`
- `PATCH /me`
- `POST /me/student-id-image`

### Groups
- `GET /groups/active`
- `POST /groups`
- `GET /groups/{groupId}`
- `POST /groups/{groupId}/approve`
- `POST /groups/{groupId}/freeze`
- `POST /groups/{groupId}/complete`

### Memberships
- `POST /groups/{groupId}/join`
- `GET /groups/{groupId}/members`
- `GET /me/memberships`

### Rounds
- `GET /groups/{groupId}/current-round`
- `GET /groups/{groupId}/rounds`

### Payments
- `POST /groups/{groupId}/contribute`
- `POST /payments/webhook`
- `GET /me/transactions`
- `POST /payouts/{transactionId}/withdraw`

### Admin Reporting
- `GET /admin/reports`
- `POST /admin/reports/export`

---

## 34. Build-Ready Decision on KYC Access

This project should implement the following explicit rule:

### Decision
A newly registered user with `KYC_Status = Unverified` **can log in and access the platform in limited mode**, but cannot create or join Equbs until KYC is verified.

### Mandatory UI Outcome
- login succeeds for unverified user if not banned
- dashboard opens
- create/join/pay/withdraw actions are disabled or blocked with explanation
- verification status is visible
- re-upload path is available if admin requests a clearer document

### Why this is the correct implementation choice
It best matches the documented behavior that:
- login grants dashboard access to registered active users
- KYC verification grants full access to start/join Equbs
- create and join use cases explicitly require verified identity

This rule should now be treated as implementation truth unless changed in a later spec revision.

