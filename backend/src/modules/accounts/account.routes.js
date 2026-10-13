import { Router } from "express";
import { getAccount, getLedgerHistory } from "./account.controller.js";
import authenticate from "../../middleware/auth.middleware.js";

const router = Router();

router.get("/", authenticate, getAccount);
router.get("/ledger", authenticate, getLedgerHistory);

export default router;
