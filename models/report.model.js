import mongoose from "mongoose";

const ReportSchema = new mongoose.Schema({
  week: { type: Number, required: true },
  year: { type: Number, required: true },

  contributions: {
    totalCount: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 }
  },

  groups: {
    totalCount: { type: Number, default: 0 }
  },

  loans: {
    totalCount: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
    repaidAmount: { type: Number, default: 0 }
  },

  generatedAt: { type: Date, default: Date.now }
});

ReportSchema.index({ week: 1, year: 1 }, { unique: true });

export default mongoose.model("Report", ReportSchema);
