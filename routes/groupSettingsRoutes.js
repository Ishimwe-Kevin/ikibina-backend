import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import {
    updateGroupSettings,
    getGroupSettings,
    addGroupRule,
    updateGroupRule,
    deleteGroupRule
} from "../controller/groupSettings.controller.js";

const router = express.Router();

// Get group settings
router.get("/:groupId", authMiddleware, getGroupSettings);

// Update group settings
router.put("/:groupId", authMiddleware, updateGroupSettings);

// Add a new rule
router.post("/:groupId/rules", authMiddleware, addGroupRule);

// Update a rule
router.put("/:groupId/rules/:ruleId", authMiddleware, updateGroupRule);

// Delete a rule
router.delete("/:groupId/rules/:ruleId", authMiddleware, deleteGroupRule);

export default router;