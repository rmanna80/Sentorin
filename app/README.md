# Owner app (Expo, iPhone + Android)

    npm install
    npx expo install --fix      # aligns library versions with the Expo SDK
    npx expo run:android        # or run:ios  (Bluetooth needs a development build, not Expo Go)

Tabs
- **My devices** (sign-in): add a device with the code from the box; pen (find by Bluetooth signal, last seen,
  mark lost, business card editor); bracelet (emergency profile, per-field "show without sign-in", responder views).
- **Received** (no account needed): scan a pen or paste its link; received cards are kept on the phone.
- **Responder** (sign-in + authenticator code): scan a bracelet or enter its ID to open the emergency profile. Every view is logged.
- **Settings**: light (default) or dark appearance; account.

Status: passes TypeScript checks and bundles for Android; **not yet run on a phone**.
