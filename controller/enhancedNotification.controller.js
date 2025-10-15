import Notification from "../models/notification.model.js";
import User from "../models/User.js";
import Group from "../models/group.model.js";
import Contribution from "../models/contribution.model.js";
import Loan from "../models/loan.model.js";
import GroupSettings from "../models/groupSettings.model.js";

// Mock email and SMS service - replace with actual services in production
const sendEmail = async (recipient, subject, message) => {
    console.log(`Email sent to ${recipient} with subject: ${subject}`);
    return { success: true };
};

const sendSMS = async (phoneNumber, message) => {
    console.log(`SMS sent to ${phoneNumber}: ${message}`);
    return { success: true };
};

// Create a notification
export const createNotification = async (req, res) => {
    try {
        const {
            recipientUserId,
            recipientGroupId,
            title,
            message,
            type,
            relatedEntity,
            deliveryMethods,
            priority,
            scheduledFor
        } = req.body;

        const senderId = req.user.id;

        // Validate recipient
        if (!recipientUserId && !recipientGroupId) {
            return res.status(400).json({
                message: "Either recipientUserId or recipientGroupId is required"
            });
        }

        // Create notification
        const notification = new Notification({
            sender: senderId,
            title,
            message,
            type: type || "general",
            priority: priority || "medium"
        });

        // Set recipient
        if (recipientUserId) {
            const user = await User.findById(recipientUserId);
            if (!user) {
                return res.status(404).json({ message: "Recipient user not found" });
            }
            notification.recipientUser = recipientUserId;
        }

        if (recipientGroupId) {
            const group = await Group.findById(recipientGroupId);
            if (!group) {
                return res.status(404).json({ message: "Recipient group not found" });
            }
            notification.recipientGroup = recipientGroupId;
        }

        // Set related entity if provided
        if (relatedEntity && relatedEntity.entityType && relatedEntity.entityId) {
            notification.relatedEntity = relatedEntity;
        }

        // Set delivery methods
        if (deliveryMethods) {
            notification.deliveryMethods = {
                ...notification.deliveryMethods,
                ...deliveryMethods
            };

            // Update delivery status based on methods
            if (deliveryMethods.email) {
                notification.deliveryStatus.email = "pending";
            }
            if (deliveryMethods.sms) {
                notification.deliveryStatus.sms = "pending";
            }
        }

        // Set scheduled time if provided
        if (scheduledFor) {
            notification.scheduledFor = new Date(scheduledFor);
        }

        await notification.save();

        // Process immediate delivery if not scheduled for later
        if (!scheduledFor) {
            await processNotificationDelivery(notification);
        }

        return res.status(201).json({
            success: true,
            notification
        });
    } catch (error) {
        console.error("Error creating notification:", error);
        return res.status(500).json({
            message: "Server error",
            error: error.message
        });
    }
};

// Process notification delivery
const processNotificationDelivery = async (notification) => {
    try {
        // For in-app notifications, just mark as sent
        notification.deliveryStatus.inApp = "sent";

        // Process email delivery if enabled
        if (notification.deliveryMethods.email) {
            let recipients = [];

            if (notification.recipientUser) {
                const user = await User.findById(notification.recipientUser);
                if (user && user.email) {
                    recipients.push(user.email);
                }
            } else if (notification.recipientGroup) {
                const group = await Group.findById(notification.recipientGroup)
                    .populate("members", "email");
                
                if (group) {
                    recipients = group.members
                        .filter(member => member.email)
                        .map(member => member.email);
                }
            }

            if (recipients.length > 0) {
                try {
                    // Send emails to all recipients
                    for (const email of recipients) {
                        await sendEmail(email, notification.title, notification.message);
                    }
                    notification.deliveryStatus.email = "sent";
                } catch (error) {
                    console.error("Email delivery failed:", error);
                    notification.deliveryStatus.email = "failed";
                }
            }
        }

        // Process SMS delivery if enabled
        if (notification.deliveryMethods.sms) {
            let phoneNumbers = [];

            if (notification.recipientUser) {
                const user = await User.findById(notification.recipientUser);
                if (user && user.phoneNumber) {
                    phoneNumbers.push(user.phoneNumber);
                }
            } else if (notification.recipientGroup) {
                const group = await Group.findById(notification.recipientGroup)
                    .populate("members", "phoneNumber");
                
                if (group) {
                    phoneNumbers = group.members
                        .filter(member => member.phoneNumber)
                        .map(member => member.phoneNumber);
                }
            }

            if (phoneNumbers.length > 0) {
                try {
                    // Send SMS to all recipients
                    for (const phoneNumber of phoneNumbers) {
                        await sendSMS(phoneNumber, notification.message);
                    }
                    notification.deliveryStatus.sms = "sent";
                } catch (error) {
                    console.error("SMS delivery failed:", error);
                    notification.deliveryStatus.sms = "failed";
                }
            }
        }

        await notification.save();
        return true;
    } catch (error) {
        console.error("Error processing notification delivery:", error);
        return false;
    }
};

