import { Router } from "express";
import type { RepositoryStore } from "../services/repositoryStore";

export function createTreeRouter(store: RepositoryStore) {
  const router = Router();

  router.get("/", async (_req, res, next) => {
    try {
      res.json(await store.getTree());
    } catch (error) {
      next(error);
    }
  });

  return router;
}
