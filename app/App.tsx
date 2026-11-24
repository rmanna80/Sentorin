import React, { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, SafeAreaView, ScrollView, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import type { Session } from "@supabase/supabase-js";
import { Device, supabase } from "./src/supabase";
import SignIn from "./src/SignIn";
import Devices from "./src/Devices";
import PenScreen from "./src/PenScreen";
import BraceletScreen from "./src/BraceletScreen";
import Received from "./src/Received";
import Responder from "./src/Responder";
import Settings from "./src/Settings";
import { Btn, ThemeProvider, useTheme } from "./src/ui";

const TABS = ["My devices", "Received", "Responder", "Settings"] as const;
type Tab = (typeof TABS)[number];

function Shell() {
  const { c, mode } = useTheme();
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>("My devices");
  const [open, setOpen] = useState<Device | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => { setSession(s); if (!s) setOpen(null); });
    return () => sub.subscription.unsubscribe();
  }, []);

  let body: React.ReactNode;
  if (!ready) body = <Text style={{ color: c.muted }}>Loading…</Text>;
  else if (tab === "Received") body = <Received />;
  else if (tab === "Settings") body = <Settings session={session} />;
  else if (!session) body = <SignIn />;
  else if (tab === "Responder") body = <Responder />;
  else if (open) body = (
    <View>
      <Btn title="‹ All devices" kind="secondary" onPress={() => setOpen(null)} />
      <View style={{ height: 12 }} />
      {open.device_type === "pen" ? <PenScreen device={open} onChanged={() => {}} /> : <BraceletScreen device={open} />}
    </View>
  );
  else body = <Devices onOpen={setOpen} />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <StatusBar style={mode === "dark" ? "light" : "dark"} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 48 }} keyboardShouldPersistTaps="handled">{body}</ScrollView>
      </KeyboardAvoidingView>
      <View accessibilityRole="tablist" style={{ flexDirection: "row", borderTopWidth: 1, borderTopColor: c.line, backgroundColor: c.card }}>
        {TABS.map((t) => (
          <Pressable key={t} accessibilityRole="tab" accessibilityState={{ selected: tab === t }} onPress={() => setTab(t)}
            style={{ flex: 1, minHeight: 56, alignItems: "center", justifyContent: "center", borderTopWidth: 2, borderTopColor: tab === t ? c.accent : "transparent" }}>
            <Text style={{ color: tab === t ? c.accent : c.muted, fontWeight: tab === t ? "700" : "500", fontSize: 13 }}>{t}</Text>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  return <ThemeProvider><Shell /></ThemeProvider>;
}
