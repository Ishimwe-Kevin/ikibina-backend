import User from "../models/User.js";
import Group from "../models/group.model.js";
import Contribution from "../models/contribution.model.js";
import Loan from "../models/loan.model.js";

// Get financial overview data for superAdmin
export const getFinancialOverview = async (req, res) => {
  try {
    // Verify user is superAdmin
    if (req.user.role !== "superAdmin") {
      return res.status(403).json({ msg: "Access denied. SuperAdmin only." });
    }

    // Get filter parameters
    const { timeRange, groupId } = req.query;
    
    // Set date range based on timeRange parameter
    let startDate = new Date(0); // Default to beginning of time
    const endDate = new Date(); // Current date
    
    if (timeRange) {
      switch (timeRange) {
        case 'week':
          startDate = new Date();
          startDate.setDate(startDate.getDate() - 7);
          break;
        case 'month':
          startDate = new Date();
          startDate.setMonth(startDate.getMonth() - 1);
          break;
        case 'quarter':
          startDate = new Date();
          startDate.setMonth(startDate.getMonth() - 3);
          break;
        case 'year':
          startDate = new Date();
          startDate.setFullYear(startDate.getFullYear() - 1);
          break;
      }
    }

    // Build group filter
    const groupFilter = groupId ? { _id: groupId } : { status: "active" };
    
    // Get all active groups with filter
    const groups = await Group.find(groupFilter).populate("creator", "name");
    
    // Get all contributions with date filter
    const contributionsQuery = { date: { $gte: startDate, $lte: endDate } };
    const contributions = await Contribution.find(contributionsQuery).populate("group", "name");
    
    // Get all loans with date filter
    const loansQuery = { requestDate: { $gte: startDate, $lte: endDate } };
    const loans = await Loan.find(loansQuery).populate("group", "name");

    // Calculate total savings across all groups
    const totalSavings = contributions.reduce((sum, contribution) => {
      if (contribution.type === "deposit" && contribution.status === "approved") {
        return sum + contribution.amount;
      }
      if (contribution.type === "withdrawal" && contribution.status === "approved") {
        return sum - contribution.amount;
      }
      return sum;
    }, 0);
    
    // Calculate total loans across all groups
    const totalLoans = loans.reduce((sum, loan) => {
      if (loan.status === "approved") {
        return sum + loan.amount;
      }
      return sum;
    }, 0);
    
    // Calculate repaid loans
    const repaidLoans = loans.reduce((sum, loan) => {
      if (loan.status === "repaid") {
        return sum + loan.amount;
      }
      return sum;
    }, 0);

    // Calculate monthly savings and loans for the past 12 months
    const monthlyData = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      
      const monthlyContributions = contributions.filter(c => {
        const date = new Date(c.date);
        return date >= month && date <= monthEnd && c.status === "approved";
      });
      
      const deposits = monthlyContributions
        .filter(c => c.type === "deposit")
        .reduce((sum, c) => sum + c.amount, 0);
      
      const withdrawals = monthlyContributions
        .filter(c => c.type === "withdrawal")
        .reduce((sum, c) => sum + c.amount, 0);
      
      // Calculate monthly loans
      const monthlyLoans = loans.filter(loan => {
        const date = new Date(loan.requestDate);
        return date >= month && date <= monthEnd && loan.status === "approved";
      });
      
      const loanAmount = monthlyLoans.reduce((sum, loan) => sum + loan.amount, 0);
      
      monthlyData.push({
        month: month.toLocaleString('default', { month: 'short', year: 'numeric' }),
        savings: deposits - withdrawals,
        loans: loanAmount
      });
    }

    // Calculate group financials with enhanced metrics
    const groupFinancials = await Promise.all(groups.map(async (group) => {
      // Get group contributions
      const groupContributions = contributions.filter(c => 
        c.group && c.group._id.toString() === group._id.toString()
      );
      
      // Get group loans
      const groupLoans = loans.filter(l => 
        l.group && l.group._id.toString() === group._id.toString()
      );
      
      // Calculate total savings for this group
      const groupSavings = groupContributions.reduce((sum, contribution) => {
        if (contribution.type === "deposit" && contribution.status === "approved") {
          return sum + contribution.amount;
        }
        if (contribution.type === "withdrawal" && contribution.status === "approved") {
          return sum - contribution.amount;
        }
        return sum;
      }, 0);
      
      // Calculate total loans for this group
      const groupLoanTotal = groupLoans.reduce((sum, loan) => {
        if (loan.status === "approved" || loan.status === "repaid") {
          return sum + loan.amount;
        }
        return sum;
      }, 0);
      
      // Get group members count
      const memberCount = group.members ? group.members.length : 0;
      
      // Calculate growth rate (comparing current month to previous month)
      const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      
      const currentMonthContributions = groupContributions.filter(c => {
        const date = new Date(c.date);
        return date >= currentMonth && date <= currentMonthEnd && c.status === "approved";
      });
      
      const previousMonthContributions = groupContributions.filter(c => {
        const date = new Date(c.date);
        return date >= previousMonth && date <= previousMonthEnd && c.status === "approved";
      });
      
      const currentMonthNet = currentMonthContributions
        .filter(c => c.type === "deposit")
        .reduce((sum, c) => sum + c.amount, 0) - 
        currentMonthContributions
        .filter(c => c.type === "withdrawal")
        .reduce((sum, c) => sum + c.amount, 0);
      
      const previousMonthNet = previousMonthContributions
        .filter(c => c.type === "deposit")
        .reduce((sum, c) => sum + c.amount, 0) - 
        previousMonthContributions
        .filter(c => c.type === "withdrawal")
        .reduce((sum, c) => sum + c.amount, 0);
      
      let growthRate = 0;
      if (previousMonthNet > 0) {
        growthRate = ((currentMonthNet - previousMonthNet) / previousMonthNet) * 100;
      }
      
      // Calculate average contribution per member
      const avgContributionPerMember = memberCount > 0 ? groupSavings / memberCount : 0;
      
      return {
        id: group._id,
        name: group.name,
        totalSavings: groupSavings,
        totalLoans: groupLoanTotal,
        memberCount,
        growthRate: parseFloat(growthRate.toFixed(2)),
        avgContributionPerMember: parseFloat(avgContributionPerMember.toFixed(2))
      };
    }));
    
    // Get top performing groups (by total savings)
    const topGroups = [...groupFinancials]
      .sort((a, b) => b.totalSavings - a.totalSavings)
      .slice(0, 5);

    // Get groups with highest growth rate
    const fastestGrowingGroups = [...groupFinancials]
      .sort((a, b) => b.growthRate - a.growthRate)
      .slice(0, 5);

    res.json({
      totalSavings,
      totalLoans,
      repaidLoans,
      monthlyData,
      groupFinancials,
      topGroups,
      fastestGrowingGroups
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
};

// Get admin dashboard data
export const getAdminDashboardData = async (req, res) => {
  try {
    // Get users count
    const usersCount = await User.countDocuments();
    
    // Get active groups count
    const activeGroupsCount = await Group.countDocuments({ status: "active" });
    
    // Get pending groups
    const pendingGroups = await Group.find({ status: "pending" })
      .populate("creator", "name email")
      .sort({ createdAt: -1 });
    
    // Get total savings
    const contributions = await Contribution.find({ status: "approved" });
    const deposits = contributions
      .filter(c => c.type === "deposit")
      .reduce((sum, c) => sum + c.amount, 0);
    const withdrawals = contributions
      .filter(c => c.type === "withdrawal")
      .reduce((sum, c) => sum + c.amount, 0);
    const totalSavings = deposits - withdrawals;
    
    // Get pending issues count (pending contributions + pending loans)
    const pendingContributions = await Contribution.countDocuments({ status: "pending" });
    const pendingLoans = await Loan.countDocuments({ status: "pending" });
    const pendingIssues = pendingContributions + pendingLoans;
    
    res.json({
      usersCount,
      activeGroupsCount,
      pendingGroups,
      totalSavings,
      pendingIssues
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
};

// Get all users for admin
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password");
    res.json(users);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
};