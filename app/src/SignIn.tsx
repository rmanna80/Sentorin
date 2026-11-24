import React, { useState } from "react";
import { supabase } from "./supabase";
import { Btn, Card, Err, Field, H, Muted } from "./ui";

export default function SignIn() {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [msg, setMsg] = useState(""); const [busy, setBusy] = useState(false);

  async function go(mode: "in" | "up") {
    setBusy(true); setMsg("");
    const creds = { email: email.trim(), password };
    const { data, error } = mode === "in" ? await supabase.auth.signInWithPassword(creds) : await supabase.auth.signUp(creds);
    setBusy(false);
    if (error) setMsg(error.message);
    else if (mode === "up" && !data.session) setMsg("Check your email to confirm your account, then sign in.");
  }

  return (
    <Card>
      <H>Sentorin</H>
      <Muted>Sign in to manage your pen or bracelet.</Muted>
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" />
      <Err>{msg}</Err>
      <Btn title="Sign in" onPress={() => go("in")} disabled={busy} />
      <Btn title="Create account" kind="secondary" onPress={() => go("up")} disabled={busy} />
    </Card>
  );
}
