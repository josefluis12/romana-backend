import { randomUUID } from "node:crypto";

const imageTypes = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

type ImageMimeType = keyof typeof imageTypes;

export interface ProductImageStorage {
  upload(accessToken: string, userId: string, image: Buffer, contentType: ImageMimeType): Promise<string>;
}

export function detectImageType(image: Buffer): ImageMimeType | null {
  if (image.length >= 3 && image[0] === 0xff && image[1] === 0xd8 && image[2] === 0xff) return "image/jpeg";
  if (image.length >= 8 && image.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (image.length >= 12 && image.toString("ascii", 0, 4) === "RIFF" && image.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}

export function createSupabaseProductImageStorage(url: string, key: string): ProductImageStorage {
  return {
    async upload(accessToken, userId, image, contentType) {
      if (!url || !key) throw new Error("Product image storage is not configured.");
      const objectPath = `${userId}/${randomUUID()}.${imageTypes[contentType]}`;
      const response = await fetch(`${url}/storage/v1/object/product-images/${objectPath}`, {
        method: "POST",
        headers: {
          apikey: key,
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": contentType,
          "x-upsert": "false",
        },
        body: new Uint8Array(image),
      });
      if (!response.ok) throw new Error("Product image upload failed.");
      return `${url}/storage/v1/object/public/product-images/${objectPath}`;
    },
  };
}
