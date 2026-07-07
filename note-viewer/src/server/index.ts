import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getConfig } from "./config";
import { createAssetRouter } from "./routes/asset";
import { createEventsRouter } from "./routes/events";
import { createFileRouter } from "./routes/file";
import { createPortalRouter } from "./routes/portal";
import { createSearchRouter } from "./routes/search";
import { createTreeRouter } from "./routes/tree";
import { startRepositoryWatcher } from "./services/watchRepository";

const config = getConfig();
const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(__dirname, "../client");

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, basePath: config.publicBasePath });
});

app.get("/runtime-config.js", (_req, res) => {
  res.type("application/javascript");
  res.send(
    `window.__NOTE_VIEWER_CONFIG__ = ${JSON.stringify({ publicBasePath: config.publicBasePath })};`
  );
});

app.use("/api/tree", createTreeRouter(config));
app.use("/api/portal", createPortalRouter(config));
app.use("/api/file", createFileRouter(config));
app.use("/api/asset", createAssetRouter(config));
app.use("/api/search", createSearchRouter(config));
app.use("/api/events", createEventsRouter());

app.use(express.static(clientDist));
app.get("*", (_req, res) => {
  res.sendFile(path.join(clientDist, "index.html"));
});

app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  res.status(400).json({ error: error.message });
});

startRepositoryWatcher(config);

app.listen(config.port, () => {
  console.log(`note-viewer listening on ${config.port}`);
});
