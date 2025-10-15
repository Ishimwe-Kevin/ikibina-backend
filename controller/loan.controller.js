import Loan from "../models/loan.model.js";
import User from "../models/User.js";
import Group from "../models/group.model.js";

// Helper to check admin/superadmin/groupadmin roles
const isAdmin = (role) => ["superadmin", "admin", "bookkeeper", "groupadmin"].includes(role?.toLowerCase());

// Helper to check if user is in group
const isUserInGroup = async (userId, groupId) => {
  const group = await Group.findById(groupId);
  if (!group) return false;
  
  return group.members.some(member => 
    member.toString() === userId.toString()
  );
};

// Helper to check if user is group admin of the loan's group
const isGroupAdminOfLoan = async (userId, loan) => {
  const group = await Group.findById(loan.groupId);
  if (!group) return false;
  
  return group.groupadmin?.toString() === userId.toString();
};

// Request a new loan
const RequestLoan = async (req, res) => {
  try {
    const { amount, interestRate, termMonths, groupId, purpose } = req.body;
    
    if (!amount || !interestRate || !termMonths || !groupId || !purpose) {
      return res.status(400).json({ msg: "Please provide all required fields" });
    }

    // Check if user is member of the group
    const userInGroup = await isUserInGroup(req.user.id, groupId);
    if (!userInGroup) {
      return res.status(403).json({ msg: "You must be a member of the group to request a loan" });
    }

    const newLoan = new Loan({
      amount,
      interestRate,
      termMonths,
      purpose,
      groupId,
      borrower: req.user.id
    });

    await newLoan.save();
    
    // Populate borrower and group details
    await newLoan.populate('borrower', 'name email');
    await newLoan.populate('groupId', 'name');
    
    res.status(201).json(newLoan);
  } catch (error) {
    res.status(500).json({ msg: "Server error", error: error.message });
  }
};

// Get loans of the logged-in user
const GetMyLoans = async (req, res) => {
  try {
    const { include } = req.query;
    const populateFields = ['borrower', 'groupId'];
    
    if (include && include.includes('penalties')) {
      populateFields.push('penalties');
    }
    if (include && include.includes('nonPerformingRecords')) {
      populateFields.push('nonPerformingRecords');
    }

    const loans = await Loan.find({ borrower: req.user.id })
      .populate('borrower', 'name email')
      .populate('groupId', 'name')
      .populate('penalties')
      .populate('nonPerformingRecords')
      .sort({ createdAt: -1 });

    res.json(loans);
  } catch (error) {
    res.status(500).json({ msg: "Server error", error: error.message });
  }
};

// Get all loans with role-based filtering
const GetAllLoans = async (req, res) => {
  try {
    const user = req.user;
    
    console.log(`📊 Fetching loans - Requested by: ${user.email} (${user.role})`);

    let loans;
    let query = {};

    // Apply role-based filtering
    if (user.role === "superAdmin" || user.role === "admin" || user.role === "bookkeeper") {
      // Super admin, admin, and bookkeeper can see all loans
      console.log(`✅ ${user.role}: Loading ALL loans`);
      
    } else if (user.role === "groupadmin") {
      // Group admin can only see loans from their group members
      console.log(`👥 GroupAdmin: Filtering loans for user's groups`);
      
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

      // Filter loans to only show those from group members
      query.borrower = { $in: groupMemberIds };
      
    } else {
      // Regular users should not reach this point due to route middleware, but handle gracefully
      console.log("❌ Unauthorized access attempt");
      return res.status(403).json({ message: "Access denied. Insufficient permissions." });
    }

    // Apply additional filters from query params
    const { include, status, groupId } = req.query;
    
    if (status && status !== 'all') {
      query.status = status;
    }
    
    if (groupId) {
      query.groupId = groupId;
    }

    const populateFields = ['borrower', 'groupId'];
    
    if (include && include.includes('penalties')) {
      populateFields.push('penalties');
    }
    if (include && include.includes('nonPerformingRecords')) {
      populateFields.push('nonPerformingRecords');
    }

    // Execute the query
    loans = await Loan.find(query)
      .populate('borrower', 'name email role')
      .populate('groupId', 'name groupadmin')
      .populate('penalties')
      .populate('nonPerformingRecords')
      .populate('approvedBy', 'name')
      .populate('rejectedBy', 'name')
      .sort({ createdAt: -1 });

    console.log(`✅ Found ${loans.length} loans for ${user.role}`);
    res.json(loans);
  } catch (error) {
    console.error("❌ Error fetching loans:", error.message);
    res.status(500).json({ message: "Server error fetching loans", error: error.message });
  }
};

