import React, { useEffect, useState } from "react";
import { Switch, Text, View } from "react-native";
import { Device, supabase } from "./supabase";
import { Btn, Card, Err, Field, H, Muted, c } from "./ui";

const FIELDS = [["full_name", "Name", false], ["blood_type", "Blood type", true], ["allergies", "Allergies", true], ["medications", "Medications", true],
  ["conditions", "Conditions", true], ["emergency_contact_name", "Emergency contact", true], ["emergency_contact_phone", "Emergency contact phone", true],
  ["notes", "Notes for responders", false]] as const;
type Key = (typeof FIELDS)[number][0];
type LogRow = { id: number; accessed_at: string; responder_code: string | null };

export default function BraceletScreen({ device }: { device: Device }) {
  const [values, setValues] = useState<Record<Key, string>>(Object.fromEntries(FIELDS.map(([k]) => [k, ""])) as Record<Key, string>);
  const [publicFields, setPublicFields] = useState<string[]>([]);
  const [log, setLog] = useState<LogRow[]>([]); const [msg, setMsg] = useState(""); const [saved, setSaved] = useState(false);

  useEffect(() => {
    supabase.from("emergency_profiles").select("*").eq("device_id", device.id).maybeSingle().then(({ data }) => {
      if (!data) return;
      setValues(Object.fromEntries(FIELDS.map(([k]) => [k, data[k] ?? ""])) as Record<Key, string>);
      setPublicFields(data.public_fields ?? []);
    });
    supabase.from("emergency_access_log").select("id, accessed_at, responder_code").eq("device_id", device.id)
      .order("accessed_at", { ascending: false }).limit(50).then(({ data }) => setLog(data ?? []));
  }, [device.id]);

  async function save() {
    setMsg(""); setSaved(false);
    const { error } = await supabase.from("emergency_profiles")
      .upsert({ device_id: device.id, ...values, public_fields: publicFields, updated_at: new Date().toISOString() });
    if (error) setMsg(error.message); else setSaved(true);
  }
  const toggle = (k: string, on: boolean) => { setSaved(false); setPublicFields(on ? [...publicFields, k] : publicFields.filter((f) => f !== k)); };

  return (
    <>
      <Card>
        <H>Emergency profile</H>
        <Muted>Verified responders see everything here after signing in. Switch on "Show without sign-in" only for details you accept anyone who taps the bracelet can read.</Muted>
        {FIELDS.map(([key, label, canBePublic]) => (
          <View key={key}>
            <Field label={label} value={values[key]} multiline={key === "notes"} onChangeText={(t) => { setSaved(false); setValues({ ...values, [key]: t }); }} />
            {canBePublic ? (
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
                <Text style={{ color: c.muted, fontSize: 13 }}>Show without sign-in</Text>
                <Switch accessibilityLabel={`Show ${label} without sign-in`} value={publicFields.includes(key)} onValueChange={(v) => toggle(key, v)} />
              </View>
            ) : null}
          </View>
        ))}
        <Err>{msg}</Err>
        <Btn title="Save" onPress={save} />
        {saved ? <Muted>Saved.</Muted> : null}
      </Card>
      <Card>
        <H>Who has viewed it</H>
        {log.length === 0 ? <Muted>No responder has opened this profile.</Muted> : log.map((r) => (
          <Text key={r.id} style={{ color: c.ink, marginTop: 6 }}>{new Date(r.accessed_at).toLocaleString()} · responder {r.responder_code ?? "unknown"}</Text>
        ))}
      </Card>
    </>
  );
}
