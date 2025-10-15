import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { getGroupReport } from "../controller/report.controller.js";

const router = express.Router();

/**
 * GET /api/reports/groups
 * - SuperAdmin → full system + group reports
 * - Admin → full system + group reports  
 * - Bookkeeper → financial reports access
 * - GroupAdmin → only their group reports
 */
router.get(
  "/groups",
  authMiddleware,
  (req, res, next) => {
    const allowedRoles = ["superAdmin", "admin", "bookkeeper", "groupadmin"];
    if (allowedRoles.includes(req.user.role)) {
      return next();
    }
    return res.status(403).json({ message: "Access denied. Insufficient permissions." });
  },
  getGroupReport
);

export default router;