// Approve a loan (admin only) - UPDATED FOR GROUPADMIN
const ApproveLoan = async (req, res) => {
  try {
    const loan = await Loan.findById(req.params.id)
      .populate('groupId', 'name groupadmin');
    
    if (!loan) return res.status(404).json({ msg: "Loan not found" });

    // Check permissions - group admin can only approve loans from their groups
    if (req.user.role === "groupadmin") {
      const isAdminOfLoanGroup = await isGroupAdminOfLoan(req.user.id, loan);
      if (!isAdminOfLoanGroup) {
        return res.status(403).json({ 
          msg: "You can only approve loans from your groups" 
        });
      }
    } else if (!isAdmin(req.user.role)) {
      return res.status(403).json({ msg: "Access denied" });
    }

    if (loan.status === "approved" || loan.status === "active") {
      return res.status(400).json({ msg: "Loan is already approved" });
    }

    if (loan.status === "rejected") {
      return res.status(400).json({ msg: "Cannot approve a rejected loan" });
    }

    loan.status = "approved";
    loan.approvedBy = req.user.id;
    loan.disbursementDate = new Date();
    
    // Set the next payment date (first payment due in 1 month)
    const nextPayment = new Date();
    nextPayment.setMonth(nextPayment.getMonth() + 1);
    loan.nextPayment = nextPayment;
    
    await loan.save();
    
    await loan.populate('borrower', 'name email');
    await loan.populate('groupId', 'name');
    await loan.populate('approvedBy', 'name');
    
    res.json({ msg: "Loan approved", loan });
  } catch (error) {
    res.status(500).json({ msg: "Server error", error: error.message });
  }
};

// Activate a loan (after disbursement) - UPDATED FOR GROUPADMIN
const ActivateLoan = async (req, res) => {
  try {
    const loan = await Loan.findById(req.params.id)
      .populate('groupId', 'name groupadmin');
    
    if (!loan) return res.status(404).json({ msg: "Loan not found" });

    // Check permissions - group admin can only activate loans from their groups
    if (req.user.role === "groupadmin") {
      const isAdminOfLoanGroup = await isGroupAdminOfLoan(req.user.id, loan);
      if (!isAdminOfLoanGroup) {
        return res.status(403).json({ 
          msg: "You can only activate loans from your groups" 
        });
      }
    } else if (!isAdmin(req.user.role)) {
      return res.status(403).json({ msg: "Access denied" });
    }

    if (loan.status !== "approved") {
      return res.status(400).json({ msg: "Only approved loans can be activated" });
    }

    loan.status = "active";
    await loan.save();
    
    await loan.populate('borrower', 'name email');
    await loan.populate('groupId', 'name');
    
    res.json({ msg: "Loan activated", loan });
  } catch (error) {
    res.status(500).json({ msg: "Server error", error: error.message });
  }
};

