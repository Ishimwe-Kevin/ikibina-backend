import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { createAuthAuditTrail } from "../utils/auditTrailUtils.js";

const register = async (req, res) => {
    try {
        const { name, email, password,role } = req.body;

        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({ msg: "User already exists" });
        }

       const hashedPassword = await bcrypt.hash(password, 10);
       user = new User({
         name, 
         email, 
         password: hashedPassword,
         role
        });

        await user.save();
      return res.status(201).json({ msg: "User registered successfully" });
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server error");
    }
}

const Login = async (req, res) => {
    const { email, password } = req.body;

    try {
        // Normal users from DB
        let user = await User.findOne({ email });
        if (!user) return res.status(400).json({ msg: "Invalid credentials" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ msg: "Invalid credentials" });

        const payload = { id: user.id, role: user.role };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "1h" });

        // Create audit trail for login
        await createAuthAuditTrail({
            userId: user.id,
            action: "login",
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"]
        });

        res.json({ token, 
            role: user.role
         });
         
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server error");
    }
}

const user = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select("-password");
        if (!user) {
            return res.json({ id: "admin-id", email: "ikibina@gmail.com", role: "admin" });
        }
        res.json(user);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server error");
    }

}

const getAllUsers = async (req, res) => {
    try {
        const users = await User.find().select("-password");
        res.json(users);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server error");
    }
}
const getUserById = async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select("-password");
        if (!user) {
            return res.status(404).json({ msg: "User not found" });
        }
        res.json(user);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server error");
    }
}

const logout = (req, res) => {
    // With JWT, logout is just handled on the frontend by removing the token.
    res.json({ msg: "Logged out successfully" });
}

export { register, Login, user, logout , getAllUsers , getUserById};