// Get notifications for current user
export const getUserNotifications = async (req, res) => {
    try {
        const userId = req.user.id;
        const { page = 1, limit = 10, unreadOnly = false } = req.query;

        const query = {
            recipientUser: userId
        };

        if (unreadOnly === 'true') {
            query.readBy = { $ne: userId };
        }

        const options = {
            sort: { createdAt: -1 },
            skip: (parseInt(page) - 1) * parseInt(limit),
            limit: parseInt(limit)
        };

        const notifications = await Notification.find(query, null, options);
        const total = await Notification.countDocuments(query);

        return res.status(200).json({
            success: true,
            count: notifications.length,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / parseInt(limit)),
            notifications
        });
    } catch (error) {
        console.error("Error fetching user notifications:", error);
        return res.status(500).json({
            message: "Server error",
            error: error.message
        });
    }
};

// Get notifications for a group
export const getGroupNotifications = async (req, res) => {
    try {
        const { groupId } = req.params;
        const userId = req.user.id;
        const { page = 1, limit = 10 } = req.query;

        // Verify user is member of the group
        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({ message: "Group not found" });
        }

        const isAdmin = group.admin.toString() === userId;
        const isMember = group.members.some(member => member.toString() === userId);

        if (!isAdmin && !isMember) {
            return res.status(403).json({ message: "Not authorized to view group notifications" });
        }

        const query = {
            recipientGroup: groupId
        };

        const options = {
            sort: { createdAt: -1 },
            skip: (parseInt(page) - 1) * parseInt(limit),
            limit: parseInt(limit)
        };

        const notifications = await Notification.find(query, null, options);
        const total = await Notification.countDocuments(query);

        return res.status(200).json({
            success: true,
            count: notifications.length,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / parseInt(limit)),
            notifications
        });
    } catch (error) {
        console.error("Error fetching group notifications:", error);
        return res.status(500).json({
            message: "Server error",
            error: error.message
        });
    }
};

// Mark notification as read
export const markNotificationAsRead = async (req, res) => {
    try {
        const { notificationId } = req.params;
        const userId = req.user.id;

        const notification = await Notification.findById(notificationId);
        if (!notification) {
            return res.status(404).json({ message: "Notification not found" });
        }

        // Check if user is recipient
        const isRecipient = 
            (notification.recipientUser && notification.recipientUser.toString() === userId) ||
            (notification.recipientGroup && await isUserInGroup(userId, notification.recipientGroup));

        if (!isRecipient) {
            return res.status(403).json({ message: "Not authorized to mark this notification as read" });
        }

        // Check if already read by user
        if (notification.readBy.includes(userId)) {
            return res.status(200).json({
                success: true,
                message: "Notification already marked as read"
            });
        }

        // Add user to readBy array
        notification.readBy.push(userId);
        await notification.save();

        return res.status(200).json({
            success: true,
            message: "Notification marked as read"
        });
    } catch (error) {
        console.error("Error marking notification as read:", error);
        return res.status(500).json({
            message: "Server error",
            error: error.message
        });
    }
};

// Helper function to check if user is in group
const isUserInGroup = async (userId, groupId) => {
    const group = await Group.findById(groupId);
    if (!group) return false;
    
    return group.admin.toString() === userId || 
           group.members.some(member => member.toString() === userId);
};

