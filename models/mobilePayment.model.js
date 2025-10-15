import mongoose from "mongoose";

const MobilePaymentSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    transactionType: {
        type: String,
        enum: ["contribution", "withdrawal", "loan_repayment", "loan_withdrawal"],
        required: true
    },
    relatedId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    }, // ID of the related contribution or loan
    amount: {
        type: Number,
        required: true,
        min: 0.01,
        validate: {
            validator: function(v) {
                return v > 0 && !isNaN(v);
            },
            message: 'Amount must be a positive number'
        }
    },
    phoneNumber: {
        type: String,
        required: true
    },
    mobileMoneyProvider: {
        type: String,
        enum: ["momo", "airtel", "orange"],
        required: true
    },
    status: {
        type: String,
        enum: ["pending", "processing", "completed", "failed", "cancelled"],
        default: "pending"
    },
    transactionId: {
        type: String,
        unique: true
    }, // External transaction ID from mobile money provider
    reference: {
        type: String,
        unique: true
    }, // Internal reference number
    description: {
        type: String
    },
    errorMessage: {
        type: String
    },
    processedAt: {
        type: Date
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed
    } // Additional data from mobile money provider
}, { timestamps: true });

// Generate unique reference number
MobilePaymentSchema.pre('save', async function(next) {
    if (!this.reference) {
        const timestamp = Date.now().toString();
        const random = Math.random().toString(36).substr(2, 5).toUpperCase();
        this.reference = `IKB${timestamp}${random}`;
    }
    next();
});

const MobilePayment = mongoose.model("MobilePayment", MobilePaymentSchema);
export default MobilePayment;
