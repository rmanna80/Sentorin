# Owner app (Expo, iPhone + Android)

    npm install
    npx expo install --fix      # aligns library versions with the Expo SDK
    npx expo run:android        # or run:ios  (Bluetooth needs a development build, not Expo Go)

Screens: sign in / create account, device list, add a device with the code from the box,
pen (find by Bluetooth signal, last seen, mark lost, business card editor),
bracelet (emergency profile, per-field "show without sign-in", list of responder views).

Status: passes TypeScript checks and bundles for Android; **not yet run on a phone**.
