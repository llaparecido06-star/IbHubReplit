import { Router, type IRouter } from "express";
import healthRouter from "./health";
import usersRouter from "./users";
import adminRouter from "./admin";
import pushRouter from "./push";
import stripeRouter from "./stripe";
import presentationsRouter from "./presentations";
import uploadsRouter from "./uploads";
import marketRouter from "./market";
import communityRouter from "./community";
import profileRouter from "./profile";
import wineImportsRouter from "./wineImports";
import messagesRouter from "./messages";

const router: IRouter = Router();

router.use(healthRouter);
router.use(usersRouter);
router.use(adminRouter);
router.use(pushRouter);
router.use(stripeRouter);
router.use(presentationsRouter);
router.use(uploadsRouter);
router.use(marketRouter);
router.use(communityRouter);
router.use(profileRouter);
router.use(wineImportsRouter);
router.use(messagesRouter);

export default router;
