import Contribution from "../models/contribution.model.js";
import Group from "../models/group.model.js";
import User from "../models/User.js";

// Create a new contribution
const createContribution = async (req, res) => {
  try {
    const { groupId, amount, description } = req.body;

    if (!groupId || !amount) {
      return res.status(400).json({ msg: "Please provide group and amount" });
    }

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ msg: "Group not found" });

    const contribution = new Contribution({
      contributor: req.user.id,
      group: groupId,
      amount,
      description,
      status: "pending",
      type: "contribution"
    });

    await contribution.save();
    
    // Populate the response
    await contribution.populate("group", "name description");
    await contribution.populate("contributor", "name email");
    
    res.status(201).json({ msg: "Contribution submitted", contribution });
  } catch (err) {
    console.error("❌ Error creating contribution:", err.message);
    res.status(500).json({ msg: "Server error creating contribution" });
  }
};

// Create a withdrawal request
const createWithdrawal = async (req, res) => {
  try {
    const { groupId, amount, withdrawalReason } = req.body;

    if (!groupId || !amount) {
      return res.status(400).json({ msg: "Please provide group and amount" });
    }

    if (amount <= 0) {
      return res.status(400).json({ msg: "Withdrawal amount must be greater than 0" });
    }

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ msg: "Group not found" });

    const availableBalance = await getUserAvailableBalance(req.user.id, groupId);
    if (availableBalance < amount) {
      return res.status(400).json({ 
        msg: `Insufficient balance. Available: $${availableBalance.toFixed(2)}, Requested: $${amount}` 
      });
    }

    const withdrawal = new Contribution({
      contributor: req.user.id,
      group: groupId,
      amount,
      description: withdrawalReason,
      status: "pending",
      type: "withdrawal",
      withdrawalReason
    });

    await withdrawal.save();
    
    // Populate the response
    await withdrawal.populate("group", "name description");
    await withdrawal.populate("contributor", "name email");
    
    res.status(201).json({ msg: "Withdrawal request submitted", withdrawal });
  } catch (err) {
    console.error("❌ Error creating withdrawal:", err.message);
    res.status(500).json({ msg: "Server error creating withdrawal" });
  }
};

// Helper: Get user's available balance
const getUserAvailableBalance = async (userId, groupId) => {
  try {
    const contributions = await Contribution.find({
      contributor: userId,
      group: groupId,
      status: "approved",
      type: "contribution"
    });

    const withdrawals = await Contribution.find({
      contributor: userId,
      group: groupId,
      status: "approved",
      type: "withdrawal"
    });

    const totalContributions = contributions.reduce((sum, c) => sum + c.amount, 0);
    const totalWithdrawals = withdrawals.reduce((sum, w) => sum + w.amount, 0);

    return Math.max(0, totalContributions - totalWithdrawals);
  } catch (error) {
    console.error("Error calculating available balance:", error);
    return 0;
  }
};

// Get available balance for a group
const getAvailableBalance = async (req, res) => {
  try {
    const { groupId } = req.params;
    if (!groupId) {
      return res.status(400).json({ msg: "Group ID is required" });
    }

    const balance = await getUserAvailableBalance(req.user.id, groupId);
    res.json({ availableBalance: balance });
  } catch (err) {
    console.error("❌ Error getting available balance:", err.message);
    res.status(500).json({ msg: "Server error getting available balance" });
  }
};

// Get contributions of logged-in user
const getMyContributions = async (req, res) => {
  try {
    const contributions = await Contribution.find({ contributor: req.user.id })
      .populate("group", "name description")   // group info
      .populate("contributor", "name email")   // user info
      .populate({                              // group admin info
        path: "group",
        populate: { path: "groupadmin", select: "name email" }
      })
      .sort({ createdAt: -1 });

    console.log(`✅ Loaded ${contributions.length} contributions for user ${req.user.email}`);
    res.json(contributions);
  } catch (err) {
    console.error("❌ Error fetching user contributions:", err.message);
    res.status(500).json({ msg: "Server error fetching your contributions" });
  }
};

// Get all contributions with role-based filtering
const getAllContributions = async (req, res) => {
  try {
    const user = req.user;
    
    console.log(`📊 Fetching contributions - Requested by: ${user.email} (${user.role})`);

    let contributions;
    let query = Contribution.find();

    // Apply role-based filtering
    if (user.role === "superAdmin" || user.role === "admin" || user.role === "bookkeeper") {
      // Super admin, admin, and bookkeeper can see all contributions
      console.log(`✅ ${user.role}: Loading ALL contributions`);
      
    } else if (user.role === "groupadmin") {
      // Group admin can only see contributions from their group members
      console.log(`👥 GroupAdmin: Filtering contributions for user's groups`);
      
      // Find groups where this user is the groupadmin
      const userGroups = await Group.find({ 
        groupadmin: user._id,
        status: "active"
      }).select('_id members');
      
      if (!userGroups || userGroups.length === 0) {
        console.log("❌ GroupAdmin: No active groups found for user");
        return res.json([]); // Return empty array if no groups found
      }

      // Get all member IDs from all groups where user is groupadmin
      const groupMemberIds = userGroups.flatMap(group => group.members);
      
      console.log(`✅ GroupAdmin: Managing ${userGroups.length} groups with ${groupMemberIds.length} total members`);

      // Filter contributions to only show those from group members
      query = Contribution.find({
        contributor: { $in: groupMemberIds }
      });
      
    } else {
      // Regular users should not reach this point due to route middleware, but handle gracefully
      console.log("❌ Unauthorized access attempt");
      return res.status(403).json({ message: "Access denied. Insufficient permissions." });
    }

    // Execute the query with population
    contributions = await query
      .populate("group", "name description groupadmin")
      .populate("contributor", "name email role")
      .sort({ createdAt: -1 });

    console.log(`✅ Found ${contributions.length} contributions for ${user.role}`);
    res.json(contributions);
    
  } catch (err) {
    console.error("❌ Error fetching contributions:", err.message);
    res.status(500).json({ message: "Server error fetching contributions" });
  }
};

