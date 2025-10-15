import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import {
  createContribution,
  createWithdrawal,
  getAvailableBalance,
  getMyContributions,
  getAllContributions,
  updateContributionStatus,
  addContributionPenalty,
  updateContributionPenalty,
  deleteContributionPenalty
} from "../controller/contribution.controller.js";

const router = express.Router();

// Create a new contribution (any logged-in user)
router.post("/", authMiddleware, createContribution);

// Create a withdrawal request (any logged-in user)
router.post("/withdraw", authMiddleware, createWithdrawal);

// Get user's available balance for withdrawal
router.get("/balance/:groupId", authMiddleware, getAvailableBalance);

// Get contributions of logged-in user
router.get("/my", authMiddleware, getMyContributions);
router.get("/my-contributions", authMiddleware, getMyContributions);

// Get all contributions (admin, superadmin, bookkeeper, OR groupadmin)
router.get("/", authMiddleware, (req, res, next) => {
  const allowedRoles = ["superAdmin", "admin", "bookkeeper", "groupadmin"];
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ message: "Access denied. Insufficient permissions." });
  }
  next();
}, getAllContributions);

// Update contribution status (admin, superadmin, bookkeeper, OR groupadmin)
router.put("/:id/status", authMiddleware, (req, res, next) => {
  const allowedRoles = ["superAdmin", "admin", "bookkeeper", "groupadmin"];
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ message: "Access denied. Insufficient permissions." });
  }
  next();
}, updateContributionStatus);

// Penalty management routes for contributions
router.post("/:contributionId/penalties", authMiddleware, (req, res, next) => {
  const allowedRoles = ["superAdmin", "admin", "bookkeeper", "groupadmin"];
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ message: "Access denied. Insufficient permissions." });
  }
  next();
}, addContributionPenalty);

router.put("/:contributionId/penalties/:penaltyId", authMiddleware, (req, res, next) => {
  const allowedRoles = ["superAdmin", "admin", "bookkeeper", "groupadmin"];
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ message: "Access denied. Insufficient permissions." });
  }
  next();
}, updateContributionPenalty);

router.delete("/:contributionId/penalties/:penaltyId", authMiddleware, (req, res, next) => {
  const allowedRoles = ["superAdmin", "admin", "bookkeeper", "groupadmin"];
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ message: "Access denied. Insufficient permissions." });
  }
  next();
}, deleteContributionPenalty);

export default router;