import { Router } from "express";
import type { RepositoryStore } from "../services/repositoryStore";

export function createPortalRouter(store: RepositoryStore) {
  const router = Router();

  router.get("/", async (_req, res, next) => {
    try {
      res.json(await store.getPortalData());
    } catch (error) {
      next(error);
    }
  });

  return router;
}
