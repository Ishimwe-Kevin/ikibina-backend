import mongoose from "mongoose";

const PenaltySchema = new mongoose.Schema({
  amount: { 
    type: Number, 
    required: true 
  },
  reason: { 
    type: String, 
    required: true 
  },
  type: {
    type: String,
    enum: ["late_payment", "default", "administrative", "other"],
    default: "late_payment"
  },
  status: {
    type: String,
    enum: ["pending", "paid", "waived", "overdue"],
    default: "pending"
  },
  dueDate: {
    type: Date
  },
  paidDate: {
    type: Date
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  }
}, { timestamps: true });

const NonPerformingRecordSchema = new mongoose.Schema({
  reason: {
    type: String,
    required: true
  },
  remarks: {
    type: String
  },
  dateReported: {
    type: Date,
    default: Date.now
  },
  reportedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  evidence: [{
    type: String // URLs to evidence files
  }]
}, { timestamps: true });

const LoanSchema = new mongoose.Schema({
  amount: { 
    type: Number, 
    required: true 
  },
  interestRate: { 
    type: Number, 
    required: true 
  },
  termMonths: { 
    type: Number, 
    required: true 
  },
  purpose: {
    type: String,
    required: true
  },
  borrower: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true 
  },
  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Group",
    required: true
  },
  status: { 
    type: String, 
    enum: ["pending", "approved", "rejected", "active", "completed", "defaulted", "non_performing"], 
    default: "pending" 
  },
  repayments: [{
    amount: {
      type: Number,
      required: true
    },
    date: {
      type: Date,
      default: Date.now
    },
    paymentMethod: {
      type: String,
      enum: ["cash", "mobile_money", "bank_transfer"],
      default: "cash"
    },
    transactionId: {
      type: String
    }
  }],
  repaidAmount: {
    type: Number,
    default: 0
  },
  nextPayment: {
    type: Date
  },
  withdrawals: [{
    amount: {
      type: Number,
      required: true
    },
    date: {
      type: Date,
      default: Date.now
    },
    reason: {
      type: String
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }
  }],
  withdrawnAmount: {
    type: Number,
    default: 0
  },
  penalties: [PenaltySchema],
  nonPerformingRecords: [NonPerformingRecordSchema],
  disbursementDate: {
    type: Date
  },
  completionDate: {
    type: Date
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  rejectedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  rejectionReason: {
    type: String
  }
}, { timestamps: true });

// Virtual for total owed amount
LoanSchema.virtual('totalOwed').get(function() {
  const principal = this.amount || 0;
  const interest = principal * (this.interestRate || 0) / 100;
  return principal + interest;
});

// Virtual for remaining balance
LoanSchema.virtual('remainingBalance').get(function() {
  return Math.max(0, (this.amount || 0) - (this.repaidAmount || 0));
});

// Virtual for available withdrawal amount
LoanSchema.virtual('availableForWithdrawal').get(function() {
  return Math.max(0, (this.amount || 0) - (this.withdrawnAmount || 0));
});

// Virtual for total penalties amount
LoanSchema.virtual('totalPenalties').get(function() {
  return (this.penalties || []).reduce((sum, penalty) => sum + (penalty.amount || 0), 0);
});

// Virtual for pending penalties amount
LoanSchema.virtual('pendingPenalties').get(function() {
  return (this.penalties || [])
    .filter(penalty => penalty.status === 'pending' || penalty.status === 'overdue')
    .reduce((sum, penalty) => sum + (penalty.amount || 0), 0);
});

// Index for better query performance
LoanSchema.index({ borrower: 1, status: 1 });
LoanSchema.index({ groupId: 1 });
LoanSchema.index({ status: 1 });
LoanSchema.index({ createdAt: -1 });

const Loan = mongoose.model("Loan", LoanSchema);
export default Loan;