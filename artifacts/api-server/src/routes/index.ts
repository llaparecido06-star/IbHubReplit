import { Router, type IRouter } from "express";
import healthRouter from "./health";
import usersRouter from "./users";
import adminRouter from "./admin";
import pushRouter from "./push";

const router: IRouter = Router();

router.use(healthRouter);
router.use(usersRouter);
router.use(adminRouter);
router.use(pushRouter);

export default router;
