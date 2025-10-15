import express from "express";
import { 
    createAuditTrail, 
    getEntityAuditTrails, 
    getUserActivityAuditTrails,
    getGroupActivityAuditTrails
} from "../controller/auditTrail.controller.js";
import  authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// Create audit trail entry
router.post("/", createAuditTrail);

// Get audit trails for a specific entity
router.get("/entity/:entityType/:entityId", getEntityAuditTrails);

// Get user activity audit trails
router.get("/user/:userId", getUserActivityAuditTrails);

// Get group activity audit trails
router.get("/group/:groupId", getGroupActivityAuditTrails);

export default router;