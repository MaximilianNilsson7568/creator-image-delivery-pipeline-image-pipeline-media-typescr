const baseUrl = process.env.SERVICE_URL ?? "http://localhost:3000";

export {};

const response = await fetch(`${baseUrl}/assets`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    creatorId: "nextjs-demo",
    filename: "episode-cover.jpg",
    contentType: "image/jpeg",
    bytes: 1_240_000,
  }),
});

console.log(JSON.stringify(await response.json(), null, 2));
