import { Router } from "express";
import type { ViewerConfig } from "../../shared/types";
import { getAssetInfo } from "../services/readContent";

export function createAssetRouter(config: ViewerConfig) {
  const router = Router();

  router.get("/", async (req, res, next) => {
    try {
      const requestedPath = String(req.query.path || "");
      const { absolutePath, mimeType } = await getAssetInfo(requestedPath, config);
      res.type(mimeType);
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.sendFile(absolutePath);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
