import { Router } from "express";
import type { ViewerConfig } from "../../shared/types";
import { readTextFile } from "../services/readContent";

export function createFileRouter(config: ViewerConfig) {
  const router = Router();

  router.get("/", async (req, res, next) => {
    try {
      const requestedPath = String(req.query.path || "");
      res.json(await readTextFile(requestedPath, config));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
