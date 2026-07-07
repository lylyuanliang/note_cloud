import { Router } from "express";
import { addEventsClient } from "../services/watchRepository";

export function createEventsRouter() {
  const router = Router();

  router.get("/", (_req, res) => {
    addEventsClient(res);
  });

  return router;
}
