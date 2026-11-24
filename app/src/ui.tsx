import React from "react";
import { Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from "react-native";

export const c = { ink: "#14181f", muted: "#5b6472", line: "#d9dee6", bg: "#f4f6f9", card: "#fff", accent: "#0b5cad", alert: "#b3261e" };

export function Card({ children }: { children: React.ReactNode }) { return <View style={s.card}>{children}</View>; }
export function H({ children }: { children: React.ReactNode }) { return <Text style={s.h}>{children}</Text>; }
export function Muted({ children }: { children: React.ReactNode }) { return <Text style={s.muted}>{children}</Text>; }
export function Err({ children }: { children: React.ReactNode }) { return children ? <Text style={s.err}>{children}</Text> : null; }

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={{ marginTop: 12 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput style={s.input} placeholderTextColor={c.muted} accessibilityLabel={label} {...props} />
    </View>
  );
}

export function Btn({ title, onPress, kind = "primary", disabled }: { title: string; onPress: () => void; kind?: "primary" | "secondary" | "danger"; disabled?: boolean }) {
  const bg = kind === "primary" ? c.accent : "transparent";
  const fg = kind === "primary" ? "#fff" : kind === "danger" ? c.alert : c.accent;
  return (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress}
      style={[s.btn, { backgroundColor: bg, borderColor: kind === "primary" ? c.accent : c.line, opacity: disabled ? 0.5 : 1 }]}>
      <Text style={{ color: fg, fontWeight: "600", fontSize: 16 }}>{title}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: c.card, borderColor: c.line, borderWidth: 1, borderRadius: 14, padding: 16, marginBottom: 12 },
  h: { fontSize: 20, fontWeight: "700", color: c.ink, marginBottom: 4 },
  muted: { color: c.muted, fontSize: 14 },
  err: { color: c.alert, fontWeight: "600", marginTop: 8 },
  label: { color: c.muted, fontSize: 13, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: c.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: c.ink },
  btn: { marginTop: 12, paddingVertical: 12, borderRadius: 10, borderWidth: 1, alignItems: "center" },
});
