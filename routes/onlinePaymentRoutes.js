import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import {
    createOnlinePayment,
    getUserPayments,
    getGroupPayments,
    getPaymentById,
    processWithdrawal,
    cancelPayment
} from "../controller/onlinePayment.controller.js";

const router = express.Router();

// Create a new payment
router.post("/", authMiddleware, createOnlinePayment);

// Process withdrawal
router.post("/withdrawal", authMiddleware, processWithdrawal);

// Get all payments for current user
router.get("/user", authMiddleware, getUserPayments);

// Get all payments for a group
router.get("/group/:groupId", authMiddleware, getGroupPayments);

// Get payment by ID
router.get("/:paymentId", authMiddleware, getPaymentById);

// Cancel a pending payment
router.put("/:paymentId/cancel", authMiddleware, cancelPayment);

export default router;