# Savrdh Credit Resolution — Customer Mobile App

Production-oriented Expo/React Native customer application connected to the same Supabase CRM data used by Savrdh Financial Services.

## Working modules

- Email/password signup and login
- Email OTP login
- Customer profile and KYC state
- Dark black/gold and light website-matched themes
- CIBIL report dashboard
- Credit metrics and score factors
- Resolution request submission and live status
- Secure PDF/JPG/PNG document upload (private 10 MB vault)
- CRM-synced customer, case and document records
- Realtime CRM advisor chat
- Payment and receipt history
- Website/client-portal deep links

## Local setup

```bash
cd mobile
cp .env.example .env
npm install
npx expo install --fix
npm run typecheck
npx expo start
```

Use a development build for production testing. Expo SDK 57 uses React Native's New Architecture.

## Database

Apply `../supabase/migrations/20260826090000_mobile_customer_app.sql` to the existing `savrdh-credit-resolution` Supabase project. It is additive and does not change the existing website UI.

Security notes:

- The app uses only the Supabase publishable key.
- Customer data access is protected by user-owned RLS policies.
- Documents are private and stored under the authenticated user's path.
- Never place a secret/service-role key in this app.

## Release

After replacing the default Expo app icon/splash artwork with the approved Savrdh assets:

```bash
npx eas-cli build --platform android
npx eas-cli build --platform ios
```
