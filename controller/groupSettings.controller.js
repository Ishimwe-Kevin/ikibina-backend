import GroupSettings from "../models/groupSettings.model.js";

// Get group settings
export const getGroupSettings = async (req, res) => {
  try {
    const { groupId } = req.params;
    const settings = await GroupSettings.findOne({ group: groupId });
    if (!settings) {
      return res.status(404).json({ message: "Settings not found" });
    }
    res.json(settings);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Update group settings
export const updateGroupSettings = async (req, res) => {
  try {
    const { groupId } = req.params;
    const update = {
      ...req.body,
      updatedBy: req.user._id,
    };
    const settings = await GroupSettings.findOneAndUpdate(
      { group: groupId },
      update,
      { new: true, upsert: true }
    );
    res.json(settings);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Add new rule
export const addGroupRule = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { title, description } = req.body;
    if (!title || !description) {
      return res.status(400).json({ message: "Title and description required" });
    }

    const settings = await GroupSettings.findOneAndUpdate(
      { group: groupId },
      {
        $push: {
          rules: { title, description, isActive: true },
        },
        updatedBy: req.user._id,
      },
      { new: true, upsert: true }
    );
    res.json(settings);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Update rule
export const updateGroupRule = async (req, res) => {
  try {
    const { groupId, ruleId } = req.params;
    const { title, description, isActive } = req.body;

    const settings = await GroupSettings.findOneAndUpdate(
      { group: groupId, "rules._id": ruleId },
      {
        $set: {
          "rules.$.title": title,
          "rules.$.description": description,
          "rules.$.isActive": isActive,
          updatedBy: req.user._id,
        },
      },
      { new: true }
    );

    if (!settings) {
      return res.status(404).json({ message: "Rule not found" });
    }
    res.json(settings);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Delete rule
export const deleteGroupRule = async (req, res) => {
  try {
    const { groupId, ruleId } = req.params;
    const settings = await GroupSettings.findOneAndUpdate(
      { group: groupId },
      { $pull: { rules: { _id: ruleId } }, updatedBy: req.user._id },
      { new: true }
    );
    if (!settings) {
      return res.status(404).json({ message: "Rule not found" });
    }
    res.json(settings);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
