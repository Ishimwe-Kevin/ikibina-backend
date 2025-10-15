import mongoose from "mongoose";

const AuditTrailSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    action: {
        type: String,
        enum: [
            "create", "update", "delete", "view", 
            "payment", "withdrawal", "login", "logout", 
            "password_change", "settings_change", "other"
        ],
        required: true
    },
    entityType: {
        type: String,
        enum: [
            "user", "group", "contribution", "loan", 
            "payment", "notification", "report", "settings"
        ],
        required: true
    },
    entityId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    previousState: {
        type: Object
    },
    newState: {
        type: Object
    },
    ipAddress: {
        type: String
    },
    userAgent: {
        type: String
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Create indexes for faster queries
AuditTrailSchema.index({ user: 1, createdAt: -1 });
AuditTrailSchema.index({ entityType: 1, entityId: 1 });
AuditTrailSchema.index({ action: 1 });
AuditTrailSchema.index({ createdAt: -1 });

const AuditTrail = mongoose.model("AuditTrail", AuditTrailSchema);

export default AuditTrail;