import Notification from "../models/notification.model.js";
import Group from "../models/group.model.js";

// Create notification (superadmin or groupadmin)
const createNotification = async (req, res) => {
  try {
    const { groupId, recipientUserId, message, roleAccess } = req.body;

    if (!message) return res.status(400).json({ msg: "Message is required" });

    // Group admin can only send to their own groups
    if (req.user.role.toLowerCase() === "groupadmin" && groupId) {
      const group = await Group.findById(groupId);
      if (!group || !group.members.includes(req.user.id)) {
        return res.status(403).json({ msg: "Not authorized to send to this group" });
      }
    }

    const notification = new Notification({
      sender: req.user.id,
      recipientGroup: groupId || null,
      recipientUser: recipientUserId || null,
      message,
      roleAccess: roleAccess?.map(r => r.toLowerCase()) || ["member", "groupadmin", "superadmin"]
    });

    await notification.save();
    res.status(201).json({ msg: "Notification created", notification });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
};

// Get my notifications
const getMyNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({
      $or: [
        { recipientUser: req.user.id },
        { recipientGroup: { $in: req.user.groups } }, // assume req.user.groups is populated from auth
        { recipientGroup: null } // global
      ],
      roleAccess: { $in: [req.user.role.toLowerCase()] }
    }).sort({ createdAt: -1 });

    res.json(notifications);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
};

// Mark notification as read
const markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) return res.status(404).json({ msg: "Notification not found" });

    if (!notification.readBy.includes(req.user.id)) {
      notification.readBy.push(req.user.id);
      await notification.save();
    }

    res.json({ msg: "Notification marked as read", notification });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
};

export { createNotification, getMyNotifications, markAsRead };
