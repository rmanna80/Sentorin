// Tap page: one URL for every tag.  .../?d=<public id>
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_KEY, AUTO_SIGN_OUT_MS } from "./config.js";

// sessionStorage: a responder's sign-in ends when the tab closes.
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { storage: window.sessionStorage, persistSession: true } });
const app = document.getElementById("app");
const deviceId = new URLSearchParams(location.search).get("d");

const LABELS = { full_name: "Name", blood_type: "Blood type", allergies: "Allergies", medications: "Medications", conditions: "Conditions",
  emergency_contact_name: "Emergency contact", emergency_contact_phone: "Emergency contact phone", notes: "Notes",
  title: "Title", company: "Company", phone: "Phone", email: "Email", website: "Website", bio: "About" };

// Every value from the database goes in through textContent, never innerHTML.
function el(tag, props = {}, ...children) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") n.className = v; else if (k.startsWith("on")) n.addEventListener(k.slice(2), v); else if (v != null) n.setAttribute(k, v);
  }
  for (const c of children) if (c != null) n.append(c);
  return n;
}
const show = (...nodes) => app.replaceChildren(...nodes);
const card = (...c) => el("section", { class: "card" }, ...c);
function fields(obj, keys) {
  const dl = el("dl");
  for (const k of keys) if (obj[k]) dl.append(el("dt", {}, LABELS[k] || k), el("dd", {}, String(obj[k])));
  return dl;
}

function vcard(c) {
  const esc = (s) => String(s || "").replace(/([\;,])/g, "\\$1").replace(/\r?\n/g, "\\n");
  const lines = ["BEGIN:VCARD", "VERSION:3.0", `FN:${esc(c.full_name)}`];
  if (c.company) lines.push(`ORG:${esc(c.company)}`);
  if (c.title) lines.push(`TITLE:${esc(c.title)}`);
  if (c.phone) lines.push(`TEL;TYPE=CELL:${esc(c.phone)}`);
  if (c.email) lines.push(`EMAIL:${esc(c.email)}`);
  if (c.website) lines.push(`URL:${esc(c.website)}`);
  if (c.address) lines.push(`ADR;TYPE=WORK:;;${esc(c.address)};;;;`);
  if (c.bio) lines.push(`NOTE:${esc(c.bio)}`);
  lines.push("END:VCARD");
  return URL.createObjectURL(new Blob([lines.join("\r\n")], { type: "text/vcard" }));
}

