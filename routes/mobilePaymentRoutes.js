import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import {
    initiateContributionPayment,
    initiateWithdrawalPayment,
    initiateLoanRepayment,
    initiateLoanWithdrawal,
    getMobilePaymentHistory,
    getMobilePaymentStatus
} from "../controller/mobilePayment.controller.js";

const router = express.Router();

// Mobile payment for contributions
router.post("/contribution", authMiddleware, initiateContributionPayment);

// Mobile payment for withdrawals
router.post("/withdrawal", authMiddleware, initiateWithdrawalPayment);

// Mobile payment for loan repayments
router.post("/loan-repayment", authMiddleware, initiateLoanRepayment);

// Mobile payment for loan withdrawals
router.post("/loan-withdrawal", authMiddleware, initiateLoanWithdrawal);

// Get user's mobile payment history
router.get("/history", authMiddleware, getMobilePaymentHistory);

// Get specific mobile payment status
router.get("/status/:paymentId", authMiddleware, getMobilePaymentStatus);

export default router;
