# Sentorin

One platform for NFC/Bluetooth devices:

- **Pen** — tap to open the owner's business card; Bluetooth finding (BC832 / nRF52832).
- **Emergency bracelet** — tap opens an emergency page; full details only for verified responders, every view logged.

| Folder | Contents | Status |
|---|---|---|
| `hardware/pen-pcb` | KiCad project, revision 0.3 candidate | Not released for fabrication (see its README) |
| `backend/supabase` | Database schema, access rules, tests | Deployed to Supabase project `smartpen`; access tests pass there |
| `web/` | Tap pages (business card, emergency) | Not started |
| `app/` | Owner app, iPhone + Android | Not started |
| `firmware/` | Pen firmware | Not started |

## Backend tests

`backend/supabase/tests/local_auth_stub.sql` stands in for Supabase's auth schema on a plain Postgres.
Load the stub, then the migration, then run `access_rules_test.sql`.
