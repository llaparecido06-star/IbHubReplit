import { Router, type IRouter } from "express";
import healthRouter from "./health";
import usersRouter from "./users";
import adminRouter from "./admin";
import pushRouter from "./push";
import stripeRouter from "./stripe";

const router: IRouter = Router();

router.use(healthRouter);
router.use(usersRouter);
router.use(adminRouter);
router.use(pushRouter);
router.use(stripeRouter);

export default router;
