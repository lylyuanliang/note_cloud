import express from "express";

const port = Number(process.env.PORT || 8080);
const publicBasePath = process.env.PUBLIC_BASE_PATH || "/";
const app = express();

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/runtime-config.js", (_req, res) => {
  res.type("application/javascript").send(
    `window.__NOTE_VIEWER_CONFIG__ = ${JSON.stringify({
      publicBasePath
    })};`
  );
});

app.listen(port, () => {
  console.log(`note-viewer listening on ${port}`);
});
