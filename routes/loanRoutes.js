import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import {
  RequestLoan,
  GetMyLoans,
  GetAllLoans,
  ApproveLoan,
  ActivateLoan,
  RejectLoan,
  RepayLoan,
  WithdrawLoan,
  GetLoanWithdrawals,
  AddPenalty,
  UpdatePenaltyStatus,
  PayPenalty,
  MarkAsNonPerforming,
  DeletePenalty
} from "../controller/loan.controller.js";

const router = express.Router();

// Borrower requests a new loan
router.post("/request", authMiddleware, RequestLoan);

// Borrower views their own loans
router.get("/myloans", authMiddleware, GetMyLoans);

// Admin, superadmin, bookkeeper, OR groupadmin views all loans
router.get("/", authMiddleware, (req, res, next) => {
  const allowedRoles = ["superAdmin", "admin", "bookkeeper", "groupadmin"];
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ message: "Access denied. Insufficient permissions." });
  }
  next();
}, GetAllLoans);

// Admin, superadmin, bookkeeper, OR groupadmin approves a loan
router.put("/:id/approve", authMiddleware, (req, res, next) => {
  const allowedRoles = ["superAdmin", "admin", "bookkeeper", "groupadmin"];
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ message: "Access denied. Insufficient permissions." });
  }
  next();
}, ApproveLoan);

// Admin, superadmin, bookkeeper, OR groupadmin activates a loan
router.put("/:id/activate", authMiddleware, (req, res, next) => {
  const allowedRoles = ["superAdmin", "admin", "bookkeeper", "groupadmin"];
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ message: "Access denied. Insufficient permissions." });
  }
  next();
}, ActivateLoan);

// Admin, superadmin, bookkeeper, OR groupadmin rejects a loan
router.put("/:id/reject", authMiddleware, (req, res, next) => {
  const allowedRoles = ["superAdmin", "admin", "bookkeeper", "groupadmin"];
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ message: "Access denied. Insufficient permissions." });
  }
  next();
}, RejectLoan);

// Borrower repays a loan, or admin/superadmin/bookkeeper/groupadmin can record repayment
router.put("/:id/repay", authMiddleware, RepayLoan);

// Borrower withdraws from an approved loan
router.put("/:id/withdraw", authMiddleware, WithdrawLoan);

// Get loan withdrawal history
router.get("/:id/withdrawals", authMiddleware, GetLoanWithdrawals);

// Penalty management routes (admin, superadmin, bookkeeper, OR groupadmin only)
router.post("/:id/penalties", authMiddleware, (req, res, next) => {
  const allowedRoles = ["superAdmin", "admin", "bookkeeper", "groupadmin"];
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ message: "Access denied. Insufficient permissions." });
  }
  next();
}, AddPenalty);

router.put("/:id/penalties/:penaltyId/status", authMiddleware, (req, res, next) => {
  const allowedRoles = ["superAdmin", "admin", "bookkeeper", "groupadmin"];
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ message: "Access denied. Insufficient permissions." });
  }
  next();
}, UpdatePenaltyStatus);

router.put("/:id/penalties/:penaltyId/pay", authMiddleware, PayPenalty);

router.delete("/:id/penalties/:penaltyId", authMiddleware, (req, res, next) => {
  const allowedRoles = ["superAdmin", "admin", "bookkeeper", "groupadmin"];
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ message: "Access denied. Insufficient permissions." });
  }
  next();
}, DeletePenalty);

// Non-performing loan routes (admin, superadmin, bookkeeper, OR groupadmin only)
router.post("/:id/non-performing", authMiddleware, (req, res, next) => {
  const allowedRoles = ["superAdmin", "admin", "bookkeeper", "groupadmin"];
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ message: "Access denied. Insufficient permissions." });
  }
  next();
}, MarkAsNonPerforming);

export default router;