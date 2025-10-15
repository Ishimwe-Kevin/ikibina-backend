import mongoose from "mongoose";

const NotificationSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    recipientGroup: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group"
    },
    recipientUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    message: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: ["payment_reminder", "contribution_due", "loan_due", "withdrawal_processed", "general", "system"],
      default: "general"
    },
    relatedEntity: {
      entityType: {
        type: String,
        enum: ["contribution", "loan", "payment", "group", "user"],
      },
      entityId: {
        type: mongoose.Schema.Types.ObjectId
      }
    },
    deliveryMethods: {
      inApp: {
        type: Boolean,
        default: true
      },
      email: {
        type: Boolean,
        default: false
      },
      sms: {
        type: Boolean,
        default: false
      }
    },
    deliveryStatus: {
      inApp: {
        type: String,
        enum: ["pending", "sent", "failed"],
        default: "pending"
      },
      email: {
        type: String,
        enum: ["pending", "sent", "failed", "not_applicable"],
        default: "not_applicable"
      },
      sms: {
        type: String,
        enum: ["pending", "sent", "failed", "not_applicable"],
        default: "not_applicable"
      }
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium"
    },
    roleAccess: {
      type: [String], // ["member", "groupadmin", "superadmin"]
      default: ["member", "groupadmin", "superadmin"]
    },
    readBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      }
    ],
    scheduledFor: {
      type: Date
    },
    expiresAt: {
      type: Date
    }
  },
  { timestamps: true }
);

// Create indexes for faster queries
NotificationSchema.index({ recipientUser: 1, createdAt: -1 });
NotificationSchema.index({ recipientGroup: 1, createdAt: -1 });
NotificationSchema.index({ type: 1 });
NotificationSchema.index({ "relatedEntity.entityId": 1 });
NotificationSchema.index({ scheduledFor: 1 });

const Notification = mongoose.model("Notification", NotificationSchema);

export default Notification;