// Update contribution status with group admin checks
const updateContributionStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const user = req.user;

    console.log(`🔄 Updating contribution ${id} status to ${status} by ${user.email} (${user.role})`);

    if (!["pending", "approved", "rejected"].includes(status.toLowerCase())) {
      return res.status(400).json({ msg: "Invalid status" });
    }

    // Find the contribution with populated data
    const contribution = await Contribution.findById(id)
      .populate("contributor", "name email role")
      .populate("group", "name groupadmin");

    if (!contribution) {
      return res.status(404).json({ msg: "Contribution not found" });
    }

    // Check group admin permissions
    if (user.role === "groupadmin") {
      // Find groups where this user is groupadmin
      const userGroups = await Group.find({ 
        groupadmin: user._id,
        status: "active"
      });

      if (!userGroups || userGroups.length === 0) {
        return res.status(403).json({ 
          msg: "No active groups found for this group admin" 
        });
      }

      // Check if contribution's group is managed by this group admin
      const canManageContribution = userGroups.some(group => 
        group._id.toString() === contribution.group._id.toString()
      );

      if (!canManageContribution) {
        return res.status(403).json({ 
          msg: "You can only manage contributions from your groups" 
        });
      }
    }

    // Update the contribution
    contribution.status = status.toLowerCase();
    contribution.processedBy = user._id;
    contribution.updatedAt = new Date();
    
    await contribution.save();

    // Populate the response
    await contribution.populate("group", "name description groupadmin");
    await contribution.populate("contributor", "name email role");
    await contribution.populate("processedBy", "name email");

    console.log(`✅ Contribution ${id} status updated to ${status}`);
    res.json({ 
      msg: "Contribution status updated successfully", 
      contribution 
    });
    
  } catch (err) {
    console.error("❌ Error updating contribution status:", err.message);
    res.status(500).json({ msg: "Server error updating contribution status" });
  }
};

// Add penalty to contribution with group admin checks
const addContributionPenalty = async (req, res) => {
  try {
    const { contributionId } = req.params;
    const { amount, reason, dueDate, type, status } = req.body;
    const user = req.user;

    console.log(`💰 Adding penalty to contribution ${contributionId} by ${user.email}`);

    const contribution = await Contribution.findById(contributionId)
      .populate("group", "name groupadmin")
      .populate("contributor", "name email");

    if (!contribution) {
      return res.status(404).json({ message: "Contribution not found" });
    }

    // Check group admin permissions
    if (user.role === "groupadmin") {
      const userGroups = await Group.find({ 
        groupadmin: user._id,
        status: "active"
      });

      if (!userGroups || userGroups.length === 0) {
        return res.status(403).json({ 
          message: "No active groups found for this group admin" 
        });
      }

      const canManageContribution = userGroups.some(group => 
        group._id.toString() === contribution.group._id.toString()
      );

      if (!canManageContribution) {
        return res.status(403).json({ 
          message: "You can only add penalties to contributions from your groups" 
        });
      }
    }

    // Validate penalty data
    if (!amount || !reason) {
      return res.status(400).json({ message: "Amount and reason are required" });
    }

    if (amount <= 0) {
      return res.status(400).json({ message: "Penalty amount must be greater than 0" });
    }

    const penalty = {
      amount: Number(amount),
      reason,
      dueDate: dueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Default 7 days from now
      type: type || "late_payment",
      status: status || "pending",
      createdBy: user._id,
      createdAt: new Date()
    };

    // Initialize penalties array if it doesn't exist
    if (!contribution.penalties) {
      contribution.penalties = [];
    }

    contribution.penalties.push(penalty);
    await contribution.save();

    // Populate the response
    await contribution.populate("group", "name groupadmin");
    await contribution.populate("contributor", "name email");
    await contribution.populate("penalties.createdBy", "name email");

    const newPenalty = contribution.penalties[contribution.penalties.length - 1];

    console.log(`✅ Penalty added successfully to contribution ${contributionId}`);
    res.status(201).json({ 
      message: "Penalty added successfully", 
      penalty: newPenalty,
      contribution
    });
  } catch (error) {
    console.error("❌ Error adding penalty:", error);
    res.status(500).json({ message: "Server error adding penalty" });
  }
};

