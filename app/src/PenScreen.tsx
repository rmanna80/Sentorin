import React, { useEffect, useRef, useState } from "react";
import { PermissionsAndroid, Platform, Switch, Text, View } from "react-native";
import type { BleManager } from "react-native-ble-plx";
import * as Location from "expo-location";
import { Device, has, supabase } from "./supabase";
import { Btn, Card, Err, Field, H, Muted, useC } from "./ui";

// Must match firmware/src/main.c
export const SENTORIN_SERVICE_UUID = "7e570001-5a4e-4f52-8a11-53454e544f52";
const advertisedName = (publicId: string) => `STN-${publicId}`;

const CARD_FIELDS = [["full_name", "Name"], ["title", "Title"], ["company", "Company"], ["phone", "Phone"], ["email", "Email"], ["website", "Website"], ["bio", "About"]] as const;
type CardRow = Record<(typeof CARD_FIELDS)[number][0], string> & { is_published: boolean };
const EMPTY: CardRow = { full_name: "", title: "", company: "", phone: "", email: "", website: "", bio: "", is_published: false };

function proximity(rssi: number) {
  if (rssi > -55) return "Very close";
  if (rssi > -70) return "Nearby";
  if (rssi > -85) return "In range";
  return "Far, at the edge of range";
}

export default function PenScreen({ device, onChanged }: { device: Device; onChanged: () => void }) {
  const c = useC();
  const [card, setCard] = useState<CardRow>(EMPTY); const [msg, setMsg] = useState(""); const [saved, setSaved] = useState(false);
  const [status, setStatus] = useState(device.status);
  const [scanning, setScanning] = useState(false); const [rssi, setRssi] = useState<number | null>(null);
  const [lastSeen, setLastSeen] = useState<{ lat: number; lng: number; seen_at: string } | null>(null);
  const ble = useRef<BleManager | null>(null); const lastSaved = useRef(0);

  useEffect(() => {
    supabase.from("business_cards").select("*").eq("device_id", device.id).maybeSingle()
      .then(({ data }) => { if (data) setCard({ ...EMPTY, ...Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v ?? ""])), is_published: !!data.is_published } as CardRow); });
    supabase.from("pen_locations").select("lat, lng, seen_at").eq("device_id", device.id).order("seen_at", { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => setLastSeen(data));
    return () => { ble.current?.stopDeviceScan(); ble.current?.destroy(); };
  }, [device.id]);

  async function saveCard() {
    setMsg(""); setSaved(false);
    const { error } = await supabase.from("business_cards").upsert({ device_id: device.id, ...card, updated_at: new Date().toISOString() });
    if (error) setMsg(error.message); else setSaved(true);
  }

  async function toggleLost() {
    const next = status === "lost" ? "active" : "lost";
    const { error } = await supabase.rpc("set_device_status", { p_device: device.id, p_status: next });
    if (error) setMsg(error.message); else { setStatus(next); onChanged(); }
  }

  async function recordSighting() {
    if (Date.now() - lastSaved.current < 60_000) return;          // at most one saved fix per minute
    lastSaved.current = Date.now();
    const perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) return;
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const row = { device_id: device.id, lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy_m: pos.coords.accuracy };
    const { error } = await supabase.from("pen_locations").insert(row);
    if (!error) setLastSeen({ lat: row.lat, lng: row.lng, seen_at: new Date().toISOString() });
  }

  async function startScan() {
    setMsg("");
    if (Platform.OS === "android") {
      const res = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN, PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT, PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION]);
      if (Object.values(res).some((r) => r !== PermissionsAndroid.RESULTS.GRANTED)) return setMsg("Bluetooth permission is needed to find the pen.");
    }
    if (!ble.current) {
      // Loaded on demand: Bluetooth only exists in a full build, not in Expo Go.
      try { const { BleManager: Manager } = require("react-native-ble-plx"); ble.current = new Manager() as BleManager; }
      catch { return setMsg("Bluetooth finding needs the full app build. It is not available in Expo Go."); }
    }
    const manager = ble.current;
    setScanning(true); setRssi(null);
    manager.startDeviceScan([SENTORIN_SERVICE_UUID], { allowDuplicates: true }, (error, found) => {
      if (error) { setMsg(error.message); setScanning(false); return; }
      if (found && (found.localName ?? found.name) === advertisedName(device.public_id) && found.rssi != null) {
        setRssi(found.rssi); recordSighting();
      }
    });
  }
  function stopScan() { ble.current?.stopDeviceScan(); setScanning(false); }

  return (
    <>
      {has(device, "ble_find") ? (
        <Card>
          <H>Find my pen</H>
          {scanning ? <Text style={{ fontSize: 22, fontWeight: "700", color: c.ink, marginTop: 6 }}>{rssi == null ? "Searching…" : proximity(rssi)}</Text> : null}
          {scanning && rssi != null ? <Muted>Signal {rssi} dBm. Move around; a stronger signal means closer.</Muted> : null}
          {lastSeen ? <Muted>Last seen {new Date(lastSeen.seen_at).toLocaleString()} at {lastSeen.lat.toFixed(5)}, {lastSeen.lng.toFixed(5)}</Muted>
            : <Muted>No saved location yet.</Muted>}
          <Btn title={scanning ? "Stop" : "Start searching"} onPress={scanning ? stopScan : startScan} />
          <Btn title={status === "lost" ? "Mark as found" : "Mark as lost"} kind={status === "lost" ? "secondary" : "danger"} onPress={toggleLost} />
        </Card>
      ) : null}
      {has(device, "business_card") ? (
        <Card>
          <H>Business card</H>
          <Muted>Shown when someone taps the pen with a phone.</Muted>
          {CARD_FIELDS.map(([key, label]) => (
            <Field key={key} label={label} value={card[key]} multiline={key === "bio"} autoCapitalize={key === "email" || key === "website" ? "none" : "sentences"}
              onChangeText={(t) => { setSaved(false); setCard({ ...card, [key]: t }); }} />
          ))}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
            <Text style={{ color: c.ink, fontSize: 16 }}>Published</Text>
            <Switch accessibilityLabel="Published" value={card.is_published} onValueChange={(v) => { setSaved(false); setCard({ ...card, is_published: v }); }} />
          </View>
          <Btn title="Save card" onPress={saveCard} />
          {saved ? <Muted>Saved.</Muted> : null}
        </Card>
      ) : null}
      <Err>{msg}</Err>
    </>
  );
}
