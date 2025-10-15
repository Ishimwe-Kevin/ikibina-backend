import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: true 
    },
    email: { 
        type: String, 
        required: true,
         unique: true
         },
    password: { 
        type: String,
         required: true 
        },
    role: { 
        type: String, 
        enum: ["user","member","bookkeeper", "groupadmin","author", "superAdmin"], 
        default: "user" 
    },
    phoneNumber: {
        type: String,
        required: false
    },
    mobileMoneyProvider: {
        type: String,
        enum: ["momo", "airtel", "orange", "mtn"],
        required: false
    },
    defaultPaymentMethod: {
        type: String,
        enum: ["mobile_money", "bank", "cash"],
        default: "mobile_money"
    }
}, { timestamps: true });

const User = mongoose.model("User", UserSchema);
export default User;
