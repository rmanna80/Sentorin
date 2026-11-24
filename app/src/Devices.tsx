import React, { useCallback, useEffect, useState } from "react";
import { Pressable, Text } from "react-native";
import { Device, supabase } from "./supabase";
import { Btn, Card, Err, Field, H, Muted, c } from "./ui";

export default function Devices({ onOpen }: { onOpen: (d: Device) => void }) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [publicId, setPublicId] = useState(""); const [code, setCode] = useState(""); const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("devices")
      .select("id, public_id, device_type, tier_id, status, product_tiers(name, features)").order("claimed_at");
    if (error) setMsg(error.message); else setDevices((data ?? []) as unknown as Device[]);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function claim() {
    setMsg("");
    const { error } = await supabase.rpc("claim_device", { p_public_id: publicId.trim(), p_claim_code: code.trim() });
    if (error) return setMsg("That device ID or code was not accepted.");
    setPublicId(""); setCode(""); load();
  }

  return (
    <>
      {devices.map((d) => (
        <Pressable key={d.id} onPress={() => onOpen(d)} accessibilityRole="button">
          <Card>
            <H>{d.product_tiers?.name ?? d.device_type}</H>
            <Muted>ID {d.public_id}</Muted>
            {d.status === "lost" ? <Text style={{ color: c.alert, fontWeight: "600", marginTop: 4 }}>Marked lost</Text> : null}
          </Card>
        </Pressable>
      ))}
      {devices.length === 0 ? <Card><Muted>No devices yet. Add one with the ID and code from the box.</Muted></Card> : null}
      <Card>
        <H>Add a device</H>
        <Field label="Device ID" value={publicId} onChangeText={setPublicId} autoCapitalize="characters" />
        <Field label="Code from the box" value={code} onChangeText={setCode} autoCapitalize="none" />
        <Err>{msg}</Err>
        <Btn title="Add device" onPress={claim} disabled={!publicId || !code} />
      </Card>
      <Btn title="Sign out" kind="secondary" onPress={() => supabase.auth.signOut()} />
    </>
  );
}
