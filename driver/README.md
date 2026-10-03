# Romana Driver

Expo and React Native app for driver assignments and proof of delivery. Restricted
driver accounts can sign in through Supabase Auth, review pending stops, capture the
client's signature, record the amount and payment method collected from each client,
and mark an assigned in-transit order as delivered. The app saves those payment details
with the device coordinates, signature, and server-side delivery time. End-of-trip
reconciliation handles failed stops and returned inventory without re-entering payments.

## Setup

```bash
cp driver/.env.example driver/.env
npm install --prefix driver
```

Set the three public Expo variables in `driver/.env`. The Supabase value must be a
publishable key, never a secret or service-role key. For a physical phone,
`EXPO_PUBLIC_API_URL` must use the development computer's LAN address. Android
emulators can normally use `http://10.0.2.2:4322`; iOS simulators can use
`http://127.0.0.1:4322`.

Start the backend and app in separate terminals from the repository root:

```bash
npm run dev:backend
npm run dev:driver
```

Scan the QR code with Expo Go or press `a`/`i` for an Android/iOS simulator. Create
and assign a driver account from the admin portal before signing in. Location access
is requested only when the driver submits a signed delivery and is required to save
that proof of delivery.

To run the browser version, use `npm --prefix driver run web`. The backend permits
`http://localhost:8081` by default; set `DRIVER_ORIGIN` when Expo or the deployed web
app uses a different origin.

## Verification

```bash
npm --prefix driver run check
npm --prefix driver run build
```
