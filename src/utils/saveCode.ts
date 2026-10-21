// Save codes are the game state as UTF-8 JSON, base64-encoded, so they can be pasted between devices.

/** Parsed JSON object whose shape has not been checked yet. */
export type JsonObject = Record<string, unknown>;

export const encodeSaveCode = (data: unknown): string => {
  const bytes = new TextEncoder().encode(JSON.stringify(data));
  let binary = "";
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
  return btoa(binary);
};

const isJsonObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// Throws if the code is not valid base64 JSON or does not look like a game save.
export const decodeSaveCode = (code: string): JsonObject => {
  const binary = atob(code.trim());
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  const data: unknown = JSON.parse(new TextDecoder().decode(bytes));
  if (!isJsonObject(data) || typeof data.money !== "number" || !Array.isArray(data.recipes)) {
    throw new Error("Not a Forno Lento save");
  }
  return data;
};
