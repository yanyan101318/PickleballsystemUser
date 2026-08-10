/** Readable codes without O/0, I/1/L confusion */
const TOKEN_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateJoinToken(length = 8) {
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  let s = "";
  for (let i = 0; i < length; i++) {
    s += TOKEN_CHARS[arr[i] % TOKEN_CHARS.length];
  }
  return s;
}

export function normalizeJoinToken(raw) {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}
