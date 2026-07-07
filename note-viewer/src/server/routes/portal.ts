import { Router } from "express";
import type { ViewerConfig } from "../../shared/types";
import { buildPortalData } from "../services/scanRepository";

export function createPortalRouter(config: ViewerConfig) {
  const router = Router();

  router.get("/", async (_req, res, next) => {
    try {
      res.json(await buildPortalData(config));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
