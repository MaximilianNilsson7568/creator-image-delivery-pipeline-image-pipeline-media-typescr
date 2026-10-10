import { randomUUID } from "node:crypto";
import { z } from "zod";
import { InfraiError, infrai } from "./infrai";

export const uploadRequestSchema = z.object({
  creatorId: z.string().min(1).max(80).regex(/^[a-zA-Z0-9_-]+$/),
  filename: z.string().min(1).max(160),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  bytes: z.number().int().positive().max(20_000_000),
});

export const processingRequestSchema = z.object({
  assetId: z.string().uuid(),
  objectKey: z.string().min(1).max(500),
  preset: z.enum(["feed", "thumbnail"]),
});

export type UploadRequest = z.infer<typeof uploadRequestSchema>;
export type ProcessingRequest = z.infer<typeof processingRequestSchema>;

export type AssetJob = {
  assetId: string;
  state: "awaiting_upload" | "ready";
  upload?: { method: "PUT"; url: string; objectKey: string };
  delivery?: { url: string; width: number; height: number };
};

export const deliveryPreset = {
  feed: { width: 1280, height: 720, fit: "cover" },
  thumbnail: { width: 480, height: 270, fit: "cover" },
} as const;

export function chooseDeliveryTransform(preset: ProcessingRequest["preset"]) {
  return deliveryPreset[preset];
}

export class CreatorDeliveryPipeline {
  private bucketReady?: Promise<void>;
  private readonly bucket: string;

  constructor(bucket = process.env.INFRAI_MEDIA_BUCKET ?? "creator-media") {
    this.bucket = bucket;
  }

  private ensureBucket(): Promise<void> {
    this.bucketReady ??= infrai.storage.bucket.create({ name: this.bucket }).then(
      () => undefined,
      (error: unknown) => {
        if (error instanceof InfraiError && error.detail.code === "STORAGE_BUCKET_EXISTS") return;
        throw error;
      },
    );
    return this.bucketReady;
  }

  async beginUpload(input: UploadRequest): Promise<AssetJob> {
    await this.ensureBucket();
    const assetId = randomUUID();
    const extension = input.filename.split(".").pop()?.toLowerCase() ?? "image";
    const objectKey = `originals/${input.creatorId}/${assetId}.${extension}`;
    const signed = await infrai.storage.object.presign(this.bucket, objectKey, {
      op: "put",
      expires_seconds: 600,
      content_type: input.contentType,
      max_bytes: input.bytes,
      idempotency_key: `asset-upload-${assetId}`,
    });
    return { assetId, state: "awaiting_upload", upload: { method: "PUT", url: signed.url, objectKey } };
  }

  async processUpload(input: ProcessingRequest): Promise<AssetJob> {
    await this.ensureBucket();
    const transform = chooseDeliveryTransform(input.preset);
    const source = await infrai.storage.object.presign(this.bucket, input.objectKey, {
      op: "get",
      expires_seconds: 600,
      idempotency_key: `asset-source-${input.assetId}`,
    });
    const result = await infrai.image.resize({
      image: source.url,
      width: transform.width,
      height: transform.height,
      fit: transform.fit,
      enlarge: false,
      format: "webp",
      store: true,
    });
    return {
      assetId: input.assetId,
      state: "ready",
      delivery: { url: result.url, width: transform.width, height: transform.height },
    };
  }
}
