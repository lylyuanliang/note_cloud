import { Router } from "express";
import type { RepositoryStore } from "../services/repositoryStore";

export function createSearchRouter(store: RepositoryStore) {
  const router = Router();

  router.get("/", async (req, res, next) => {
    try {
      const query = String(req.query.q || "");
      res.json(await store.search(query));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
