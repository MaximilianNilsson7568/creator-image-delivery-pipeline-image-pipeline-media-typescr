import { createServer, type ServerResponse } from "node:http";
import { ZodError } from "zod";
import { CreatorDeliveryPipeline, processingRequestSchema, uploadRequestSchema } from "./creator_delivery";
import { InfraiError } from "./infrai";

const pipeline = new CreatorDeliveryPipeline();
const port = Number(process.env.PORT ?? 3000);

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

async function readJson(request: AsyncIterable<Uint8Array>): Promise<unknown> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

createServer(async (request, response) => {
  try {
    if (request.method === "POST" && request.url === "/assets") {
      const input = uploadRequestSchema.parse(await readJson(request));
      return json(response, 201, await pipeline.beginUpload(input));
    }
    if (request.method === "POST" && request.url === "/asset-jobs") {
      const input = processingRequestSchema.parse(await readJson(request));
      return json(response, 200, await pipeline.processUpload(input));
    }
    return json(response, 404, { error: "route_not_found" });
  } catch (error) {
    if (error instanceof ZodError) return json(response, 400, { error: "invalid_request", issues: error.issues });
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      return json(response, status, { error: error.detail.code ?? "upstream_request_rejected", message: error.message });
    }
    return json(response, 500, { error: "internal_error" });
  }
}).listen(port, () => console.log(`Media ingest service listening on http://localhost:${port}`));
