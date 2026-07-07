import express from "express";
import { getConfig } from "./config";

const config = getConfig();
const app = express();

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, basePath: config.publicBasePath });
});

app.get("/runtime-config.js", (_req, res) => {
  res.type("application/javascript");
  res.send(
    `window.__NOTE_VIEWER_CONFIG__ = ${JSON.stringify({ publicBasePath: config.publicBasePath })};`
  );
});

app.listen(config.port, () => {
  console.log(`note-viewer listening on ${config.port}`);
});
