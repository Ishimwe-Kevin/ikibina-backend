import OnlinePayment from "../models/onlinePayment.model.js";
import User from "../models/User.js";
import Group from "../models/group.model.js";
import Contribution from "../models/contribution.model.js";
import Loan from "../models/loan.model.js";
import { v4 as uuidv4 } from "uuid";
import { createPaymentAuditTrail } from "../utils/auditTrailUtils.js";

// Mock payment gateway integration - in production, replace with actual payment gateway API
const processPaymentWithGateway = async (paymentDetails) => {
    // Simulate payment processing
    return new Promise((resolve) => {
        setTimeout(() => {
            const success = Math.random() > 0.1; // 90% success rate for testing
            if (success) {
                resolve({
                    success: true,
                    transactionId: `TXN-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                    message: "Payment processed successfully"
                });
            } else {
                resolve({
                    success: false,
                    message: "Payment failed. Please try again."
                });
            }
        }, 1000);
    });
};

// Create a new online payment
export const createOnlinePayment = async (req, res) => {
    try {
        const {
            transactionType,
            relatedId,
            amount,
            paymentMethod,
            mobileMoneyProvider,
            phoneNumber,
            description
        } = req.body;

        const userId = req.user.id;
        const user = await User.findById(userId);
        
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Validate related entity exists (contribution or loan)
        let group;
        if (transactionType.includes("contribution")) {
            const contribution = await Contribution.findById(relatedId);
            if (!contribution) {
                return res.status(404).json({ message: "Contribution not found" });
            }
            group = await Group.findById(contribution.group);
        } else if (transactionType.includes("loan")) {
            const loan = await Loan.findById(relatedId);
            if (!loan) {
                return res.status(404).json({ message: "Loan not found" });
            }
            group = await Group.findById(loan.group);
        } else {
            return res.status(400).json({ message: "Invalid transaction type" });
        }

        if (!group) {
            return res.status(404).json({ message: "Group not found" });
        }
        
        // Check if user is a member of the group
        const isMember = group.members.some(member => member.toString() === userId);
        if (!isMember && group.admin.toString() !== userId) {
            return res.status(403).json({ message: "You are not a member of this group" });
        }

        // Generate unique reference
        const reference = `PAY-${uuidv4().substring(0, 8)}-${Date.now()}`;

        // Create payment record
        const newPayment = new OnlinePayment({
            user: userId,
            group: group._id,
            transactionType,
            relatedId,
            amount,
            paymentMethod,
            reference,
            description,
            status: "pending"
        });

        // Add mobile money details if applicable
        if (paymentMethod === "mobile_money") {
            if (!mobileMoneyProvider || !phoneNumber) {
                return res.status(400).json({ 
                    message: "Mobile money provider and phone number are required for mobile money payments" 
                });
            }
            newPayment.mobileMoneyProvider = mobileMoneyProvider;
            newPayment.phoneNumber = phoneNumber;
        }

        await newPayment.save();

        // Process payment with payment gateway
        const paymentResult = await processPaymentWithGateway({
            amount,
            paymentMethod,
            reference: newPayment.reference,
            description
        });

        // Update payment record with result
        if (paymentResult.success) {
            newPayment.status = "completed";
            newPayment.transactionId = paymentResult.transactionId;
            newPayment.processedAt = new Date();
            
            // Update related entity based on transaction type
            if (transactionType === "contribution") {
                await Contribution.findByIdAndUpdate(relatedId, {
                    $inc: { amountPaid: amount },
                    lastPaymentDate: new Date()
                });
            } else if (transactionType === "loan_repayment") {
                await Loan.findByIdAndUpdate(relatedId, {
                    $inc: { amountRepaid: amount },
                    lastRepaymentDate: new Date()
                });
            } else if (transactionType === "withdrawal") {
                // Handle withdrawal logic
                // This would typically involve updating user balance or contribution records
            } else if (transactionType === "loan_disbursement") {
                // Handle loan disbursement logic
                await Loan.findByIdAndUpdate(relatedId, {
                    status: "disbursed",
                    disbursementDate: new Date()
                });
            }
        } else {
            newPayment.status = "failed";
            newPayment.errorMessage = paymentResult.message;
        }

        await newPayment.save();

        return res.status(201).json({
            success: true,
            payment: newPayment,
            message: paymentResult.success 
                ? "Payment processed successfully" 
                : "Payment processing failed"
        });
    } catch (error) {
        console.error("Error creating online payment:", error);
        return res.status(500).json({
            message: "Server error",
            error: error.message
        });
    }
};

// Make a contribution payment
export const makeContributionPayment = async (req, res) => {
    try {
        const { contributionId, amount, paymentMethod, mobileMoneyProvider, phoneNumber } = req.body;
        
        // Enhanced input validation
        if (!contributionId || !amount || !paymentMethod) {
            return res.status(400).json({ 
                success: false,
                message: "Missing required fields: contributionId, amount, and paymentMethod are all required" 
            });
        }
        
        // Validate amount is a positive number
        if (isNaN(amount) || amount <= 0) {
            return res.status(400).json({
                success: false,
                message: "Payment amount must be a positive number"
            });
        }
        
        const userId = req.user.id;
        
        // Validate contribution exists
        const contribution = await Contribution.findById(contributionId);
        if (!contribution) {
            return res.status(404).json({ 
                success: false,
                message: "Contribution not found. Please verify the contribution ID and try again." 
            });
        }
        
        // Validate user is associated with this contribution
        if (contribution.contributor.toString() !== userId) {
            return res.status(403).json({ 
                success: false,
                message: "Not authorized to make payment for this contribution. You can only pay for your own contributions." 
            });
        }
        
        // Get group info
        const group = await Group.findById(contribution.group);
        if (!group) {
            return res.status(404).json({ 
                success: false,
                message: "Group not found. The group associated with this contribution may have been deleted." 
            });
        }
        
        // Validate payment amount against contribution requirements
        if (amount > contribution.amount) {
            return res.status(400).json({
                success: false,
                message: `Payment amount (${amount}) exceeds the required contribution amount (${contribution.amount})`
            });
        }
        
        // Generate reference
        const reference = `CONT-${uuidv4().substring(0, 8)}-${Date.now()}`;
        
        // Create payment record
        const newPayment = new OnlinePayment({
            user: userId,
            group: group._id,
            transactionType: "contribution",
            relatedId: contributionId,
            amount,
            paymentMethod,
            reference,
            description: `Contribution payment for ${group.name}`,
            status: "pending"
        });
        
        // Add mobile money details if applicable
        if (paymentMethod === "mobile_money") {
            if (!mobileMoneyProvider || !phoneNumber) {
                return res.status(400).json({ 
                    success: false,
                    message: "Mobile money provider and phone number are required for mobile money payments" 
                });
            }
            
            // Validate phone number format
            const phoneRegex = /^\+?[0-9]{10,15}$/;
            if (!phoneRegex.test(phoneNumber)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid phone number format. Please provide a valid phone number."
                });
            }
            
            newPayment.mobileMoneyProvider = mobileMoneyProvider;
            newPayment.phoneNumber = phoneNumber;
        }
        
        try {
            await newPayment.save();
        } catch (dbError) {
            console.error("Error saving payment record:", dbError);
            return res.status(500).json({
                success: false,
                message: "Failed to create payment record",
                error: dbError.message
            });
        }
        
        // Process payment
        let paymentResult;
        try {
            paymentResult = await processPaymentWithGateway({
                amount,
                paymentMethod,
                reference: newPayment.reference,
                description: `Contribution payment for ${group.name}`
            });
        } catch (paymentError) {
            console.error("Payment gateway error:", paymentError);
            newPayment.status = "failed";
            newPayment.errorMessage = "Payment gateway error: " + paymentError.message;
            await newPayment.save();
            
            return res.status(502).json({
                success: false,
                message: "Payment gateway error. Please try again later.",
                error: paymentError.message
            });
        }
        
        // Update payment record with result
        if (paymentResult.success) {
            newPayment.status = "completed";
            newPayment.transactionId = paymentResult.transactionId;
            newPayment.processedAt = new Date();
            
            try {
                // Update contribution record
                await Contribution.findByIdAndUpdate(contributionId, {
                    $inc: { amountPaid: amount },
                    lastPaymentDate: new Date()
                });
                
                // Create audit trail
                await createPaymentAuditTrail({
                    user: userId,
                    action: "contribution_payment",
                    entityType: "contribution",
                    entityId: contributionId,
                    details: {
                        amount,
                        paymentMethod,
                        transactionId: paymentResult.transactionId,
                        groupName: group.name
                    },
                    ipAddress: req.ip,
                    userAgent: req.headers["user-agent"]
                });
                
                // Send notification to user
                try {
                    const user = await User.findById(userId);
                    await createNotification({
                        recipient: userId,
                        title: "Payment Successful",
                        message: `Your contribution payment of ${amount} for ${group.name} was successful.`,
                        type: "payment_success",
                        relatedEntity: {
                            type: "contribution",
                            id: contributionId
                        }
                    });
                    
                    // Send email notification if user has email
                    if (user && user.email) {
                        // Implement email notification here if needed
                    }
                } catch (notificationError) {
                    console.error("Error sending notification:", notificationError);
                    // Continue execution even if notification fails
                }
            } catch (updateError) {
                console.error("Error updating records after payment:", updateError);
                // Payment was successful but updates failed
                // We should still return success to user but log the error
            }
        } else {
            newPayment.status = "failed";
            newPayment.errorMessage = paymentResult.message || "Unknown payment error";
        }
        
        try {
            await newPayment.save();
        } catch (saveError) {
            console.error("Error saving updated payment record:", saveError);
            // If we can't save the payment status, still return the result to the user
        }
        
        const statusCode = paymentResult.success ? 201 : 400;
        return res.status(statusCode).json({
            success: paymentResult.success,
            payment: {
                id: newPayment._id,
                amount: newPayment.amount,
                status: newPayment.status,
                reference: newPayment.reference,
                transactionId: newPayment.transactionId,
                processedAt: newPayment.processedAt
            },
            message: paymentResult.success 
                ? "Contribution payment processed successfully" 
                : paymentResult.message || "Payment processing failed"
        });
    } catch (error) {
        console.error("Error processing contribution payment:", error);
        return res.status(500).json({
            message: "Server error",
            error: error.message
        });
    }
};

// Make a loan repayment
export const makeLoanRepayment = async (req, res) => {
    try {
        const { loanId, amount, paymentMethod, mobileMoneyProvider, phoneNumber } = req.body;
        
        if (!loanId || !amount || !paymentMethod) {
            return res.status(400).json({ message: "Missing required fields" });
        }
        
        const userId = req.user.id;
        
        // Validate loan exists
        const loan = await Loan.findById(loanId);
        if (!loan) {
            return res.status(404).json({ message: "Loan not found" });
        }
        
        // Validate user is associated with this loan
        if (loan.user.toString() !== userId) {
            return res.status(403).json({ message: "Not authorized to make payment for this loan" });
        }
        
        // Get group info
        const group = await Group.findById(loan.group);
        if (!group) {
            return res.status(404).json({ message: "Group not found" });
        }
        
        // Generate reference
        const reference = `LOAN-${uuidv4().substring(0, 8)}-${Date.now()}`;
        
        // Create payment record
        const newPayment = new OnlinePayment({
            user: userId,
            group: group._id,
            transactionType: "loan_repayment",
            relatedId: loanId,
            amount,
            paymentMethod,
            reference,
            description: `Loan repayment for ${group.name}`,
            status: "pending"
        });
        
        // Add mobile money details if applicable
        if (paymentMethod === "mobile_money") {
            if (!mobileMoneyProvider || !phoneNumber) {
                return res.status(400).json({ 
                    message: "Mobile money provider and phone number are required for mobile money payments" 
                });
            }
            newPayment.mobileMoneyProvider = mobileMoneyProvider;
            newPayment.phoneNumber = phoneNumber;
        }
        
        await newPayment.save();
        
        // Process payment
        const paymentResult = await processPaymentWithGateway({
            amount,
            paymentMethod,
            reference: newPayment.reference,
            description: `Loan repayment for ${group.name}`
        });
        
        // Update payment record with result
        if (paymentResult.success) {
            newPayment.status = "completed";
            newPayment.transactionId = paymentResult.transactionId;
            newPayment.processedAt = new Date();
            
            // Update loan record
            await Loan.findByIdAndUpdate(loanId, {
                $inc: { amountRepaid: amount },
                lastRepaymentDate: new Date()
            });
            
            // Check if loan is fully repaid
            const updatedLoan = await Loan.findById(loanId);
            if (updatedLoan.amountRepaid >= updatedLoan.amount) {
                updatedLoan.status = "repaid";
                updatedLoan.repaymentDate = new Date();
                await updatedLoan.save();
            }
            
            // Create audit trail
            await createPaymentAuditTrail({
                user: userId,
                action: "loan_repayment",
                entityType: "loan",
                entityId: loanId,
                details: {
                    amount,
                    paymentMethod,
                    transactionId: paymentResult.transactionId
                },
                ipAddress: req.ip,
                userAgent: req.headers["user-agent"]
            });
        } else {
            newPayment.status = "failed";
            newPayment.errorMessage = paymentResult.message;
        }
        
        await newPayment.save();
        
        return res.status(201).json({
            success: paymentResult.success,
            payment: newPayment,
            message: paymentResult.success 
                ? "Loan repayment processed successfully" 
                : "Payment processing failed"
        });
    } catch (error) {
        console.error("Error processing loan repayment:", error);
        return res.status(500).json({
            message: "Server error",
            error: error.message
        });
    }
};

// Get all payments for a user
export const getUserPayments = async (req, res) => {
    try {
        const userId = req.user.id;
        const payments = await OnlinePayment.find({ user: userId })
            .sort({ createdAt: -1 })
            .populate("group", "name")
            .exec();

        return res.status(200).json({
            success: true,
            count: payments.length,
            payments
        });
    } catch (error) {
        console.error("Error fetching user payments:", error);
        return res.status(500).json({
            message: "Server error",
            error: error.message
        });
    }
};

// Get all payments for a group
export const getGroupPayments = async (req, res) => {
    try {
        const { groupId } = req.params;
        
        // Check if user is admin or member of the group
        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({ message: "Group not found" });
        }
        
        // Verify user is admin or member of the group
        const userId = req.user.id;
        const isAdmin = group.admin.toString() === userId;
        const isMember = group.members.some(member => member.toString() === userId);
        
        if (!isAdmin && !isMember) {
            return res.status(403).json({ message: "Not authorized to view group payments" });
        }
        
        const payments = await OnlinePayment.find({ group: groupId })
            .sort({ createdAt: -1 })
            .populate("user", "name email")
            .exec();

        return res.status(200).json({
            success: true,
            count: payments.length,
            payments
        });
    } catch (error) {
        console.error("Error fetching group payments:", error);
        return res.status(500).json({
            message: "Server error",
            error: error.message
        });
    }
};

// Get payment by ID
export const getPaymentById = async (req, res) => {
    try {
        const { paymentId } = req.params;
        const payment = await OnlinePayment.findById(paymentId)
            .populate("user", "name email")
            .populate("group", "name")
            .exec();
            
        if (!payment) {
            return res.status(404).json({ message: "Payment not found" });
        }
        
        // Verify user is owner, admin of the group, or member of the group
        const userId = req.user.id;
        const isOwner = payment.user._id.toString() === userId;
        
        const group = await Group.findById(payment.group);
        const isAdmin = group && group.admin.toString() === userId;
        
        if (!isOwner && !isAdmin) {
            return res.status(403).json({ message: "Not authorized to view this payment" });
        }
        
        return res.status(200).json({
            success: true,
            payment
        });
    } catch (error) {
        console.error("Error fetching payment:", error);
        return res.status(500).json({
            message: "Server error",
            error: error.message
        });
    }
};

// Process withdrawal request
export const processWithdrawal = async (req, res) => {
    try {
        const {
            transactionType,
            relatedId,
            amount,
            paymentMethod,
            mobileMoneyProvider,
            phoneNumber,
            description
        } = req.body;
        
        if (!["withdrawal", "loan_disbursement"].includes(transactionType)) {
            return res.status(400).json({ message: "Invalid transaction type for withdrawal" });
        }
        
        const userId = req.user.id;
        const user = await User.findById(userId);
        
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        
        // Validate related entity and available funds
        let group;
        let availableAmount = 0;
        
        if (transactionType === "withdrawal") {
            const contribution = await Contribution.findById(relatedId);
            if (!contribution) {
                return res.status(404).json({ message: "Contribution not found" });
            }
            
            // Check if user owns the contribution
            if (contribution.user.toString() !== userId) {
                return res.status(403).json({ message: "Not authorized to withdraw from this contribution" });
            }
            
            // Check if there are sufficient funds
            availableAmount = contribution.amountPaid - contribution.amountWithdrawn;
            if (availableAmount < amount) {
                return res.status(400).json({ message: "Insufficient funds for withdrawal" });
            }
            
            group = await Group.findById(contribution.group);
        } else if (transactionType === "loan_disbursement") {
            const loan = await Loan.findById(relatedId);
            if (!loan) {
                return res.status(404).json({ message: "Loan not found" });
            }
            
            // Check if user owns the loan
            if (loan.user.toString() !== userId) {
                return res.status(403).json({ message: "Not authorized to withdraw this loan" });
            }
            
            // Check if loan is approved and not yet disbursed
            if (loan.status !== "approved") {
                return res.status(400).json({ message: "Loan must be approved before disbursement" });
            }
            
            if (loan.disbursementDate) {
                return res.status(400).json({ message: "Loan has already been disbursed" });
            }
            
            availableAmount = loan.amount;
            if (amount > availableAmount) {
                return res.status(400).json({ message: "Withdrawal amount exceeds loan amount" });
            }
            
            group = await Group.findById(loan.group);
        }
        
        if (!group) {
            return res.status(404).json({ message: "Group not found" });
        }
        
        // Generate unique reference
        const reference = `WDR-${uuidv4().substring(0, 8)}-${Date.now()}`;
        
        // Create withdrawal record
        const newWithdrawal = new OnlinePayment({
            user: userId,
            group: group._id,
            transactionType,
            relatedId,
            amount,
            paymentMethod,
            reference,
            description,
            status: "pending"
        });
        
        // Add mobile money details if applicable
        if (paymentMethod === "mobile_money") {
            if (!mobileMoneyProvider || !phoneNumber) {
                return res.status(400).json({ 
                    message: "Mobile money provider and phone number are required for mobile money withdrawals" 
                });
            }
            newWithdrawal.mobileMoneyProvider = mobileMoneyProvider;
            newWithdrawal.phoneNumber = phoneNumber;
        }
        
        await newWithdrawal.save();
        
        // Process withdrawal (in a real system, this would integrate with a payment gateway)
        // For demo purposes, we'll simulate a successful withdrawal
        newWithdrawal.status = "completed";
        newWithdrawal.transactionId = `WDR-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        newWithdrawal.processedAt = new Date();
        
        // Update related entity based on transaction type
        if (transactionType === "withdrawal") {
            await Contribution.findByIdAndUpdate(relatedId, {
                $inc: { amountWithdrawn: amount },
                lastWithdrawalDate: new Date()
            });
        } else if (transactionType === "loan_disbursement") {
            await Loan.findByIdAndUpdate(relatedId, {
                status: "disbursed",
                disbursementDate: new Date()
            });
        }
        
        await newWithdrawal.save();
        
        return res.status(201).json({
            success: true,
            withdrawal: newWithdrawal,
            message: "Withdrawal processed successfully"
        });
    } catch (error) {
        console.error("Error processing withdrawal:", error);
        return res.status(500).json({
            message: "Server error",
            error: error.message
        });
    }
};

// Cancel a pending payment
export const cancelPayment = async (req, res) => {
    try {
        const { paymentId } = req.params;
        const payment = await OnlinePayment.findById(paymentId);
        
        if (!payment) {
            return res.status(404).json({ message: "Payment not found" });
        }
        
        // Verify user is owner of the payment
        const userId = req.user.id;
        if (payment.user.toString() !== userId) {
            return res.status(403).json({ message: "Not authorized to cancel this payment" });
        }
        
        // Only pending payments can be cancelled
        if (payment.status !== "pending") {
            return res.status(400).json({ 
                message: `Payment cannot be cancelled because it is already ${payment.status}` 
            });
        }
        
        // Update payment status
        payment.status = "cancelled";
        await payment.save();
        
        return res.status(200).json({
            success: true,
            message: "Payment cancelled successfully",
            payment
        });
    } catch (error) {
        console.error("Error cancelling payment:", error);
        return res.status(500).json({
            message: "Server error",
            error: error.message
        });
    }
};