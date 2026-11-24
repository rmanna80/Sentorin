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
  if (c.bio) lines.push(`NOTE:${esc(c.bio)}`);
  lines.push("END:VCARD");
  return URL.createObjectURL(new Blob([lines.join("\r\n")], { type: "text/vcard" }));
}

function renderPen(tap) {
  const nodes = [];
  if (tap.lost) nodes.push(card(el("p", { class: "alert" }, "This pen has been reported lost."), el("p", { class: "muted" }, "If you found it, the owner's contact details are below.")));
  if (!tap.card) nodes.push(card(el("h1", {}, "Sentorin pen"), el("p", { class: "muted" }, "The owner has not published a card yet.")));
  else {
    const c = tap.card;
    nodes.push(card(el("h1", {}, c.full_name || "Contact"), el("p", { class: "muted" }, [c.title, c.company].filter(Boolean).join(" · ")),
      fields(c, ["phone", "email", "website", "bio"]),
      el("a", { class: "btn", href: vcard(c), download: `${(c.full_name || "contact").replace(/[^\w-]+/g, "_")}.vcf` }, "Save contact")));
  }
  show(...nodes);
}

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
