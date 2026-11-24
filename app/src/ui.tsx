import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Pressable, Text, TextInput, TextInputProps, View } from "react-native";

const palettes = {
  light: { ink: "#14181f", muted: "#5b6472", line: "#dde2ea", bg: "#eef1f6", card: "#ffffff", soft: "#f3f6fb", accent: "#0b5cad", onAccent: "#ffffff", alert: "#b3261e" },
  dark: { ink: "#eef1f5", muted: "#a3adba", line: "#2a323d", bg: "#0d1116", card: "#171d25", soft: "#1e2630", accent: "#7ab8ff", onAccent: "#06223f", alert: "#ffb4ab" },
};
export type Mode = keyof typeof palettes;
export type Palette = (typeof palettes)["light"];
const KEY = "sentorin.appearance";

// White is the default; dark is something the person chooses in Settings.
const Ctx = createContext<{ c: Palette; mode: Mode; setMode: (m: Mode) => void }>({ c: palettes.light, mode: "light", setMode: () => {} });
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<Mode>("light");
  useEffect(() => { AsyncStorage.getItem(KEY).then((v) => { if (v === "dark" || v === "light") setModeState(v); }); }, []);
  const setMode = (m: Mode) => { setModeState(m); AsyncStorage.setItem(KEY, m); };
  return <Ctx.Provider value={{ c: palettes[mode], mode, setMode }}>{children}</Ctx.Provider>;
}
export const useTheme = () => useContext(Ctx);
export const useC = () => useContext(Ctx).c;

export function Card({ children }: { children: React.ReactNode }) {
  const c = useC();
  return <View style={{ backgroundColor: c.card, borderColor: c.line, borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 12 }}>{children}</View>;
}
export function H({ children }: { children: React.ReactNode }) { const c = useC(); return <Text style={{ fontSize: 20, fontWeight: "700", color: c.ink, marginBottom: 4 }}>{children}</Text>; }
export function Muted({ children }: { children: React.ReactNode }) { const c = useC(); return <Text style={{ color: c.muted, fontSize: 14 }}>{children}</Text>; }
export function Err({ children }: { children: React.ReactNode }) { const c = useC(); return children ? <Text style={{ color: c.alert, fontWeight: "600", marginTop: 8 }}>{children}</Text> : null; }

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const c = useC();
  return (
    <View style={{ marginTop: 12 }}>
      <Text style={{ color: c.muted, fontSize: 13, marginBottom: 4 }}>{label}</Text>
      <TextInput placeholderTextColor={c.muted} accessibilityLabel={label} {...props}
        style={{ borderWidth: 1, borderColor: c.line, backgroundColor: c.soft, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: c.ink }} />
    </View>
  );
}

export function Btn({ title, onPress, kind = "primary", disabled }: { title: string; onPress: () => void; kind?: "primary" | "secondary" | "danger"; disabled?: boolean }) {
  const c = useC();
  const fg = kind === "primary" ? c.onAccent : kind === "danger" ? c.alert : c.accent;
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={onPress}
      style={{ marginTop: 12, minHeight: 48, justifyContent: "center", alignItems: "center", borderRadius: 12, borderWidth: 1,
        backgroundColor: kind === "primary" ? c.accent : "transparent", borderColor: kind === "primary" ? c.accent : c.line, opacity: disabled ? 0.5 : 1 }}>
      <Text style={{ color: fg, fontWeight: "600", fontSize: 16 }}>{title}</Text>
    </Pressable>
  );
}
