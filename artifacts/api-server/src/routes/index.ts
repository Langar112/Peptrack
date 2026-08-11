import { Router } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import cyclesRouter from "./cycles.js";
import injectionEventsRouter from "./injection-events.js";
import journalRouter from "./journal.js";

const router = Router();

router.use("/healthz", healthRouter);
router.use("/auth", authRouter);
router.use("/cycles", cyclesRouter);
router.use("/injection-events", injectionEventsRouter);
router.use("/journal", journalRouter);

export default router;
