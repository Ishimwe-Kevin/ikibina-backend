import mongoose from "mongoose";

const OnlinePaymentSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    group: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Group",
        required: true
    },
    transactionType: {
        type: String,
        enum: ["contribution", "withdrawal", "loan_repayment", "loan_disbursement"],
        required: true
    },
    relatedId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    }, // ID of the related contribution or loan
    amount: {
        type: Number,
        required: true
    },
    paymentMethod: {
        type: String,
        enum: ["credit_card", "debit_card", "bank_transfer", "paypal", "mobile_money", "other"],
        required: true
    },
    mobileMoneyProvider: {
        type: String,
        enum: ["momo", "airtel", "orange", "mtn"],
        required: function() {
            return this.paymentMethod === "mobile_money";
        }
    },
    phoneNumber: {
        type: String,
        required: function() {
            return this.paymentMethod === "mobile_money";
        }
    },
    status: {
        type: String,
        enum: ["pending", "processing", "completed", "failed", "cancelled"],
        default: "pending"
    },
    transactionId: {
        type: String,
        unique: true,
        sparse: true
    }, // External transaction ID from payment provider
    reference: {
        type: String,
        unique: true,
        required: true
    }, // Internal reference number
    paymentDetails: {
        type: Object
    }, // Additional payment details from provider
    description: {
        type: String
    },
    errorMessage: {
        type: String
    },
    processedAt: {
        type: Date
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Create index for faster queries
OnlinePaymentSchema.index({ user: 1, createdAt: -1 });
OnlinePaymentSchema.index({ group: 1, createdAt: -1 });
OnlinePaymentSchema.index({ status: 1 });

const OnlinePayment = mongoose.model("OnlinePayment", OnlinePaymentSchema);

export default OnlinePayment;