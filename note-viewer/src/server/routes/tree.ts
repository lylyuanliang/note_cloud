import { Router } from "express";
import type { ViewerConfig } from "../../shared/types";
import { scanTree } from "../services/scanRepository";

export function createTreeRouter(config: ViewerConfig) {
  const router = Router();

  router.get("/", async (_req, res, next) => {
    try {
      res.json(await scanTree(config));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
