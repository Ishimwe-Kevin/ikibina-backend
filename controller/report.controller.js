import Group from "../models/group.model.js";
import Contribution from "../models/contribution.model.js";
import User from "../models/User.js";
import Loan from "../models/loan.model.js";

// Report for superadmins, admins, bookkeepers, and groupadmins
const getGroupReport = async (req, res) => {
  try {
    console.log(`📈 Fetching group reports - Requested by: ${req.user.email} (${req.user.role})`);

    let groups;
    const userRole = req.user.role;

    if (userRole === "superAdmin" || userRole === "admin" || userRole === "bookkeeper") {
      // SuperAdmin, Admin, and Bookkeeper see all groups
      groups = await Group.find()
        .populate("creator", "name email role")
        .populate("groupadmin", "name email role")
        .populate("members", "name email role")
        .populate("pendingRequests", "name email role");
    } else if (userRole === "groupadmin") {
      // GroupAdmin sees only groups they admin
      groups = await Group.find({ groupadmin: req.user._id })
        .populate("creator", "name email role")
        .populate("groupadmin", "name email role")
        .populate("members", "name email role")
        .populate("pendingRequests", "name email role");
    } else {
      return res.status(403).json({ message: "Access denied. Insufficient permissions." });
    }

    // Build group-level report with enhanced financial data
    const groupReports = [];
    
    for (const group of groups) {
      // Get contributions for this group
      const contributions = await Contribution.find({ group: group._id })
        .populate("contributor", "name email role");

      // Get loans for this group
      const loans = await Loan.find({ groupId: group._id })
        .populate("borrower", "name email role");

      // Calculate financial totals
      const totalContribution = contributions.reduce((sum, c) => sum + (c.amount || 0), 0);
      const approvedContributions = contributions.filter(c => c.status === 'approved');
      const totalApprovedContribution = approvedContributions.reduce((sum, c) => sum + (c.amount || 0), 0);
      
      const activeLoans = loans.filter(loan => loan.status === 'active');
      const totalLoanAmount = activeLoans.reduce((sum, loan) => sum + (loan.amount || 0), 0);
      
      const pendingLoans = loans.filter(loan => loan.status === 'pending');
      const totalPendingLoanAmount = pendingLoans.reduce((sum, loan) => sum + (loan.amount || 0), 0);

      groupReports.push({
        groupId: group._id,
        groupName: group.name,
        description: group.description,
        status: group.status,
        totalMembers: group.members.length,
        pendingRequests: group.pendingRequests.length,
        // Financial data
        totalContributions: totalContribution,
        totalApprovedContributions: totalApprovedContribution,
        totalLoanAmount: totalLoanAmount,
        totalPendingLoanAmount: totalPendingLoanAmount,
        activeLoansCount: activeLoans.length,
        pendingLoansCount: pendingLoans.length,
        // Detailed data
        contributions: contributions.map(c => ({
          contributor: c.contributor,
          amount: c.amount,
          status: c.status,
          createdAt: c.createdAt
        })),
        loans: loans.map(loan => ({
          borrower: loan.borrower,
          amount: loan.amount,
          status: loan.status,
          purpose: loan.purpose,
          createdAt: loan.createdAt
        }))
      });
    }

    // System-level summary for superAdmin, admin, and bookkeeper
    if (userRole === "superAdmin" || userRole === "admin" || userRole === "bookkeeper") {
      const totalUsers = await User.countDocuments();
      const totalGroups = await Group.countDocuments();
      const activeGroups = await Group.countDocuments({ status: 'active' });
      const pendingGroups = await Group.countDocuments({ status: 'pending' });
      
      const totalContributions = await Contribution.countDocuments();
      const approvedContributions = await Contribution.countDocuments({ status: 'approved' });
      
      const contributionSum = await Contribution.aggregate([
        { $group: { _id: null, total: { $sum: "$amount" } } }
      ]);

      const approvedContributionSum = await Contribution.aggregate([
        { $match: { status: 'approved' } },
        { $group: { _id: null, total: { $sum: "$amount" } } }
      ]);

      const totalLoans = await Loan.countDocuments();
      const activeLoans = await Loan.countDocuments({ status: 'active' });
      
      const loanSum = await Loan.aggregate([
        { $group: { _id: null, total: { $sum: "$amount" } } }
      ]);

      const activeLoanSum = await Loan.aggregate([
        { $match: { status: 'active' } },
        { $group: { _id: null, total: { $sum: "$amount" } } }
      ]);

      const systemSummary = {
        totalUsers,
        totalGroups,
        activeGroups,
        pendingGroups,
        totalContributions,
        approvedContributions,
        totalContributionAmount: contributionSum[0]?.total || 0,
        approvedContributionAmount: approvedContributionSum[0]?.total || 0,
        totalLoans,
        activeLoans,
        totalLoanAmount: loanSum[0]?.total || 0,
        activeLoanAmount: activeLoanSum[0]?.total || 0
      };

      console.log(`✅ Generated system report with ${groupReports.length} groups`);
      return res.json({ 
        systemSummary, 
        groupReports,
        userRole: req.user.role
      });
    }

    // GroupAdmin only gets group-level reports
    console.log(`✅ Generated group report with ${groupReports.length} groups for groupadmin`);
    res.json({ 
      groupReports,
      userRole: req.user.role
    });
  } catch (err) {
    console.error("❌ Error generating group reports:", err.message);
    res.status(500).json({ message: "Server error generating reports", error: err.message });
  }
};

export { getGroupReport };