// Static icon paths (not user data), drawn with DOM calls.
const ICONS = {
  phone: "M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25c1.1.37 2.3.57 3.6.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z",
  email: "M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zm8 7.2L20 7H4z",
  website: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm6.9 6h-2.95a15.7 15.7 0 0 0-1.38-3.56A8.03 8.03 0 0 1 18.9 8zM12 4.04c.83 1.2 1.48 2.53 1.91 3.96h-3.82c.43-1.43 1.08-2.76 1.91-3.96zM4.26 14a8.2 8.2 0 0 1 0-4h3.38a16.5 16.5 0 0 0 0 4zm.82 2h2.95c.32 1.25.78 2.45 1.38 3.56A7.99 7.99 0 0 1 5.08 16zm2.95-8H5.08a7.99 7.99 0 0 1 4.33-3.56A15.7 15.7 0 0 0 8.03 8zM12 19.96c-.83-1.2-1.48-2.53-1.91-3.96h3.82c-.43 1.43-1.08 2.76-1.91 3.96zM14.34 14H9.66a14.7 14.7 0 0 1 0-4h4.68a14.7 14.7 0 0 1 0 4zm.25 5.56c.6-1.11 1.06-2.31 1.38-3.56h2.95a8.03 8.03 0 0 1-4.33 3.56zM16.36 14a16.5 16.5 0 0 0 0-4h3.38a8.2 8.2 0 0 1 0 4z",
};
function icon(name) {
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("aria-hidden", "true");
  const p = document.createElementNS(NS, "path"); p.setAttribute("d", ICONS[name]); svg.append(p);
  return svg;
}
// Only http(s) links are ever made clickable.
function safeUrl(raw) {
  try { const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`); return /^https?:$/.test(u.protocol) ? u.href : null; } catch { return null; }
}

function renderPen(tap) {
  const nodes = [];
  if (tap.lost) nodes.push(el("section", { class: "notice" }, el("strong", {}, "This pen has been reported lost."), el("span", {}, " If you found it, please contact its owner below.")));
  if (!tap.card) nodes.push(card(el("h1", {}, "Sentorin pen"), el("p", { class: "muted" }, "The owner has not published a card yet.")));
  else {
    const c = tap.card;
    const site = c.website ? safeUrl(c.website) : null;
    const links = [
      c.phone && { key: "phone", label: "Call", text: c.phone, href: `tel:${c.phone.replace(/[^\d+]/g, "")}` },
      c.email && { key: "email", label: "Email", text: c.email, href: `mailto:${encodeURIComponent(c.email).replace(/%40/g, "@")}` },
      site && { key: "website", label: "Website", text: c.website.replace(/^https?:\/\//i, "").replace(/\/$/, ""), href: site, external: true },
    ].filter(Boolean);
    const attrs = (l) => (l.external ? { href: l.href, target: "_blank", rel: "noopener noreferrer" } : { href: l.href });
    // The card itself: a traditional printed business card.
    nodes.push(el("article", { class: "tcard" },
      el("h1", {}, c.full_name || "Contact"),
      c.title ? el("p", { class: "tc-title" }, c.title) : null,
      c.company ? el("p", { class: "tc-company" }, c.company) : null,
      el("div", { class: "tc-rule", "aria-hidden": "true" }),
      links.length ? el("p", { class: "tc-contact" }, ...links.flatMap((l, n) => [n ? el("span", { class: "sep", "aria-hidden": "true" }, "|") : null, el("a", attrs(l), l.text)])) : null,
      c.address ? el("p", { class: "tc-address" }, c.address) : null));
    if (c.bio) nodes.push(el("p", { class: "tc-bio" }, c.bio));
    nodes.push(el("div", { class: "actions" },
      el("a", { class: "btn", href: vcard(c), download: `${(c.full_name || "contact").replace(/[^\w-]+/g, "_")}.vcf` }, "Save to contacts"),
      links.length ? el("div", { class: "quick" }, ...links.map((l) => el("a", { ...attrs(l), class: "quick-btn", "aria-label": `${l.label} ${c.full_name || ""}`.trim() }, icon(l.key), el("span", {}, l.label)))) : null),
      el("p", { class: "foot" }, "Shared with a Sentorin pen"));
  }
  show(...nodes);
  fitContactLine();
}

// One line with dividers when it fits (like a printed card); otherwise one item per line, no stray dividers.
function fitContactLine() {
  const line = document.querySelector(".tc-contact");
  if (!line) return;
  line.classList.remove("stacked");
  const tops = [...line.querySelectorAll("a")].map((a) => a.offsetTop);
  if (new Set(tops).size > 1) line.classList.add("stacked");
}
addEventListener("resize", fitContactLine);

function renderBracelet(tap, message) {
  const pub = tap.public || {};
  const nodes = [card(el("h1", {}, "Emergency ID"),
    Object.keys(pub).length ? fields(pub, Object.keys(LABELS)) : el("p", { class: "muted" }, "No details are shown without responder sign-in."))];
  const email = el("input", { type: "email", autocomplete: "username", required: "" });
  const pass = el("input", { type: "password", autocomplete: "current-password", required: "" });
  const form = el("form", { onsubmit: async (e) => {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({ email: email.value.trim(), password: pass.value });
    if (error) return renderBracelet(tap, "Sign-in failed. Check your email and password.");
    secondFactor(tap);
  } }, el("h2", {}, "Authorized responder sign-in"), message ? el("p", { class: "alert" }, message) : null,
    el("label", {}, "Agency email"), email, el("label", {}, "Password"), pass, el("button", {}, "Sign in"),
    el("p", { class: "muted" }, "Access is limited to verified responders and every view is recorded."));
  nodes.push(card(form));
  show(...nodes);
}

async function secondFactor(tap, message) {
  const { data: factors, error } = await supabase.auth.mfa.listFactors();
  if (error) return renderBracelet(tap, "Could not check your second factor.");
  const verified = (factors.totp || []).find((f) => f.status === "verified");
  const code = el("input", { inputmode: "numeric", autocomplete: "one-time-code", pattern: "[0-9]{6}", maxlength: "6", required: "" });
  let factorId = verified?.id, intro;
  if (verified) intro = el("p", { class: "muted" }, "Enter the 6-digit code from your authenticator app.");
  else {
    // First sign-in: remove any half-finished enrolment, then enrol an authenticator app.
    for (const f of factors.all || []) if (f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
    const { data, error: e2 } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `responder-${Date.now()}` });
    if (e2) return renderBracelet(tap, "Could not set up a second factor.");
    factorId = data.id;
    intro = el("div", {}, el("p", { class: "muted" }, "First sign-in: scan this with an authenticator app, then enter the 6-digit code."),
      el("img", { class: "qr", alt: "Authenticator setup QR code", src: data.totp.qr_code }), el("p", { class: "muted" }, "Or enter this key: ", el("code", {}, data.totp.secret)));
  }
  show(card(el("form", { onsubmit: async (e) => {
    e.preventDefault();
    const { error: e3 } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.value.trim() });
    if (e3) return secondFactor(tap, "That code was not accepted. Try the current code.");
    emergency(tap);
  } }, el("h2", {}, "Second factor"), message ? el("p", { class: "alert" }, message) : null, intro, el("label", {}, "6-digit code"), code, el("button", {}, "Verify"))));
}

async function signOut(tap, message) { await supabase.auth.signOut(); renderBracelet(tap, message); }

async function emergency(tap) {
  const { data, error } = await supabase.rpc("get_emergency_profile", { p_public_id: deviceId });
  if (error) return signOut(tap, /authorized responder/.test(error.message) ? "This account is not a verified responder." : "Emergency details could not be loaded.");
  show(card(el("h1", {}, data.full_name || "Emergency ID"),
      fields(data, ["blood_type", "allergies", "medications", "conditions", "emergency_contact_name", "emergency_contact_phone", "notes"])),
    card(el("p", { class: "muted" }, "This view has been recorded under your responder ID."),
      el("button", { class: "secondary", onclick: () => signOut(tap) }, "Sign out")));
  setTimeout(() => signOut(tap, "Signed out automatically."), AUTO_SIGN_OUT_MS);
}

async function main() {
  if (!deviceId) return show(card(el("h1", {}, "Sentorin"), el("p", { class: "muted" }, "Tap a Sentorin pen or bracelet to open this page.")));
  const { data: tap, error } = await supabase.rpc("get_tap", { p_public_id: deviceId });
  if (error) return show(card(el("p", { class: "alert" }, "Could not reach the service. Check your connection and tap again.")));
  if (tap.kind === "pen") return renderPen(tap);
  if (tap.kind === "bracelet") {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    return aal?.currentLevel === "aal2" ? emergency(tap) : renderBracelet(tap);
  }
  show(card(el("h1", {}, "Not recognized"), el("p", { class: "muted" }, "This tag is not registered or has not been activated.")));
}
main();