// Update contribution penalty with group admin checks
const updateContributionPenalty = async (req, res) => {
  try {
    const { contributionId, penaltyId } = req.params;
    const { amount, reason, dueDate, type, status } = req.body;
    const user = req.user;

    console.log(`✏️ Updating penalty ${penaltyId} for contribution ${contributionId} by ${user.email}`);

    const contribution = await Contribution.findById(contributionId)
      .populate("group", "name groupadmin")
      .populate("contributor", "name email");

    if (!contribution) {
      return res.status(404).json({ message: "Contribution not found" });
    }

    // Check group admin permissions
    if (user.role === "groupadmin") {
      const userGroups = await Group.find({ 
        groupadmin: user._id,
        status: "active"
      });

      if (!userGroups || userGroups.length === 0) {
        return res.status(403).json({ 
          message: "No active groups found for this group admin" 
        });
      }

      const canManageContribution = userGroups.some(group => 
        group._id.toString() === contribution.group._id.toString()
      );

      if (!canManageContribution) {
        return res.status(403).json({ 
          message: "You can only manage penalties for contributions from your groups" 
        });
      }
    }

    // Find the penalty
    const penalty = contribution.penalties.id(penaltyId);
    if (!penalty) {
      return res.status(404).json({ message: "Penalty not found" });
    }

    // Validate update data
    if (amount !== undefined) {
      if (amount <= 0) {
        return res.status(400).json({ message: "Penalty amount must be greater than 0" });
      }
      penalty.amount = Number(amount);
    }

    if (reason) penalty.reason = reason;
    if (dueDate) penalty.dueDate = dueDate;
    if (type) penalty.type = type;
    if (status) penalty.status = status;
    
    penalty.updatedAt = new Date();

    await contribution.save();

    // Populate the response
    await contribution.populate("group", "name groupadmin");
    await contribution.populate("contributor", "name email");
    await contribution.populate("penalties.createdBy", "name email");

    console.log(`✅ Penalty ${penaltyId} updated successfully`);
    res.json({ 
      message: "Penalty updated successfully", 
      penalty,
      contribution
    });
  } catch (error) {
    console.error("❌ Error updating penalty:", error);
    res.status(500).json({ message: "Server error updating penalty" });
  }
};

// Delete contribution penalty with group admin checks
const deleteContributionPenalty = async (req, res) => {
  try {
    const { contributionId, penaltyId } = req.params;
    const user = req.user;

    console.log(`🗑️ Deleting penalty ${penaltyId} from contribution ${contributionId} by ${user.email}`);

    const contribution = await Contribution.findById(contributionId)
      .populate("group", "name groupadmin")
      .populate("contributor", "name email");

    if (!contribution) {
      return res.status(404).json({ message: "Contribution not found" });
    }

    // Check group admin permissions
    if (user.role === "groupadmin") {
      const userGroups = await Group.find({ 
        groupadmin: user._id,
        status: "active"
      });

      if (!userGroups || userGroups.length === 0) {
        return res.status(403).json({ 
          message: "No active groups found for this group admin" 
        });
      }

      const canManageContribution = userGroups.some(group => 
        group._id.toString() === contribution.group._id.toString()
      );

      if (!canManageContribution) {
        return res.status(403).json({ 
          message: "You can only manage penalties for contributions from your groups" 
        });
      }
    }

    // Find the penalty index
    const penaltyIndex = contribution.penalties.findIndex(
      penalty => penalty._id.toString() === penaltyId
    );

    if (penaltyIndex === -1) {
      return res.status(404).json({ message: "Penalty not found" });
    }

    // Remove the penalty
    contribution.penalties.splice(penaltyIndex, 1);
    await contribution.save();

    // Populate the response
    await contribution.populate("group", "name groupadmin");
    await contribution.populate("contributor", "name email");

    console.log(`✅ Penalty ${penaltyId} deleted successfully`);
    res.json({ 
      message: "Penalty deleted successfully",
      contribution
    });
  } catch (error) {
    console.error("❌ Error deleting penalty:", error);
    res.status(500).json({ message: "Server error deleting penalty" });
  }
};

// Helper function to calculate total penalties for a contribution
const calculateTotalPenalties = (contribution) => {
  if (!contribution.penalties || contribution.penalties.length === 0) return 0;
  return contribution.penalties.reduce((total, penalty) => total + (Number(penalty.amount) || 0), 0);
};

// Helper function to calculate pending penalties for a contribution
const calculatePendingPenalties = (contribution) => {
  if (!contribution.penalties || contribution.penalties.length === 0) return 0;
  return contribution.penalties
    .filter(penalty => penalty.status === "pending")
    .reduce((total, penalty) => total + (Number(penalty.amount) || 0), 0);
};

export { 
  createContribution, 
  createWithdrawal, 
  getAvailableBalance,
  getMyContributions, 
  getAllContributions, 
  updateContributionStatus,
  addContributionPenalty,
  updateContributionPenalty,
  deleteContributionPenalty,
  calculateTotalPenalties,
  calculatePendingPenalties
};