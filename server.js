import express from "express";
import connectDB from "./config/db.js";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();
connectDB();

const app = express();
app.use(cors());
app.use(express.json());

// Routes
import authRoutes from "./routes/authRoutes.js";
import contributionRoutes from "./routes/contributionRoutes.js";
import loanRoutes from "./routes/loanRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import groupRoutes from "./routes/groupRoutes.js";
import mobilePaymentRoutes from "./routes/mobilePaymentRoutes.js";
import onlinePaymentRoutes from "./routes/onlinePaymentRoutes.js";
// import groupSettingsRoutes from "./routes/groupSettingsRoutes.js";

app.use("/api/auth", authRoutes);
app.use("/api/contributions", contributionRoutes);
app.use("/api/loans", loanRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/groups", groupRoutes);
app.use("/api/mobile-payments", mobilePaymentRoutes);
app.use("/api/online-payments", onlinePaymentRoutes);
// app.use("/api/group-settings", groupSettingsRoutes);


const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
     console.log(`🚀 Server running on port ${PORT}`)
);