// Generate payment reminders
export const generatePaymentReminders = async (req, res) => {
    try {
        const { groupId } = req.params;
        const userId = req.user.id;

        // Verify user is admin of the group
        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({ message: "Group not found" });
        }

        if (group.admin.toString() !== userId) {
            return res.status(403).json({ message: "Only group admin can generate reminders" });
        }

        // Get group settings
        const settings = await GroupSettings.findOne({ group: groupId });
        if (!settings) {
            return res.status(404).json({ message: "Group settings not found" });
        }

        // Get upcoming contributions and loans
        const currentDate = new Date();
        const reminderDays = settings.notificationSettings?.reminderDaysBefore || 3;
        
        // Calculate the date range for reminders
        const reminderStartDate = new Date();
        const reminderEndDate = new Date();
        reminderEndDate.setDate(reminderEndDate.getDate() + reminderDays);

        // Find contributions due in the reminder period
        const upcomingContributions = await Contribution.find({
            group: groupId,
            dueDate: { $gte: reminderStartDate, $lte: reminderEndDate },
            status: { $ne: "paid" }
        }).populate("user", "name email phoneNumber");

        // Find loans due in the reminder period
        const upcomingLoanPayments = await Loan.find({
            group: groupId,
            nextPaymentDate: { $gte: reminderStartDate, $lte: reminderEndDate },
            status: "active"
        }).populate("user", "name email phoneNumber");

        // Generate notifications for contributions
        const contributionNotifications = [];
        for (const contribution of upcomingContributions) {
            const dueDate = new Date(contribution.dueDate).toLocaleDateString();
            
            const notification = new Notification({
                sender: userId,
                recipientUser: contribution.user._id,
                title: "Contribution Payment Reminder",
                message: `Your contribution payment of ${contribution.amount} is due on ${dueDate}. Please make your payment on time.`,
                type: "contribution_due",
                relatedEntity: {
                    entityType: "contribution",
                    entityId: contribution._id
                },
                deliveryMethods: {
                    inApp: true,
                    email: settings.notificationSettings?.enableEmailNotifications || false,
                    sms: settings.notificationSettings?.enableSmsNotifications || false
                },
                priority: "high"
            });

            await notification.save();
            await processNotificationDelivery(notification);
            contributionNotifications.push(notification);
        }

        // Generate notifications for loan payments
        const loanNotifications = [];
        for (const loan of upcomingLoanPayments) {
            const dueDate = new Date(loan.nextPaymentDate).toLocaleDateString();
            const paymentAmount = loan.monthlyPaymentAmount || (loan.amount / loan.durationMonths);
            
            const notification = new Notification({
                sender: userId,
                recipientUser: loan.user._id,
                title: "Loan Payment Reminder",
                message: `Your loan payment of ${paymentAmount} is due on ${dueDate}. Please make your payment on time to avoid penalties.`,
                type: "loan_due",
                relatedEntity: {
                    entityType: "loan",
                    entityId: loan._id
                },
                deliveryMethods: {
                    inApp: true,
                    email: settings.notificationSettings?.enableEmailNotifications || false,
                    sms: settings.notificationSettings?.enableSmsNotifications || false
                },
                priority: "high"
            });

            await notification.save();
            await processNotificationDelivery(notification);
            loanNotifications.push(notification);
        }

        return res.status(200).json({
            success: true,
            message: "Payment reminders generated successfully",
            contributionReminders: contributionNotifications.length,
            loanReminders: loanNotifications.length
        });
    } catch (error) {
        console.error("Error generating payment reminders:", error);
        return res.status(500).json({
            message: "Server error",
            error: error.message
        });
    }
};

// Update user notification preferences
export const updateNotificationPreferences = async (req, res) => {
    try {
        const userId = req.user.id;
        const { enableEmail, enableSms, enableInApp } = req.body;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Update user notification preferences
        if (!user.notificationPreferences) {
            user.notificationPreferences = {};
        }

        if (enableEmail !== undefined) {
            user.notificationPreferences.enableEmail = enableEmail;
        }
        
        if (enableSms !== undefined) {
            user.notificationPreferences.enableSms = enableSms;
        }
        
        if (enableInApp !== undefined) {
            user.notificationPreferences.enableInApp = enableInApp;
        }

        await user.save();

        return res.status(200).json({
            success: true,
            message: "Notification preferences updated successfully",
            preferences: user.notificationPreferences
        });
    } catch (error) {
        console.error("Error updating notification preferences:", error);
        return res.status(500).json({
            message: "Server error",
            error: error.message
        });
    }
};