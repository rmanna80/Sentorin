import React, { useEffect, useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";
import { publicIdFromLink, readTagPublicId } from "./nfc";
import { Btn, Card, Err, Field, H, Muted, useC } from "./ui";

type CardData = { full_name?: string; title?: string; company?: string; phone?: string; email?: string; website?: string; address?: string; bio?: string };
type Saved = { public_id: string; card: CardData; saved_at: string };
const KEY = "sentorin.received";

const initials = (n?: string) => (n ?? "").trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "?";
function webUrl(raw: string): string | null {
  const u = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return /^https?:\/\/[^\s]+$/i.test(u) ? u : null;                 // only ordinary web links are opened
}

function CardView({ item, onRemove }: { item: Saved; onRemove: () => void }) {
  const c = useC(); const d = item.card;
  const site = d.website ? webUrl(d.website) : null;
  const actions = [
    d.phone ? { label: "Call", go: () => Linking.openURL(`tel:${d.phone!.replace(/[^\d+]/g, "")}`) } : null,
    d.email ? { label: "Email", go: () => Linking.openURL(`mailto:${d.email}`) } : null,
    site ? { label: "Website", go: () => Linking.openURL(site) } : null,
  ].filter((a): a is { label: string; go: () => Promise<any> } => !!a);
  return (
    <Card>
      <View style={{ alignItems: "center" }}>
        <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: c.accent, alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
          <Text style={{ color: c.onAccent, fontSize: 26, fontWeight: "700" }}>{initials(d.full_name)}</Text>
        </View>
        <Text style={{ color: c.ink, fontSize: 22, fontWeight: "700", textAlign: "center" }}>{d.full_name || "Contact"}</Text>
        {d.title ? <Text style={{ color: c.ink, fontWeight: "600", marginTop: 2 }}>{d.title}</Text> : null}
        {d.company ? <Text style={{ color: c.muted }}>{d.company}</Text> : null}
        {d.bio ? <Text style={{ color: c.muted, textAlign: "center", marginTop: 8 }}>{d.bio}</Text> : null}
      </View>
      {[["Phone", d.phone], ["Email", d.email], ["Website", d.website], ["Address", d.address]].map(([label, value]) => value ? (
        <View key={label} style={{ borderTopWidth: 1, borderTopColor: c.line, paddingVertical: 8, marginTop: 8 }}>
          <Text style={{ color: c.muted, fontSize: 12 }}>{label}</Text>
          <Text style={{ color: c.ink, fontSize: 16 }} selectable>{value}</Text>
        </View>
      ) : null)}
      <View style={{ flexDirection: "row", gap: 8 }}>
        {actions.map((a) => <View key={a.label} style={{ flex: 1 }}><Btn title={a.label} kind="secondary" onPress={() => { a.go().catch(() => {}); }} /></View>)}
      </View>
      <Muted>Received {new Date(item.saved_at).toLocaleDateString()}</Muted>
      <Btn title="Remove" kind="danger" onPress={onRemove} />
    </Card>
  );
}

export default function Received() {
  const c = useC();
  const [items, setItems] = useState<Saved[]>([]); const [open, setOpen] = useState<string | null>(null);
  const [text, setText] = useState(""); const [msg, setMsg] = useState(""); const [busy, setBusy] = useState(false);

  useEffect(() => { AsyncStorage.getItem(KEY).then((v) => { if (v) setItems(JSON.parse(v)); }); }, []);
  const persist = (next: Saved[]) => { setItems(next); AsyncStorage.setItem(KEY, JSON.stringify(next)); };

  async function add(publicId: string | null) {
    if (!publicId) return setMsg("That is not a Sentorin pen.");
    const { data, error } = await supabase.rpc("get_tap", { p_public_id: publicId });
    if (error) return setMsg("Could not reach the service. Check your connection.");
    if (data?.kind !== "pen" || !data.card) return setMsg(data?.kind === "bracelet" ? "That is a bracelet. Use the Responder tab." : "No published card on that pen.");
    persist([{ public_id: publicId, card: data.card, saved_at: new Date().toISOString() }, ...items.filter((i) => i.public_id !== publicId)]);
    setOpen(publicId); setText("");
  }
  async function scan() {
    setMsg(""); setBusy(true);
    try { await add(await readTagPublicId()); } catch (e: any) { setMsg(e?.message ?? "Could not read the tag."); } finally { setBusy(false); }
  }

  return (
    <>
      <Card>
        <H>Receive a card</H>
        <Muted>Hold a Sentorin pen to the back of your phone, or paste the link you were sent.</Muted>
        <Btn title={busy ? "Hold the pen to your phone…" : "Scan a pen"} onPress={scan} disabled={busy} />
        <Field label="Link or pen ID" value={text} onChangeText={setText} autoCapitalize="none" autoCorrect={false} />
        <Btn title="Add" kind="secondary" disabled={!text.trim()} onPress={() => { setMsg(""); add(publicIdFromLink(text)); }} />
        <Err>{msg}</Err>
      </Card>
      {items.length === 0 ? <Card><Muted>Cards you receive are kept here on this phone.</Muted></Card> : null}
      {items.map((item) => open === item.public_id
        ? <CardView key={item.public_id} item={item} onRemove={() => persist(items.filter((i) => i.public_id !== item.public_id))} />
        : (
          <Pressable key={item.public_id} accessibilityRole="button" onPress={() => setOpen(item.public_id)}>
            <Card>
              <Text style={{ color: c.ink, fontSize: 17, fontWeight: "600" }}>{item.card.full_name || "Contact"}</Text>
              <Muted>{[item.card.title, item.card.company].filter(Boolean).join(" · ")}</Muted>
            </Card>
          </Pressable>
        ))}
    </>
  );
}
