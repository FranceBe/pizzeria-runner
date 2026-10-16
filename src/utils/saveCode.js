// Save codes are the game state as UTF-8 JSON, base64-encoded, so they can be pasted between devices.

export function encodeSaveCode(data) {
  const bytes = new TextEncoder().encode(JSON.stringify(data));
  let binary = "";
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
  return btoa(binary);
}

// Throws if the code is not valid base64 JSON or does not look like a game save.
export function decodeSaveCode(code) {
  const binary = atob(code.trim());
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  const data = JSON.parse(new TextDecoder().decode(bytes));
  if (typeof data.money !== "number" || !Array.isArray(data.recipes)) throw new Error("Not a Forno Lento save");
  return data;
}
