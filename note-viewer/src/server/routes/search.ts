import { Router } from "express";
import type { ViewerConfig } from "../../shared/types";
import { scanTree } from "../services/scanRepository";
import { searchNotes } from "../services/searchIndex";

export function createSearchRouter(config: ViewerConfig) {
  const router = Router();

  router.get("/", async (req, res, next) => {
    try {
      const query = String(req.query.q || "");
      const tree = await scanTree(config);
      res.json(await searchNotes(query, tree, config));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
