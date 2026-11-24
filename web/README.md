# Tap pages

Static site, no build step. Every tag stores one link: `https://<your-host>/?d=<public id>`.

- Pen: shows the published business card and a "Save contact" button.
- Bracelet: shows only the fields the officer marked public, then responder sign-in
  (email + password, then an authenticator-app code) before the full emergency profile.

Host the folder on any static host (GitHub Pages, Cloudflare Pages, Netlify). Serve over HTTPS.

Status: written against the deployed database functions; **not yet opened in a browser**.