// Reject a loan (admin only) - UPDATED FOR GROUPADMIN
const RejectLoan = async (req, res) => {
  try {
    const loan = await Loan.findById(req.params.id)
      .populate('groupId', 'name groupadmin');
    
    if (!loan) return res.status(404).json({ msg: "Loan not found" });

    // Check permissions - group admin can only reject loans from their groups
    if (req.user.role === "groupadmin") {
      const isAdminOfLoanGroup = await isGroupAdminOfLoan(req.user.id, loan);
      if (!isAdminOfLoanGroup) {
        return res.status(403).json({ 
          msg: "You can only reject loans from your groups" 
        });
      }
    } else if (!isAdmin(req.user.role)) {
      return res.status(403).json({ msg: "Access denied" });
    }

    if (loan.status === "rejected") {
      return res.status(400).json({ msg: "Loan is already rejected" });
    }

    const { rejectionReason } = req.body;

    loan.status = "rejected";
    loan.rejectedBy = req.user.id;
    loan.rejectionReason = rejectionReason || "No reason provided";
    
    await loan.save();
    
    await loan.populate('borrower', 'name email');
    await loan.populate('groupId', 'name');
    await loan.populate('rejectedBy', 'name');
    
    res.json({ msg: "Loan rejected", loan });
  } catch (error) {
    res.status(500).json({ msg: "Server error", error: error.message });
  }
};

// Repay a loan - UPDATED FOR GROUPADMIN
const RepayLoan = async (req, res) => {
  try {
    const loan = await Loan.findById(req.params.id);
    if (!loan) return res.status(404).json({ msg: "Loan not found" });

    // Only borrower or admin can repay
    if (loan.borrower.toString() !== req.user.id && !isAdmin(req.user.role)) {
      return res.status(403).json({ msg: "Access denied" });
    }

    if (!["approved", "active"].includes(loan.status)) {
      return res.status(400).json({ msg: "Only approved or active loans can be repaid" });
    }

    const { amount, paymentMethod = "cash", transactionId } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ msg: "Please provide a valid repayment amount" });
    }

    const totalOwed = loan.amount + (loan.amount * loan.interestRate / 100);
    const currentRepaid = loan.repaidAmount || 0;

    if (currentRepaid + amount > totalOwed) {
      return res.status(400).json({ msg: "Repayment exceeds total owed" });
    }

    // Add repayment to the array
    loan.repayments.push({ 
      amount, 
      date: new Date(),
      paymentMethod,
      transactionId
    });
    
    // Update the total repaid amount
    loan.repaidAmount = currentRepaid + amount;

    // Check if loan is fully repaid
    if (loan.repaidAmount >= totalOwed) {
      loan.status = "completed";
      loan.completionDate = new Date();
    } else {
      // Update next payment date (move forward by one month)
      if (loan.nextPayment) {
        const nextPayment = new Date(loan.nextPayment);
        nextPayment.setMonth(nextPayment.getMonth() + 1);
        loan.nextPayment = nextPayment;
      }
    }

    await loan.save();
    
    await loan.populate('borrower', 'name email');
    await loan.populate('groupId', 'name');
    
    res.json({ msg: "Repayment recorded", loan });
  } catch (error) {
    res.status(500).json({ msg: "Server error", error: error.message });
  }
};

// Withdraw from loan (for approved loans)
const WithdrawLoan = async (req, res) => {
  try {
    const loan = await Loan.findById(req.params.id);
    if (!loan) return res.status(404).json({ msg: "Loan not found" });

    // Only borrower can withdraw
    if (loan.borrower.toString() !== req.user.id) {
      return res.status(403).json({ msg: "Access denied" });
    }

    if (loan.status !== "approved") {
      return res.status(400).json({ msg: "Only approved loans can be withdrawn from" });
    }

    const { amount, reason } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ msg: "Please provide a valid withdrawal amount" });
    }

    // Check available amount for withdrawal (loan amount minus already withdrawn)
    const availableForWithdrawal = loan.amount - (loan.withdrawnAmount || 0);
    
    if (amount > availableForWithdrawal) {
      return res.status(400).json({ 
        msg: `Insufficient amount available for withdrawal. Available: ${availableForWithdrawal.toLocaleString()} RWF, Requested: ${amount.toLocaleString()} RWF` 
      });
    }

    // Add withdrawal to the array
    loan.withdrawals.push({ 
      amount, 
      date: new Date(),
      reason: reason || "Loan withdrawal",
      approvedBy: req.user.id
    });
    
    // Update the total withdrawn amount
    loan.withdrawnAmount = (loan.withdrawnAmount || 0) + amount;

    await loan.save();
    
    await loan.populate('borrower', 'name email');
    await loan.populate('groupId', 'name');
    
    res.json({ msg: "Withdrawal recorded", loan });
  } catch (error) {
    res.status(500).json({ msg: "Server error", error: error.message });
  }
};

