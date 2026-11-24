import NfcManager, { Ndef, NfcTech } from "react-native-nfc-manager";

/** Accepts a full tap link (…?d=ID) or a bare device ID. */
export function publicIdFromLink(text: string): string | null {
  const t = text.trim();
  const m = t.match(/[?&]d=([A-Za-z0-9_-]{1,64})(?:&|#|$)/);
  if (m) return m[1];
  return /^[A-Za-z0-9_-]{1,64}$/.test(t) ? t : null;
}

/** Waits for a tag, reads its link and returns the device ID in it (null if the tag is not a Sentorin tag). */
export async function readTagPublicId(): Promise<string | null> {
  if (!(await NfcManager.isSupported())) throw new Error("This phone cannot read NFC tags.");
  await NfcManager.start();
  try {
    await NfcManager.requestTechnology(NfcTech.Ndef);
    const tag = await NfcManager.getTag();
    for (const rec of tag?.ndefMessage ?? []) {
      try {
        const id = publicIdFromLink(Ndef.uri.decodePayload(new Uint8Array(rec.payload)));
        if (id) return id;
      } catch { /* not a link record */ }
    }
    return null;
  } finally {
    NfcManager.cancelTechnologyRequest().catch(() => {});
  }
}
