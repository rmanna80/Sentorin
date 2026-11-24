import React, { useState } from "react";
import { Share } from "react-native";
import { tapLink, writeTagLink } from "./nfc";
import { Btn, Card, Err, H, Muted } from "./ui";

/** Links a physical tag to this device by writing the device's tap link onto it. */
export default function TagWriter({ publicId, kind }: { publicId: string; kind: "pen" | "bracelet" }) {
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState(""); const [done, setDone] = useState(false);
  async function write() {
    setMsg(""); setDone(false); setBusy(true);
    try { await writeTagLink(publicId); setDone(true); } catch (e: any) { setMsg(e?.message ?? "Could not write the tag. Hold it still and try again."); } finally { setBusy(false); }
  }
  return (
    <Card>
      <H>NFC tag</H>
      <Muted>{`The tag in the ${kind} opens this link when a phone taps it:`}</Muted>
      <Muted>{tapLink(publicId)}</Muted>
      <Btn title={busy ? `Hold the ${kind} to your phone…` : "Write link to tag"} onPress={write} disabled={busy} />
      <Btn title="Share link" kind="secondary" onPress={() => { Share.share({ message: tapLink(publicId) }).catch(() => {}); }} />
      {done ? <Muted>Written. Tap the tag with any phone to test it.</Muted> : null}
      <Err>{msg}</Err>
    </Card>
  );
}
