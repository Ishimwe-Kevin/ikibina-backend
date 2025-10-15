import MobilePayment from "../models/mobilePayment.model.js";
import User from "../models/User.js";
import Contribution from "../models/contribution.model.js";
import Loan from "../models/loan.model.js";

// Simulate mobile money API calls (in real implementation, this would integrate with actual mobile money APIs)
const simulateMobileMoneyAPI = async (provider, phoneNumber, amount, type) => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // For testing purposes, always succeed (100% success rate)
    // In production, this would integrate with actual mobile money APIs
    const isSuccess = true; // Changed from Math.random() > 0.1 to true
    
    if (isSuccess) {
        const transactionId = `TXN${Date.now()}${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
        console.log(`Mobile payment successful: ${transactionId} for ${amount} via ${provider}`);
        return {
            success: true,
            transactionId: transactionId,
            message: "Transaction successful"
        };
    } else {
        console.log(`Mobile payment failed: Insufficient funds or network error for ${amount} via ${provider}`);
        return {
            success: false,
            error: "Insufficient funds or network error"
        };
    }
};

// Initiate mobile payment for contribution
const initiateContributionPayment = async (req, res) => {
    try {
        console.log('Mobile payment request body:', req.body);
        const { contributionId, amount, description, phoneNumber, mobileMoneyProvider, groupId } = req.body;

        if (!amount || !phoneNumber || !mobileMoneyProvider) {
            return res.status(400).json({ msg: "Please provide amount, phone number, and mobile money provider" });
        }

        let contribution;
        
        if (contributionId) {
            // Find existing contribution
            contribution = await Contribution.findById(contributionId);
            if (!contribution) {
                return res.status(404).json({ msg: "Contribution not found" });
            }

            // Check if user owns this contribution
            if (contribution.contributor.toString() !== req.user.id) {
                return res.status(403).json({ msg: "Not authorized to pay for this contribution" });
            }

            // Update contribution amount if different
            if (contribution.amount !== amount) {
                contribution.amount = amount;
                await contribution.save();
            }
        } else {
            // Create new contribution if no contributionId provided
            if (!groupId) {
                return res.status(400).json({ msg: "Group ID is required for new contributions" });
            }
            
            contribution = new Contribution({
            contributor: req.user.id,
            group: groupId,
            amount,
                description: description || "Contribution payment",
            status: "pending",
            type: "contribution"
        });

        await contribution.save();
            console.log('New contribution created:', contribution._id);
        }

        // Create mobile payment record
        const mobilePayment = new MobilePayment({
            user: req.user.id,
            transactionType: "contribution",
            relatedId: contribution._id,
            amount,
            phoneNumber,
            mobileMoneyProvider,
            status: "pending",
            description: description || "Contribution payment"
        });

        console.log('Creating mobile payment record:', mobilePayment);
        await mobilePayment.save();
        console.log('Mobile payment saved with ID:', mobilePayment._id);

        // Simulate mobile money API call
        console.log(`Initiating mobile payment for contribution: ${amount} via ${mobileMoneyProvider} to ${phoneNumber}`);
        const apiResponse = await simulateMobileMoneyAPI(mobileMoneyProvider, phoneNumber, amount, "payment");

        if (apiResponse.success) {
            mobilePayment.status = "completed";
            mobilePayment.transactionId = apiResponse.transactionId;
            mobilePayment.processedAt = new Date();
            await mobilePayment.save();

            // Update contribution status
            contribution.status = "approved";
            await contribution.save();

            console.log(`Contribution payment successful: ${apiResponse.transactionId}`);
            res.json({
                msg: "Payment successful",
                mobilePayment,
                contribution
            });
        } else {
            mobilePayment.status = "failed";
            mobilePayment.errorMessage = apiResponse.error;
            await mobilePayment.save();

            console.log(`Contribution payment failed: ${apiResponse.error}`);
            res.status(400).json({
                msg: "Payment failed",
                error: apiResponse.error,
                mobilePayment
            });
        }
    } catch (error) {
        console.error("Mobile payment error:", error);
        res.status(500).json({ msg: "Server error", error: error.message });
    }
};

// Initiate mobile withdrawal
const initiateWithdrawalPayment = async (req, res) => {
    try {
        const { groupId, amount, withdrawalReason, phoneNumber, mobileMoneyProvider } = req.body;

        if (!groupId || !amount || !phoneNumber || !mobileMoneyProvider) {
            return res.status(400).json({ msg: "Please provide all required fields" });
        }

        // Check available balance
        const contributions = await Contribution.find({
            contributor: req.user.id,
            group: groupId,
            status: "approved",
            type: "contribution"
        });

        const withdrawals = await Contribution.find({
            contributor: req.user.id,
            group: groupId,
            status: "approved",
            type: "withdrawal"
        });

        const totalContributions = contributions.reduce((sum, c) => sum + c.amount, 0);
        const totalWithdrawals = withdrawals.reduce((sum, w) => sum + w.amount, 0);
        const availableBalance = Math.max(0, totalContributions - totalWithdrawals);

        if (amount > availableBalance) {
            return res.status(400).json({
                msg: `Insufficient balance. Available: $${availableBalance.toFixed(2)}`
            });
        }

        // Create withdrawal record
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

        // Create mobile payment record
        const mobilePayment = new MobilePayment({
            user: req.user.id,
            transactionType: "withdrawal",
            relatedId: withdrawal._id,
            amount,
            phoneNumber,
            mobileMoneyProvider,
            status: "pending",
            description: withdrawalReason || "Withdrawal payment"
        });

        await mobilePayment.save();

        // Simulate mobile money API call
        const apiResponse = await simulateMobileMoneyAPI(mobileMoneyProvider, phoneNumber, amount, "withdrawal");

        if (apiResponse.success) {
            mobilePayment.status = "completed";
            mobilePayment.transactionId = apiResponse.transactionId;
            mobilePayment.processedAt = new Date();
            await mobilePayment.save();

            // Update withdrawal status
            withdrawal.status = "approved";
            await withdrawal.save();

            res.json({
                msg: "Withdrawal successful",
                mobilePayment,
                withdrawal
            });
        } else {
            mobilePayment.status = "failed";
            mobilePayment.errorMessage = apiResponse.error;
            await mobilePayment.save();

            res.status(400).json({
                msg: "Withdrawal failed",
                error: apiResponse.error,
                mobilePayment
            });
        }
    } catch (error) {
        console.error("Mobile withdrawal error:", error);
        res.status(500).json({ msg: "Server error", error: error.message });
    }
};

// Initiate mobile loan repayment
const initiateLoanRepayment = async (req, res) => {
    try {
        const { loanId, amount, phoneNumber, mobileMoneyProvider } = req.body;

        if (!loanId || !amount || !phoneNumber || !mobileMoneyProvider) {
            return res.status(400).json({ msg: "Please provide all required fields" });
        }

        const loan = await Loan.findById(loanId);
        if (!loan) {
            return res.status(404).json({ msg: "Loan not found" });
        }

        if (loan.borrower.toString() !== req.user.id) {
            return res.status(403).json({ msg: "Access denied" });
        }

        if (loan.status !== "approved") {
            return res.status(400).json({ msg: "Only approved loans can be repaid" });
        }

        // Create mobile payment record
        const mobilePayment = new MobilePayment({
            user: req.user.id,
            transactionType: "loan_repayment",
            relatedId: loan._id,
            amount,
            phoneNumber,
            mobileMoneyProvider,
            status: "pending",
            description: "Loan repayment"
        });

        await mobilePayment.save();

        // Simulate mobile money API call
        const apiResponse = await simulateMobileMoneyAPI(mobileMoneyProvider, phoneNumber, amount, "repayment");

        if (apiResponse.success) {
            mobilePayment.status = "completed";
            mobilePayment.transactionId = apiResponse.transactionId;
            mobilePayment.processedAt = new Date();
            await mobilePayment.save();

            // Update loan with repayment
            const totalOwed = loan.amount + (loan.amount * loan.interestRate / 100);
            const currentRepaid = loan.repaidAmount || 0;

            loan.repayments.push({ amount, date: new Date() });
            loan.repaidAmount = currentRepaid + amount;

            if (loan.repaidAmount >= totalOwed) {
                loan.status = "repaid";
            } else {
                if (loan.nextPayment) {
                    const nextPayment = new Date(loan.nextPayment);
                    nextPayment.setMonth(nextPayment.getMonth() + 1);
                    loan.nextPayment = nextPayment;
                }
            }

            await loan.save();

            res.json({
                msg: "Loan repayment successful",
                mobilePayment,
                loan
            });
        } else {
            mobilePayment.status = "failed";
            mobilePayment.errorMessage = apiResponse.error;
            await mobilePayment.save();

            res.status(400).json({
                msg: "Loan repayment failed",
                error: apiResponse.error,
                mobilePayment
            });
        }
    } catch (error) {
        console.error("Mobile loan repayment error:", error);
        res.status(500).json({ msg: "Server error", error: error.message });
    }
};

// Initiate mobile loan withdrawal
const initiateLoanWithdrawal = async (req, res) => {
    try {
        const { loanId, amount, reason, phoneNumber, mobileMoneyProvider } = req.body;

        if (!loanId || !amount || !phoneNumber || !mobileMoneyProvider) {
            return res.status(400).json({ msg: "Please provide all required fields" });
        }

        const loan = await Loan.findById(loanId);
        if (!loan) {
            return res.status(404).json({ msg: "Loan not found" });
        }

        if (loan.borrower.toString() !== req.user.id) {
            return res.status(403).json({ msg: "Access denied" });
        }

        if (loan.status !== "approved") {
            return res.status(400).json({ msg: "Only approved loans can be withdrawn from" });
        }

        const availableForWithdrawal = loan.amount - (loan.withdrawnAmount || 0);
        if (amount > availableForWithdrawal) {
            return res.status(400).json({
                msg: `Insufficient amount available for withdrawal. Available: $${availableForWithdrawal.toFixed(2)}`
            });
        }

        // Create mobile payment record
        const mobilePayment = new MobilePayment({
            user: req.user.id,
            transactionType: "loan_withdrawal",
            relatedId: loan._id,
            amount,
            phoneNumber,
            mobileMoneyProvider,
            status: "pending",
            description: reason || "Loan withdrawal"
        });

        await mobilePayment.save();

        // Simulate mobile money API call
        const apiResponse = await simulateMobileMoneyAPI(mobileMoneyProvider, phoneNumber, amount, "withdrawal");

        if (apiResponse.success) {
            mobilePayment.status = "completed";
            mobilePayment.transactionId = apiResponse.transactionId;
            mobilePayment.processedAt = new Date();
            await mobilePayment.save();

            // Update loan with withdrawal
            loan.withdrawals.push({
                amount,
                date: new Date(),
                reason: reason || "Loan withdrawal"
            });
            loan.withdrawnAmount = (loan.withdrawnAmount || 0) + amount;

            await loan.save();

            res.json({
                msg: "Loan withdrawal successful",
                mobilePayment,
                loan
            });
        } else {
            mobilePayment.status = "failed";
            mobilePayment.errorMessage = apiResponse.error;
            await mobilePayment.save();

            res.status(400).json({
                msg: "Loan withdrawal failed",
                error: apiResponse.error,
                mobilePayment
            });
        }
    } catch (error) {
        console.error("Mobile loan withdrawal error:", error);
        res.status(500).json({ msg: "Server error", error: error.message });
    }
};

// Get user's mobile payment history
const getMobilePaymentHistory = async (req, res) => {
    try {
        console.log(`Fetching payment history for user: ${req.user.id}`);
        
        const payments = await MobilePayment.find({ user: req.user.id })
            .populate("relatedId")
            .sort({ createdAt: -1 });

        console.log(`Found ${payments.length} payments for user ${req.user.id}`);
        console.log('Payments:', payments);

        res.json(payments);
    } catch (error) {
        console.error("Get mobile payment history error:", error);
        res.status(500).json({ msg: "Server error", error: error.message });
    }
};

// Get mobile payment status
const getMobilePaymentStatus = async (req, res) => {
    try {
        const { paymentId } = req.params;

        const payment = await MobilePayment.findById(paymentId);
        if (!payment) {
            return res.status(404).json({ msg: "Payment not found" });
        }

        if (payment.user.toString() !== req.user.id) {
            return res.status(403).json({ msg: "Access denied" });
        }

        res.json(payment);
    } catch (error) {
        console.error("Get mobile payment status error:", error);
        res.status(500).json({ msg: "Server error", error: error.message });
    }
};

export {
    initiateContributionPayment,
    initiateWithdrawalPayment,
    initiateLoanRepayment,
    initiateLoanWithdrawal,
    getMobilePaymentHistory,
    getMobilePaymentStatus
};
