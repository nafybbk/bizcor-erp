import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import superAdminRouter from "./superAdmin";
import businessesRouter from "./businesses";
import usersRouter from "./users";
import partiesRouter from "./parties";
import itemsRouter from "./items";
import mastersRouter from "./masters";
import vouchersRouter from "./vouchers";
import paymentsRouter from "./payments";
import inventoryRouter from "./inventory";
import accountingRouter from "./accounting";
import gstRouter from "./gst";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/super-admin", superAdminRouter);
router.use("/businesses", businessesRouter);
router.use("/users", usersRouter);
router.use("/parties", partiesRouter);
router.use("/items", itemsRouter);
router.use("/masters", mastersRouter);
router.use(vouchersRouter);
router.use("/payments", paymentsRouter);
router.use("/inventory", inventoryRouter);
router.use("/accounting", accountingRouter);
router.use("/gst", gstRouter);
router.use("/dashboard", dashboardRouter);

export default router;