// Get loan withdrawal history
const GetLoanWithdrawals = async (req, res) => {
  try {
    const loan = await Loan.findById(req.params.id);
    if (!loan) return res.status(404).json({ msg: "Loan not found" });

    // Only borrower can view withdrawals
    if (loan.borrower.toString() !== req.user.id && !isAdmin(req.user.role)) {
      return res.status(403).json({ msg: "Access denied" });
    }

    res.json({ withdrawals: loan.withdrawals || [] });
  } catch (error) {
    res.status(500).json({ msg: "Server error", error: error.message });
  }
};

// Add penalty to loan (admin only) - UPDATED FOR GROUPADMIN
const AddPenalty = async (req, res) => {
  try {
    const loan = await Loan.findById(req.params.id)
      .populate('groupId', 'name groupadmin');
    
    if (!loan) return res.status(404).json({ msg: "Loan not found" });

    // Check permissions - group admin can only add penalties to loans from their groups
    if (req.user.role === "groupadmin") {
      const isAdminOfLoanGroup = await isGroupAdminOfLoan(req.user.id, loan);
      if (!isAdminOfLoanGroup) {
        return res.status(403).json({ 
          msg: "You can only add penalties to loans from your groups" 
        });
      }
    } else if (!isAdmin(req.user.role)) {
      return res.status(403).json({ msg: "Access denied" });
    }

    const { amount, reason, type = "late_payment", dueDate } = req.body;
    
    if (!amount || !reason) {
      return res.status(400).json({ msg: "Please provide penalty amount and reason" });
    }

    const penalty = {
      amount,
      reason,
      type,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      createdBy: req.user.id
    };

    loan.penalties.push(penalty);
    await loan.save();
    
    await loan.populate('borrower', 'name email');
    await loan.populate('groupId', 'name');
    await loan.populate('penalties');
    
    res.json({ msg: "Penalty added", loan });
  } catch (error) {
    res.status(500).json({ msg: "Server error", error: error.message });
  }
};

// Update penalty status (admin only) - UPDATED FOR GROUPADMIN
const UpdatePenaltyStatus = async (req, res) => {
  try {
    const loan = await Loan.findById(req.params.id)
      .populate('groupId', 'name groupadmin');
    
    if (!loan) return res.status(404).json({ msg: "Loan not found" });

    // Check permissions - group admin can only update penalties for loans from their groups
    if (req.user.role === "groupadmin") {
      const isAdminOfLoanGroup = await isGroupAdminOfLoan(req.user.id, loan);
      if (!isAdminOfLoanGroup) {
        return res.status(403).json({ 
          msg: "You can only update penalties for loans from your groups" 
        });
      }
    } else if (!isAdmin(req.user.role)) {
      return res.status(403).json({ msg: "Access denied" });
    }

    const { penaltyId } = req.params;
    const { status } = req.body;

    if (!["pending", "paid", "waived", "overdue"].includes(status)) {
      return res.status(400).json({ msg: "Invalid penalty status" });
    }

    const penalty = loan.penalties.id(penaltyId);
    if (!penalty) return res.status(404).json({ msg: "Penalty not found" });

    penalty.status = status;
    
    if (status === "paid") {
      penalty.paidDate = new Date();
    }

    await loan.save();
    
    await loan.populate('borrower', 'name email');
    await loan.populate('groupId', 'name');
    await loan.populate('penalties');
    
    res.json({ msg: "Penalty status updated", loan });
  } catch (error) {
    res.status(500).json({ msg: "Server error", error: error.message });
  }
};

