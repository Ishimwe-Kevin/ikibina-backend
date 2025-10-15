import mongoose from "mongoose";

const GroupSettingsSchema = new mongoose.Schema({
    group: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Group",
        required: true,
        unique: true
    },
    contributionSchedule: {
        frequency: {
            type: String,
            enum: ["weekly", "biweekly", "monthly"],
            default: "monthly"
        },
        dueDay: {
            type: Number,
            min: 1,
            max: 31,
            default: 1
        },
        weeklyDueDay: {
            type: String,
            enum: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
            default: "monday"
        },
        gracePeriodDays: {
            type: Number,
            default: 3,
            min: 0,
            max: 15
        }
    },
    loanSettings: {
        interestRate: {
            type: Number,
            default: 5,
            min: 0,
            max: 100
        },
        maxLoanMultiplier: {
            type: Number,
            default: 3,
            min: 1,
            max: 10
        },
        maxLoanDurationMonths: {
            type: Number,
            default: 12,
            min: 1,
            max: 60
        },
        minContributionMonthsBeforeLoan: {
            type: Number,
            default: 3,
            min: 0
        },
        requiresApproval: {
            type: Boolean,
            default: true
        },
        approvalThreshold: {
            type: Number,
            default: 50,
            min: 0,
            max: 100
        }
    },
    withdrawalSettings: {
        allowPartialWithdrawals: {
            type: Boolean,
            default: true
        },
        withdrawalFeePercentage: {
            type: Number,
            default: 0,
            min: 0,
            max: 20
        },
        withdrawalCooldownDays: {
            type: Number,
            default: 0,
            min: 0
        }
    },
    notificationSettings: {
        enableEmailNotifications: {
            type: Boolean,
            default: true
        },
        enableSmsNotifications: {
            type: Boolean,
            default: false
        },
        enableInAppNotifications: {
            type: Boolean,
            default: true
        },
        reminderDaysBefore: {
            type: Number,
            default: 3,
            min: 1,
            max: 14
        }
    },
    rules: [{
        title: {
            type: String,
            required: true
        },
        description: {
            type: String,
            required: true
        },
        isActive: {
            type: Boolean,
            default: true
        }
    }],
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }
}, {
    timestamps: true
});

// Create index for faster queries
GroupSettingsSchema.index({ group: 1 });

const GroupSettings = mongoose.model("GroupSettings", GroupSettingsSchema);

export default GroupSettings;