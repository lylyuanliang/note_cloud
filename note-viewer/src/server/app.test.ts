import http from "node:http";
import { mkdtemp, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import type { ViewerConfig } from "../shared/types";
import { createApp } from "./app";

async function fixture(): Promise<ViewerConfig> {
  const repoRoot = await mkdtemp(join(tmpdir(), "note-viewer-"));
  const contentRoot = join(repoRoot, "笔记");
  await mkdir(contentRoot, { recursive: true });
  return { repoRoot, contentRoot, port: 8080, publicBasePath: "/notes/" };
}

describe("server app", () => {
  const servers: http.Server[] = [];

  afterEach(async () => {
    await Promise.all(
      servers.splice(0).map(
        (server) =>
          new Promise<void>((resolve) => {
            server.close(() => resolve());
          })
      )
    );
  });

  it("serves runtime-config.js from deep paths", async () => {
    const config = await fixture();
    const app = createApp(config);
    const server = http.createServer(app);
    servers.push(server);

    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("missing address");

    const rootResponse = await fetch(`http://127.0.0.1:${address.port}/runtime-config.js`);
    expect(rootResponse.status).toBe(200);
    expect(rootResponse.headers.get("content-type")).toContain("application/javascript");
    expect(await rootResponse.text()).toContain("/notes/");

    const deepResponse = await fetch(`http://127.0.0.1:${address.port}/notes/topic/runtime-config.js`);
    expect(deepResponse.status).toBe(200);
    expect(await deepResponse.text()).toContain("/notes/");
  });

  it("returns JSON 404 for api runtime-config.js", async () => {
    const config = await fixture();
    const app = createApp(config);
    const server = http.createServer(app);
    servers.push(server);

    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("missing address");

    const response = await fetch(`http://127.0.0.1:${address.port}/api/runtime-config.js`);
    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.json()).resolves.toEqual({ error: "Not Found" });
  });

  it("returns JSON 404 for unknown api routes", async () => {
    const config = await fixture();
    const app = createApp(config);
    const server = http.createServer(app);
    servers.push(server);

    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("missing address");

    const response = await fetch(`http://127.0.0.1:${address.port}/api/does-not-exist`);
    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.json()).resolves.toEqual({ error: "Not Found" });
  });
});
