import React, { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import type { Session } from "@supabase/supabase-js";
import { Device, supabase } from "./src/supabase";
import SignIn from "./src/SignIn";
import Devices from "./src/Devices";
import PenScreen from "./src/PenScreen";
import BraceletScreen from "./src/BraceletScreen";
import { Btn, c } from "./src/ui";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState<Device | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => { setSession(s); if (!s) setOpen(null); });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 48 }} keyboardShouldPersistTaps="handled">
          {!ready ? <Text style={{ color: c.muted }}>Loading…</Text>
            : !session ? <SignIn />
            : open ? (
              <View>
                <Btn title="‹ All devices" kind="secondary" onPress={() => setOpen(null)} />
                <View style={{ height: 12 }} />
                {open.device_type === "pen" ? <PenScreen device={open} onChanged={() => {}} /> : <BraceletScreen device={open} />}
              </View>
            ) : <Devices onOpen={setOpen} />}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
