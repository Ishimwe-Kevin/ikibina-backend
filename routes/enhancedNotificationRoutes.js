import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import {
    createNotification,
    getUserNotifications,
    getGroupNotifications,
    markNotificationAsRead,
    generatePaymentReminders,
    updateNotificationPreferences
} from "../controller/enhancedNotification.controller.js";

const router = express.Router();

// Create a notification
router.post("/", authMiddleware, createNotification);

// Get notifications for current user
router.get("/user", authMiddleware, getUserNotifications);

// Get notifications for a group
router.get("/group/:groupId", authMiddleware, getGroupNotifications);

// Mark notification as read
router.put("/:notificationId/read", authMiddleware, markNotificationAsRead);

// Generate payment reminders for a group
router.post("/reminders/:groupId", authMiddleware, generatePaymentReminders);

// Update user notification preferences
router.put("/preferences", authMiddleware, updateNotificationPreferences);

export default router;