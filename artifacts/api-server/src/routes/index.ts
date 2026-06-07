import { Router, type IRouter } from "express";
import adminRouter from "./admin";
import authRouter from "./auth";
import conversationsRouter from "./conversations";
import friendsRouter from "./friends";
import healthRouter from "./health";
import notificationsRouter from "./notifications";
import supportRouter from "./support";
import usersRouter from "./users";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/users", usersRouter);
router.use("/friends", friendsRouter);
router.use("/conversations", conversationsRouter);
router.use("/support", supportRouter);
router.use("/notifications", notificationsRouter);
router.use("/admin", adminRouter);

export default router;
