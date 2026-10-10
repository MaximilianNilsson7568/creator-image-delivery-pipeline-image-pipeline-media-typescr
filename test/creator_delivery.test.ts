import assert from "node:assert/strict";
import test from "node:test";
import { chooseDeliveryTransform, processingRequestSchema, uploadRequestSchema } from "../src/creator_delivery";

test("a thumbnail job chooses a 16:9 crop without enlarging the source policy", () => {
  const request = processingRequestSchema.parse({
    assetId: "4d8f8f20-299d-4a9f-b4cb-3d9a153d7c2f",
    objectKey: "originals/nextjs-demo/4d8f8f20-299d-4a9f-b4cb-3d9a153d7c2f.jpg",
    preset: "thumbnail",
  });
  assert.deepEqual(chooseDeliveryTransform(request.preset), { width: 480, height: 270, fit: "cover" });
});

test("the upload boundary rejects a non-image content type", () => {
  const result = uploadRequestSchema.safeParse({
    creatorId: "nextjs-demo",
    filename: "notes.txt",
    contentType: "text/plain",
    bytes: 120,
  });
  assert.equal(result.success, false);
});
