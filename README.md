# Sentorin

One platform for NFC/Bluetooth devices:

- **Pen** — tap to open the owner's business card; Bluetooth finding (BC832 / nRF52832).
- **Emergency bracelet** — tap opens an emergency page; full details only for verified responders, every view logged.

| Folder | Contents | Status |
|---|---|---|
| `hardware/pen-pcb` | KiCad project, revision 0.3 candidate | Not released for fabrication (see its README) |
| `backend/supabase` | Database schema, access rules, tests | Deployed to Supabase project `smartpen`; access tests pass there |
| `web/` | Tap pages (business card, emergency sign-in) | Written; not yet opened in a browser or hosted |
| `app/` | Owner app, iPhone + Android (Expo) | Typechecks and bundles; not yet run on a phone |
| `firmware/` | Pen firmware v1 beacon (nRF Connect SDK) | Written; not compiled or run on hardware |

## Backend tests

`backend/supabase/tests/local_auth_stub.sql` stands in for Supabase's auth schema on a plain Postgres.
Load the stub, then the migration, then run `access_rules_test.sql`.
