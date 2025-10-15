import express from "express";
import authMiddleware, { isGroupAdmin, isSuperAdmin } from "../middleware/authMiddleware.js";
import {
  createNotification,
  getMyNotifications,
  markAsRead
} from "../controller/notification.controller.js";

const router = express.Router();

// Create a notification (groupadmin or superadmin)
router.post("/", authMiddleware, (req, res, next) => {
  if (["groupadmin", "superadmin"].includes(req.user.role.toLowerCase())) {
    return next();
  }
  return res.status(403).json({ msg: "Access denied" });
}, createNotification);

// Get my notifications
router.get("/my", authMiddleware, getMyNotifications);

// Mark as read
router.put("/:id/read", authMiddleware, markAsRead);

export default router;
