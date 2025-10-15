import mongoose from "mongoose";

const penaltySchema = new mongoose.Schema({
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
    enum: ["pending", "paid", "waived"],
    default: "pending"
  },
  dueDate: {
    type: Date
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

const ContributionSchema = new mongoose.Schema(
  {
    contributor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: true
    },
    amount: {
      type: Number,
      required: true
    },
    description: {
      type: String
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending"
    },
    type: {
      type: String,
      enum: ["contribution", "withdrawal"],
      default: "contribution"
    },
    withdrawalReason: {
      type: String
    },
    // Add penalties array
    penalties: [penaltySchema],
    // Add processedBy field for tracking who approved/rejected
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }
  },
  { timestamps: true }
);

// Add index for better query performance
ContributionSchema.index({ contributor: 1, group: 1 });
ContributionSchema.index({ status: 1 });
ContributionSchema.index({ createdAt: -1 });

const Contribution = mongoose.model("Contribution", ContributionSchema);

export default Contribution;