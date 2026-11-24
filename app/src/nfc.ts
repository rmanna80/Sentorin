import type NfcManagerType from "react-native-nfc-manager";

// The address stored on every tag. Change this when the tap pages move to your own domain.
export const TAP_BASE_URL = "https://rmanna80.github.io/Sentorin/";
export const tapLink = (publicId: string) => `${TAP_BASE_URL}?d=${encodeURIComponent(publicId)}`;

/** Accepts a full tap link (…?d=ID) or a bare device ID. */
export function publicIdFromLink(text: string): string | null {
  const t = text.trim();
  const m = t.match(/[?&]d=([A-Za-z0-9_-]{1,64})(?:&|#|$)/);
  if (m) return m[1];
  return /^[A-Za-z0-9_-]{1,64}$/.test(t) ? t : null;
}

/** Waits for a tag, reads its link and returns the device ID in it (null if the tag is not a Sentorin tag). */
export async function readTagPublicId(): Promise<string | null> {
  // Loaded on demand: NFC only exists in a full build, not in Expo Go.
  let NfcManager: typeof NfcManagerType, Ndef: typeof import("react-native-nfc-manager").Ndef, NfcTech: typeof import("react-native-nfc-manager").NfcTech;
  try {
    const mod = require("react-native-nfc-manager") as typeof import("react-native-nfc-manager");
    NfcManager = mod.default; Ndef = mod.Ndef; NfcTech = mod.NfcTech;
    if (!(await NfcManager.isSupported())) throw new Error("unsupported");
  } catch {
    throw new Error("Scanning is not available here (it needs the full app build and a phone with NFC). Paste the link instead.");
  }
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

/** Waits for a blank or rewritable tag and stores this device's tap link on it. */
export async function writeTagLink(publicId: string): Promise<void> {
  let mod: typeof import("react-native-nfc-manager");
  try {
    mod = require("react-native-nfc-manager") as typeof import("react-native-nfc-manager");
    if (!(await mod.default.isSupported())) throw new Error("unsupported");
  } catch {
    throw new Error("Writing tags needs the full app build and a phone with NFC.");
  }
  const { default: NfcManager, Ndef, NfcTech } = mod;
  await NfcManager.start();
  try {
    await NfcManager.requestTechnology(NfcTech.Ndef);
    const bytes = Ndef.encodeMessage([Ndef.uriRecord(tapLink(publicId))]);
    if (!bytes) throw new Error("Could not prepare the link.");
    await NfcManager.ndefHandler.writeNdefMessage(bytes);
  } finally {
    NfcManager.cancelTechnologyRequest().catch(() => {});
  }
}
