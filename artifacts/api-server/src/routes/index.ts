import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import sessionsRouter from "./sessions";
import pollsRouter from "./polls";
import deviceRouter from "./device";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use("/sessions", sessionsRouter);
router.use("/polls", pollsRouter);
router.use("/device", deviceRouter);
router.use("/network", deviceRouter);
router.use("/dashboard", dashboardRouter);

export default router;
