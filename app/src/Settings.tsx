import React from "react";
import { View } from "react-native";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { Btn, Card, H, Muted, useTheme } from "./ui";

export default function Settings({ session }: { session: Session | null }) {
  const { mode, setMode } = useTheme();
  return (
    <>
      <Card>
        <H>Appearance</H>
        <Muted>Applies to everything you see in the app, including cards you receive and emergency profiles.</Muted>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={{ flex: 1 }}><Btn title={mode === "light" ? "Light ✓" : "Light"} kind={mode === "light" ? "primary" : "secondary"} onPress={() => setMode("light")} /></View>
          <View style={{ flex: 1 }}><Btn title={mode === "dark" ? "Dark ✓" : "Dark"} kind={mode === "dark" ? "primary" : "secondary"} onPress={() => setMode("dark")} /></View>
        </View>
      </Card>
      <Card>
        <H>Account</H>
        <Muted>{session ? `Signed in as ${session.user.email}` : "Not signed in. You can still receive business cards."}</Muted>
        {session ? <Btn title="Sign out" kind="secondary" onPress={() => supabase.auth.signOut()} /> : null}
      </Card>
    </>
  );
}
