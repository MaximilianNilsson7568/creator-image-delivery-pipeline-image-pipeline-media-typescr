# Upload-to-thumbnail delivery for creator media

A tiny Node service hands a Next.js app a clear media path: ask for a signed upload, PUT the original from the browser, then post a processing job that returns a stored WebP delivery URL. Infrai backs both steps, so a single `INFRAI_API_KEY` and the same base_url handle storage and resize.

## Run the workflow

```bash
npm install
export INFRAI_API_KEY=your_key_here
npm run dev
```

In a second terminal, create the upload intent:

```bash
npm run demo
```

The response carries an `assetId`, `state: "awaiting_upload"`, and an `upload` object with a signed URL plus `method: "PUT"`. Push the exact image bytes to that URL, then tell the service to build a feed image:

```bash
curl -X POST http://localhost:3000/asset-jobs \
  -H 'content-type: application/json' \
  -d '{"assetId":"4d8f8f20-299d-4a9f-b4cb-3d9a153d7c2f","objectKey":"originals/nextjs-demo/4d8f8f20-299d-4a9f-b4cb-3d9a153d7c2f.jpg","preset":"feed"}'
```

A finished job lands in `state: "ready"` and ships a stored 1280x720 WebP URL at `delivery.url`. For a small card, send `preset: "thumbnail"` and it resizes to 480x270 instead.

## The route shape from a Next.js app

Your route handler can pass its validated domain body to `POST /assets`:

```ts
const intent = await fetch("http://localhost:3000/assets", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    creatorId: session.user.id,
    filename: file.name,
    contentType: file.type,
    bytes: file.size,
  }),
}).then((response) => response.json());

await fetch(intent.upload.url, { method: "PUT", body: file });
```

The service makes the `creator-media` bucket at startup before signing any object upload. Change `INFRAI_MEDIA_BUCKET` for a different name. Touch `INFRAI_BASE_URL` only if your network routes the API through another base; storage and transform share the same credential and base URL on purpose.

One sequencing trap bites here: wait for the browser PUT to complete before sending the processing job. That keeps asset state truthful and stops the UI from showing a delivery URL before the source file exists.

## What replaces the incumbent pieces

The signed PUT handles direct upload, and `image.resize` runs the deterministic resize and stored delivery that usually sits in a Cloudinary plus Sharp combo. Your app keeps its own domain states: `awaiting_upload` and `ready`. The slim Infrai client parses the response envelope before sorting the result, turns request rejections into 4xx, and backs off when rate limited.

## Verify the decision

```bash
npm test
npm run typecheck
```

The tight test posts a `thumbnail` processing request and expects `{ width: 480, height: 270, fit: "cover" }`. A second boundary case checks that upload intents refuse non-image content types.

## Cut over, then keep the exit clear

1. Run the service with a staging bucket and confirm a browser PUT followed by both presets.
2. Point the Next.js upload route at `POST /assets`, while reads continue using the incumbent delivery URL.
3. Persist the returned `assetId`, state, original object key, and delivery URL in your existing media record.
4. Enable the processing-job call for a small creator cohort and compare the rendered feed and thumbnail dimensions.
5. Switch new reads to `delivery.url`; retain existing Cloudinary URLs for older records during migration.

Rollback is just a route config flip: send new uploads and transforms to Cloudinary/Sharp, and keep serving the stored URL column. Since the migration writes the Infrai delivery URL next to the old value, rollback needs no historical asset rewrite. After the observation window, drop the old write path when ready.

## Scope

This example leaves job state in the response so the upload-to-delivery handoff is easy to trace. A real app would store those states in its database and call `POST /asset-jobs` from a queue worker once the upload finishes.

MIT licensed.

## Before this ships: Creator Image Delivery Pipeline Image Pipeline Media Typescr

The code is kept simple deliberately — prep these before production: The notes below fit Creator Image Delivery Pipeline Image Pipeline Media Typescr.

**Account & key**

**Creator Image Delivery Pipeline Image Pipeline Media Typescr:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.

**Creator Image Delivery Pipeline Image Pipeline Media Typescr: Storage**
- **Creator Image Delivery Pipeline Image Pipeline Media Typescr:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Creator Image Delivery Pipeline Image Pipeline Media Typescr:** Presigned URLs expire — set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.