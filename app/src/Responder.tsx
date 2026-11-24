import React, { useEffect, useState } from "react";
import { Linking, Text, View } from "react-native";
import { supabase } from "./supabase";
import { publicIdFromLink, readTagPublicId } from "./nfc";
import { Btn, Card, Err, Field, H, Muted, useC } from "./ui";

const FIELDS: [string, string][] = [["blood_type", "Blood type"], ["allergies", "Allergies"], ["medications", "Medications"], ["conditions", "Conditions"],
  ["emergency_contact_name", "Emergency contact"], ["emergency_contact_phone", "Emergency contact phone"], ["notes", "Notes"]];
type Step = "checking" | "enroll" | "code" | "ready";

export default function Responder() {
  const c = useC();
  const [step, setStep] = useState<Step>("checking");
  const [factorId, setFactorId] = useState(""); const [secret, setSecret] = useState(""); const [uri, setUri] = useState("");
  const [code, setCode] = useState(""); const [text, setText] = useState(""); const [msg, setMsg] = useState(""); const [busy, setBusy] = useState(false);
  const [profile, setProfile] = useState<Record<string, string> | null>(null);

  // A second factor is required every time the sign-in is not already at the higher level.
  async function check() {
    setMsg("");
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.currentLevel === "aal2") return setStep("ready");
    const { data: factors, error } = await supabase.auth.mfa.listFactors();
    if (error) return setMsg("Could not check your second factor.");
    const verified = factors.totp.find((f) => f.status === "verified");
    if (verified) { setFactorId(verified.id); return setStep("code"); }
    for (const f of factors.all) if (f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
    const { data, error: e2 } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `responder-${Date.now()}` });
    if (e2 || !data) return setMsg("Could not set up a second factor.");
    setFactorId(data.id); setSecret(data.totp.secret); setUri(data.totp.uri); setStep("enroll");
  }
  useEffect(() => { check(); }, []);

  async function verify() {
    setMsg("");
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
    if (error) return setMsg("That code was not accepted. Try the current code.");
    setCode(""); setStep("ready");
  }

  async function open(publicId: string | null) {
    if (!publicId) return setMsg("That is not a Sentorin bracelet.");
    const { data, error } = await supabase.rpc("get_emergency_profile", { p_public_id: publicId });
    if (error) {
      if (/second factor/.test(error.message)) { setStep("checking"); return check(); }
      return setMsg(/authorized responder/.test(error.message) ? "This account is not a verified responder. Ask your agency administrator."
        : /unknown bracelet|no emergency profile/.test(error.message) ? "No emergency profile was found for that bracelet." : "Emergency details could not be loaded.");
    }
    setProfile(data); setText("");
  }
  async function scan() {
    setMsg(""); setBusy(true);
    try { await open(await readTagPublicId()); } catch (e: any) { setMsg(e?.message ?? "Could not read the tag."); } finally { setBusy(false); }
  }

  if (profile) return (
    <Card>
      <H>{profile.full_name || "Emergency ID"}</H>
      {FIELDS.map(([k, label]) => profile[k] ? (
        <View key={k} style={{ borderTopWidth: 1, borderTopColor: c.line, paddingVertical: 8, marginTop: 8 }}>
          <Text style={{ color: c.muted, fontSize: 12 }}>{label}</Text>
          <Text style={{ color: c.ink, fontSize: 18 }} selectable>{profile[k]}</Text>
        </View>
      ) : null)}
      <Muted>This view has been recorded under your responder ID.</Muted>
      <Btn title="Close" onPress={() => setProfile(null)} />
    </Card>
  );

  return (
    <Card>
      <H>Responder access</H>
      {step === "checking" ? <Muted>Checking your sign-in…</Muted> : null}
      {step === "enroll" ? (
        <>
          <Muted>First time on this account: add Sentorin to an authenticator app, then enter the 6-digit code it shows.</Muted>
          <Btn title="Open authenticator app" kind="secondary" onPress={() => { Linking.openURL(uri).catch(() => setMsg("No authenticator app found. Enter the key by hand.")); }} />
          <Text style={{ color: c.muted, fontSize: 12, marginTop: 12 }}>Setup key</Text>
          <Text style={{ color: c.ink, fontSize: 16 }} selectable>{secret}</Text>
        </>
      ) : null}
      {step === "code" ? <Muted>Enter the 6-digit code from your authenticator app.</Muted> : null}
      {step === "enroll" || step === "code" ? (
        <>
          <Field label="6-digit code" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} autoComplete="one-time-code" />
          <Btn title="Verify" onPress={verify} disabled={code.trim().length !== 6} />
        </>
      ) : null}
      {step === "ready" ? (
        <>
          <Muted>Hold the bracelet to the back of your phone. Every view is recorded under your responder ID.</Muted>
          <Btn title={busy ? "Hold the bracelet to your phone…" : "Scan a bracelet"} onPress={scan} disabled={busy} />
          <Field label="Or enter the bracelet ID" value={text} onChangeText={setText} autoCapitalize="characters" autoCorrect={false} />
          <Btn title="Open" kind="secondary" disabled={!text.trim()} onPress={() => { setMsg(""); open(publicIdFromLink(text)); }} />
        </>
      ) : null}
      <Err>{msg}</Err>
    </Card>
  );
}
