import mongoose from "mongoose";

const GroupSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true,
    unique: true 
  },
  description: { 
    type: String 
  },
  members: [{ 
    type: mongoose.Schema.Types.ObjectId,
    ref: "User" 
  }],
  pendingRequests: [
    { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  ],
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true // Always required to track who created the group
  },
  groupadmin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: function() { return this.isNew && this.status === "active"; } // required only for active groups
  },
  status: {
    type: String,
    enum: ["pending", "active", "rejected"],
    default: "pending" // All new groups require approval
  },
  rejectionReason: {
    type: String,
    default: null
  }
}, { timestamps: true });

const Group = mongoose.model("Group", GroupSchema);
export default Group;
