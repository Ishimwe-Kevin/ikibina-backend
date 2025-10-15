import express from "express";
import authMiddleware, { isGroupAdmin, isSuperAdmin } from "../middleware/authMiddleware.js";
import Group from "../models/group.model.js";
import User from "../models/User.js";
import {
  createGroup,
  getAllGroups,
  getGroupById,
  deleteGroup,
  requestJoinGroup,
  approveJoinRequest,
  rejectJoinRequest,
  getGroupMembers,
  removeGroupMember,
  updateMemberRole,
  approveGroup,
  rejectGroup
} from "../controller/group.controller.js";

const router = express.Router();

// ----------------- GROUP ROUTES -----------------

router.post("/", authMiddleware, createGroup);
router.get("/", authMiddleware, getAllGroups);
router.get("/:id", authMiddleware, getGroupById);
router.delete("/:id", authMiddleware, deleteGroup);
router.post("/:id/join", authMiddleware, requestJoinGroup);
router.put("/:groupId/requests/:userId/approve", authMiddleware, approveJoinRequest);
router.put("/:groupId/requests/:userId/reject", authMiddleware, rejectJoinRequest);
router.get("/:id/members", authMiddleware, getGroupMembers);
router.delete("/:groupId/members/:userId", authMiddleware, removeGroupMember);
router.put("/:groupId/members/:userId/role", authMiddleware, updateMemberRole);

// ----------------- PENDING GROUP REQUESTS ROUTES -----------------

// Get all pending group creation requests (superAdmin only)
router.get("/pending-requests", authMiddleware, isSuperAdmin, async (req, res) => {
  try {
    console.log("🔍 Fetching pending group requests for superAdmin:", req.user.email);
    
    // Find all groups with status "pending"
    const pendingGroups = await Group.find({ status: "pending" })
      .populate("creator", "name email role")
      .populate("members", "name email")
      .populate("pendingRequests", "name email")
      .sort({ createdAt: -1 });
    
    console.log(`✅ Found ${pendingGroups.length} pending groups`);
    
    res.json(pendingGroups);
  } catch (error) {
    console.error("❌ Error fetching pending group requests:", error);
    res.status(500).json({ 
      message: "Server error fetching pending group requests",
      error: error.message 
    });
  }
});

// Approve group creation request (superAdmin only)
router.put("/requests/:requestId/approve", authMiddleware, isSuperAdmin, async (req, res) => {
  try {
    const { requestId } = req.params;
    console.log(`🔄 Approving group request: ${requestId}`);
    
    const group = await Group.findById(requestId).populate("creator");
    if (!group) {
      return res.status(404).json({ message: "Group request not found" });
    }

    if (group.status !== "pending") {
      return res.status(400).json({ message: "Group is not in pending status" });
    }

    // Update group status to active and set creator as groupadmin
    group.status = "active";
    group.groupadmin = group.creator._id;
    
    // Ensure creator is in members array
    if (!group.members.includes(group.creator._id)) {
      group.members.push(group.creator._id);
    }
    
    await group.save();

    // Update creator's role to groupadmin if they're not superAdmin
    if (group.creator.role !== "superAdmin") {
      await User.findByIdAndUpdate(group.creator._id, { role: "groupadmin" });
    }

    console.log(`✅ Group approved: ${group.name}`);
    res.json({ 
      message: "Group creation approved successfully", 
      group 
    });
  } catch (error) {
    console.error("❌ Error approving group request:", error);
    res.status(500).json({ message: "Server error approving group request" });
  }
});

// Reject group creation request (superAdmin only)
router.put("/requests/:requestId/reject", authMiddleware, isSuperAdmin, async (req, res) => {
  try {
    const { requestId } = req.params;
    const { reason } = req.body;

    console.log(`🗑️ Rejecting group request: ${requestId}`);
    
    const group = await Group.findById(requestId);
    if (!group) {
      return res.status(404).json({ message: "Group request not found" });
    }

    // Update group status to rejected
    group.status = "rejected";
    group.rejectionReason = reason || "No reason provided";
    await group.save();

    console.log(`✅ Group rejected: ${group.name}`);
    res.json({ message: "Group creation rejected successfully" });
  } catch (error) {
    console.error("❌ Error rejecting group request:", error);
    res.status(500).json({ message: "Server error rejecting group request" });
  }
});

// ----------------- SUPERADMIN GROUP ACTIONS -----------------

router.put("/:groupId/approve", authMiddleware, isSuperAdmin, approveGroup);
router.delete("/:groupId/reject", authMiddleware, isSuperAdmin, rejectGroup);

/// Add a new member by email (groupAdmin or superAdmin)
router.post("/:groupId/members", authMiddleware, async (req, res) => {
  try {
    const { email, role } = req.body;
    const { groupId } = req.params;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    const requester = req.user; 
    
    // Check if requester is superAdmin OR has groupAdmin role
    const isAdminOrSuper = requester.role === "superAdmin" || requester.role === "groupadmin";
    
    if (!isAdminOrSuper) {
      return res.status(403).json({ message: "Unauthorized to add members" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if user is already a member
    const isAlreadyMember = group.members.some(memberId => 
      memberId.toString() === user._id.toString()
    );
    
    if (isAlreadyMember) {
      return res.status(400).json({ message: "User is already a member" });
    }

    // Add user to members array
    group.members.push(user._id);
    await group.save();

    res.status(200).json({ message: "Member added successfully", group });
  } catch (err) {
    console.error("Error adding member:", err);
    res.status(500).json({ message: "Server error" });
  }
});
export default router;