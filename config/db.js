// backend/config/db.js
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            // these options are not needed in mongoose v6+
            // useNewUrlParser: true,
            // useUnifiedTopology: true,
        });

        console.log("✅ MongoDB Connected...");
    } catch (err) {
        console.error("❌ MongoDB Connection Failed!");
        console.error("Reason:", err.message);

        console.log("\n👉 Fix Suggestions:");
        console.log("1. Check your MONGO_URI in .env (username, password, db name).");
        console.log("2. Make sure your IP is whitelisted in MongoDB Atlas:");
        console.log("   https://www.mongodb.com/docs/atlas/security-whitelist/");
        console.log("3. If using dynamic IP, try setting 0.0.0.0/0 (Allow from anywhere).");
        console.log("4. Make sure your database user has the correct password/roles.\n");

        process.exit(1); // stop server if DB connection fails
    }
};

export default connectDB;