import Group from "../models/group.model.js";
import User from "../models/User.js";

// ----------------- CREATE GROUP -----------------
const createGroup = async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!req.user || !req.user._id) return res.status(401).json({ msg: "Unauthorized" });

    const isSuperAdmin = req.user.role === "superAdmin";

    const newGroup = new Group({
      name,
      description,
      creator: req.user._id, // Track who created the group
      groupadmin: isSuperAdmin ? req.user._id : null, // Only set admin for superAdmin created groups
      members: isSuperAdmin ? [req.user._id] : [], // Only add superAdmin as member if they created it
      pendingRequests: [],
      status: isSuperAdmin ? "active" : "pending" // All non-superAdmin created groups need approval
    });

    await newGroup.save();
    
    // Return appropriate message based on user role
    if (isSuperAdmin) {
      res.status(201).json({ 
        msg: "Group created and activated successfully", 
        group: newGroup 
      });
    } else {
      res.status(201).json({ 
        msg: "Group created successfully and pending approval from administrator", 
        group: newGroup 
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

// ----------------- GET ALL GROUPS -----------------
const getAllGroups = async (req, res) => {
  try {
    const groups = await Group.find();
    res.json(groups);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
};

// ----------------- GET GROUP BY ID -----------------
const getGroupById = async (req, res) => {
  try {
    const group = await Group.findById(req.params.id)
      .populate("members", "-password")
      .populate("pendingRequests", "-password");
    if (!group) return res.status(404).json({ msg: "Group not found" });
    res.json(group);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
};

// ----------------- DELETE GROUP -----------------
const deleteGroup = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedGroup = await Group.findByIdAndDelete(id);
    if (!deletedGroup) return res.status(404).json({ error: "Group not found" });
    res.json({ msg: "Group deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
};

// ----------------- REQUEST TO JOIN -----------------
const requestJoinGroup = async (req, res) => {
  try {
    if (req.user.role === "superAdmin") {
      return res.status(403).json({ msg: "SuperAdmin does not need to join groups" });
    }

    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ msg: "Group not found" });

    if (group.members.includes(req.user._id)) {
      return res.status(400).json({ msg: "User already a member" });
    }

    if (group.pendingRequests?.includes(req.user._id)) {
      return res.status(400).json({ msg: "Join request already pending" });
    }

    group.pendingRequests.push(req.user._id);

    // ✅ Temporary fix for old records missing creator
    if (!group.creator) {
      group.creator = req.user._id;
      await group.save({ validateBeforeSave: false });
    } else {
      await group.save();
    }

    res.json({ msg: "Join request submitted" });
  } catch (err) {
    console.error("Error in requestJoinGroup:", err.message);
    res.status(500).send("Server error");
  }
};


// ----------------- APPROVE JOIN REQUEST (admin/groupadmin) -----------------
const approveJoinRequest = async (req, res) => {
  try {
    const { groupId, userId } = req.params;
    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ msg: "Group not found" });

    if (!group.pendingRequests?.includes(userId)) return res.status(400).json({ msg: "No pending request from this user" });

    group.pendingRequests = group.pendingRequests.filter(id => id.toString() !== userId);
    group.members.push(userId);
    await group.save();

    res.json({ msg: "User added to group successfully" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
};

// ----------------- REJECT JOIN REQUEST (admin/groupadmin) -----------------
const rejectJoinRequest = async (req, res) => {
  try {
    const { groupId, userId } = req.params;
    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ msg: "Group not found" });

    if (!group.pendingRequests?.includes(userId)) return res.status(400).json({ msg: "No pending request from this user" });

    group.pendingRequests = group.pendingRequests.filter(id => id.toString() !== userId);
    await group.save();

    res.json({ msg: "Join request rejected" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
};

// ----------------- SUPERADMIN APPROVE GROUP -----------------
const approveGroup = async (req, res) => {
  try {
    if (req.user.role !== "superAdmin") return res.status(403).json({ msg: "Forbidden" });

    const group = await Group.findById(req.params.groupId);
    if (!group) return res.status(404).json({ msg: "Group not found" });

    // Get the creator to assign as groupadmin
    const creator = group.creator;
    if (!creator) return res.status(400).json({ msg: "Group creator not found" });

    // Update group status and set creator as admin
    group.status = "active";
    group.groupadmin = creator;
    
    // Add creator to members if not already there
    if (!group.members.includes(creator)) {
      group.members.push(creator);
    }
    
    await group.save();

    // Update the creator's role to groupadmin if they're not already a superAdmin
    const creatorUser = await User.findById(creator);
    if (creatorUser && creatorUser.role !== "superAdmin") {
      creatorUser.role = "groupadmin";
      await creatorUser.save();
    }

    res.json({ msg: "Group approved successfully", group });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
};

// ----------------- SUPERADMIN REJECT GROUP -----------------
const rejectGroup = async (req, res) => {
  try {
    if (req.user.role !== "superAdmin") return res.status(403).json({ msg: "Forbidden" });

    const { reason } = req.body;
    const group = await Group.findById(req.params.groupId);
    if (!group) return res.status(404).json({ msg: "Group not found" });

    group.status = "rejected";
    group.rejectionReason = reason || "Group request rejected by administrator";
    await group.save();

    res.json({ msg: "Group rejected successfully", group });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
};

// ----------------- OTHER MEMBER ACTIONS -----------------
const getGroupMembers = async (req, res) => {
  try {
    const group = await Group.findById(req.params.id).populate("members", "-password");
    if (!group) return res.status(404).json({ msg: "Group not found" });
    res.json(group.members);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
};

const removeGroupMember = async (req, res) => {
  try {
    const { groupId, userId } = req.params;
    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ msg: "Group not found" });

    if (!group.members.includes(userId)) return res.status(400).json({ msg: "User is not a member" });

    group.members = group.members.filter(memberId => memberId.toString() !== userId);
    await group.save();

    res.json({ msg: "Member removed successfully" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
};

const updateMemberRole = async (req, res) => {
  try {
    const { groupId, userId } = req.params;
    const { role } = req.body;

    console.log(`🔄 Updating member role - Group: ${groupId}, User: ${userId}, New Role: ${role}`);

    // Validate required fields
    if (!role) {
      return res.status(400).json({ message: "Role is required" });
    }

    // Validate role value - include all valid roles
    const validRoles = ["member", "groupadmin", "bookkeeper", "author", "admin", "superAdmin"];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ 
        message: `Invalid role. Must be one of: ${validRoles.join(", ")}` 
      });
    }

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if group exists
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    // Check if user is a member of the group
    const isMember = group.members.some(memberId => 
      memberId.toString() === userId.toString()
    );
    
    if (!isMember) {
      return res.status(400).json({ message: "User is not a member of this group" });
    }

    // Check permissions - only group admin or super admin can update roles
    const requester = req.user;
    const isGroupAdmin = group.groupadmin && group.groupadmin.toString() === requester._id.toString();
    const isSuperAdmin = requester.role === "superAdmin";
    
    if (!isGroupAdmin && !isSuperAdmin) {
      return res.status(403).json({ 
        message: "Only group administrators or super admins can update member roles" 
      });
    }

    // Prevent users from changing their own role if they're the group admin
    if (userId === requester._id.toString() && isGroupAdmin) {
      return res.status(400).json({ 
        message: "Group administrators cannot change their own role" 
      });
    }

    // Update user role
    user.role = role;
    await user.save();

    console.log(`✅ Member role updated successfully - User: ${user.email}, New Role: ${role}`);

    res.json({ 
      message: "Member role updated successfully", 
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    console.error("❌ Error updating member role:", err.message);
    res.status(500).json({ 
      message: "Server error updating member role",
      error: err.message 
    });
  }
};

// ----------------- EXPORTS -----------------
export {
  createGroup,
  getAllGroups,
  getGroupById,
  deleteGroup,
  requestJoinGroup,
  approveJoinRequest,
  rejectJoinRequest,
  approveGroup,
  rejectGroup,
  getGroupMembers,
  removeGroupMember,
  updateMemberRole
};