// Pay penalty (user)
const PayPenalty = async (req, res) => {
  try {
    const loan = await Loan.findById(req.params.id);
    if (!loan) return res.status(404).json({ msg: "Loan not found" });

    const { penaltyId } = req.params;

    // Only borrower can pay their penalties
    if (loan.borrower.toString() !== req.user.id) {
      return res.status(403).json({ msg: "Access denied" });
    }

    const penalty = loan.penalties.id(penaltyId);
    if (!penalty) return res.status(404).json({ msg: "Penalty not found" });

    if (penalty.status === "paid") {
      return res.status(400).json({ msg: "Penalty is already paid" });
    }

    penalty.status = "paid";
    penalty.paidDate = new Date();

    await loan.save();
    
    await loan.populate('borrower', 'name email');
    await loan.populate('groupId', 'name');
    await loan.populate('penalties');
    
    res.json({ msg: "Penalty paid successfully", loan });
  } catch (error) {
    res.status(500).json({ msg: "Server error", error: error.message });
  }
};

// Mark loan as non-performing (admin only) - UPDATED FOR GROUPADMIN
const MarkAsNonPerforming = async (req, res) => {
  try {
    const loan = await Loan.findById(req.params.id)
      .populate('groupId', 'name groupadmin');
    
    if (!loan) return res.status(404).json({ msg: "Loan not found" });

    // Check permissions - group admin can only mark loans from their groups as non-performing
    if (req.user.role === "groupadmin") {
      const isAdminOfLoanGroup = await isGroupAdminOfLoan(req.user.id, loan);
      if (!isAdminOfLoanGroup) {
        return res.status(403).json({ 
          msg: "You can only mark loans from your groups as non-performing" 
        });
      }
    } else if (!isAdmin(req.user.role)) {
      return res.status(403).json({ msg: "Access denied" });
    }

    const { reason, remarks, dateReported, evidence = [] } = req.body;
    
    if (!reason) {
      return res.status(400).json({ msg: "Please provide a reason for marking as non-performing" });
    }

    const nonPerformingRecord = {
      reason,
      remarks,
      dateReported: dateReported ? new Date(dateReported) : new Date(),
      reportedBy: req.user.id,
      evidence
    };

    loan.nonPerformingRecords.push(nonPerformingRecord);
    loan.status = "non_performing";
    
    await loan.save();
    
    await loan.populate('borrower', 'name email');
    await loan.populate('groupId', 'name');
    await loan.populate('nonPerformingRecords');
    
    res.json({ msg: "Loan marked as non-performing", loan });
  } catch (error) {
    res.status(500).json({ msg: "Server error", error: error.message });
  }
};

// Delete penalty (admin only) - UPDATED FOR GROUPADMIN
const DeletePenalty = async (req, res) => {
  try {
    const loan = await Loan.findById(req.params.id)
      .populate('groupId', 'name groupadmin');
    
    if (!loan) return res.status(404).json({ msg: "Loan not found" });

    // Check permissions - group admin can only delete penalties from loans in their groups
    if (req.user.role === "groupadmin") {
      const isAdminOfLoanGroup = await isGroupAdminOfLoan(req.user.id, loan);
      if (!isAdminOfLoanGroup) {
        return res.status(403).json({ 
          msg: "You can only delete penalties from loans in your groups" 
        });
      }
    } else if (!isAdmin(req.user.role)) {
      return res.status(403).json({ msg: "Access denied" });
    }

    const { penaltyId } = req.params;

    loan.penalties.pull({ _id: penaltyId });
    await loan.save();
    
    await loan.populate('borrower', 'name email');
    await loan.populate('groupId', 'name');
    await loan.populate('penalties');
    
    res.json({ msg: "Penalty deleted", loan });
  } catch (error) {
    res.status(500).json({ msg: "Server error", error: error.message });
  }
};

export { 
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
};