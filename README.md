# UniEqub Workspace

This repository is organized as an implementation workspace around the fixed academic master spec.

## Structure
- `mobile/`: Bare React Native Android-first client in TypeScript.
- `supabase/`: SQL and Edge Function skeletons aligned to the fixed schema and service-layer rules.
- `Build/master_spec/`: source-of-truth technical specification.
- `Build/docs/`: original report and extracted UI reference assets.
- `Build/delivery/`: delivery tracker, implementation traceability, and execution docs.

## Current implementation status
- React Native mobile scaffold created.
- Mocked end-to-end member/admin flow implemented in-app through service contracts.
- Fixed-schema SQL scaffold created.
- Edge Function skeletons created for the critical backend workflows.
- Delivery progress spec and traceability matrix initialized.

## Commands
- `npm run mobile:start`
- `npm run mobile:android`
- `npm run mobile:test`
- `npm run mobile:typecheck`
- `npm run mobile:lint`
- `npm run mobile:apk:debug`
- `npm run qa:kyc-upload`
- `npm run qa:wallet-clearance`
- `node .\mobile\scripts\seed-final-draw.js --phone 09XXXXXXXX --name "Your Name"`

## Mobile env setup
1. Copy [mobile/.env.example](C:/dev/projects/UNI-EQUB/mobile/.env.example) to `mobile/.env`
2. Set:
   - `UNIEQUB_SUPABASE_URL`
   - `UNIEQUB_SUPABASE_ANON_KEY`
3. Restart Metro after changing the file

The tracked source no longer hardcodes the mobile Supabase URL/key pair.

## Important constraint
The database tables are fixed. Missing behavior must be implemented in Edge Functions, derived queries, storage, or provider logs rather than additional tables.
