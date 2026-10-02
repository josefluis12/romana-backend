import * as SecureStore from "expo-secure-store";

// This stays below SecureStore's historical 2 KB limit even for multi-byte text.
const CHUNK_SIZE = 500;
let generationSequence = 0;

interface StoredValueMetadata {
  generation: string;
  chunks: number;
}

function storageKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function metadataKey(key: string): string {
  return `${storageKey(key)}.meta`;
}

function chunkKey(key: string, generation: string, index: number): string {
  return `${storageKey(key)}.${generation}.${index}`;
}

function parseMetadata(value: string | null): StoredValueMetadata | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "generation" in parsed &&
      typeof parsed.generation === "string" &&
      "chunks" in parsed &&
      typeof parsed.chunks === "number" &&
      Number.isInteger(parsed.chunks) &&
      parsed.chunks > 0
    ) {
      return { generation: parsed.generation, chunks: parsed.chunks };
    }
  } catch {
    return null;
  }
  return null;
}

async function deleteChunks(key: string, metadata: StoredValueMetadata | null): Promise<void> {
  if (!metadata) return;
  await Promise.all(
    Array.from({ length: metadata.chunks }, (_, index) =>
      SecureStore.deleteItemAsync(chunkKey(key, metadata.generation, index)),
    ),
  );
}

export const secureSessionStorage = {
  async getItem(key: string): Promise<string | null> {
    const metadata = parseMetadata(await SecureStore.getItemAsync(metadataKey(key)));
    if (!metadata) return SecureStore.getItemAsync(storageKey(key));
    const chunks = await Promise.all(
      Array.from({ length: metadata.chunks }, (_, index) =>
        SecureStore.getItemAsync(chunkKey(key, metadata.generation, index)),
      ),
    );
    return chunks.every((chunk) => chunk !== null) ? chunks.join("") : null;
  },

  async setItem(key: string, value: string): Promise<void> {
    const oldMetadata = parseMetadata(await SecureStore.getItemAsync(metadataKey(key)));
    const generation = `${Date.now()}_${generationSequence++}`;
    const chunks = value.match(new RegExp(`.{1,${CHUNK_SIZE}}`, "gs")) ?? [""];
    await Promise.all(
      chunks.map((chunk, index) => SecureStore.setItemAsync(chunkKey(key, generation, index), chunk)),
    );
    await SecureStore.setItemAsync(metadataKey(key), JSON.stringify({ generation, chunks: chunks.length }));
    await SecureStore.deleteItemAsync(storageKey(key));
    await deleteChunks(key, oldMetadata);
  },

  async removeItem(key: string): Promise<void> {
    const metadata = parseMetadata(await SecureStore.getItemAsync(metadataKey(key)));
    await deleteChunks(key, metadata);
    await Promise.all([
      SecureStore.deleteItemAsync(metadataKey(key)),
      SecureStore.deleteItemAsync(storageKey(key)),
    ]);
  },
};
