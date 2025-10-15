import jwt from "jsonwebtoken"
import User from "../models/User.js"
import Group from "../models/group.model.js"

const authMiddleware = async (req, res, next) => {
    const token = req.header("Authorization")?.replace("Bearer ", "")
    if (!token) {
        return res.status(401).json({ message: "No token, authorization denied" })
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        req.user = await User.findById(decoded.id).select("-password")
        if (!req.user) {
            return res.status(401).json({ message: "User not found, authorization denied" })
        }
        next()
    } catch (err) {
        console.error(err)
        res.status(401).json({ message: "Token is not valid" })
    }
}

const isSuperAdmin = (req, res, next) => {
    if (req.user && req.user.role === "superAdmin") {
        next()
    } else {
        res.status(403).json({ message: "Access denied, superadmin only" })
    }
}

const isGroupAdmin = (req, res, next) => {
    if (req.user && (req.user.role === "groupadmin" || req.user.role === "superAdmin")) {
        next()
    } else {
        res.status(403).json({ message: "Access denied, groupadmin only" })
    }
}

// Check if user is admin of the specific group
const isGroupAdminOfGroup = async (req, res, next) => {
    try {
        // Allow superAdmin to access any group
        if (req.user && req.user.role === "superAdmin") {
            return next()
        }

        // For groupadmin, check if they are admin of the specific group
        if (req.user && req.user.role === "groupadmin") {
            const groupId = req.params.groupId || req.params.id || req.body.groupId
            
            if (!groupId) {
                return res.status(400).json({ message: "Group ID is required" })
            }

            const group = await Group.findById(groupId)
            if (!group) {
                return res.status(404).json({ message: "Group not found" })
            }

            if (group.groupadmin.toString() === req.user._id.toString()) {
                return next()
            }
        }

        res.status(403).json({ message: "Access denied, you are not an admin of this group" })
    } catch (err) {
        console.error(err)
        res.status(500).json({ message: "Server error" })
    }
}

const isMember = (req, res, next) => {
    if (req.user && (req.user.role === "member" || req.user.role === "groupadmin" || req.user.role === "superAdmin")) {
        next()
    } else {
        res.status(403).json({ message: "Access denied, members only" })
    }
}

// Check if user is member of the specific group
const isMemberOfGroup = async (req, res, next) => {
    try {
        // Allow superAdmin to access any group
        if (req.user && req.user.role === "superAdmin") {
            return next()
        }

        const groupId = req.params.groupId || req.params.id || req.body.groupId
        
        if (!groupId) {
            return res.status(400).json({ message: "Group ID is required" })
        }

        const group = await Group.findById(groupId)
        if (!group) {
            return res.status(404).json({ message: "Group not found" })
        }

        // Check if user is admin or member of the group
        if (
            (req.user.role === "groupadmin" && group.groupadmin.toString() === req.user._id.toString()) ||
            group.members.includes(req.user._id)
        ) {
            return next()
        }

        res.status(403).json({ message: "Access denied, you are not a member of this group" })
    } catch (err) {
        console.error(err)
        res.status(500).json({ message: "Server error" })
    }
}

export { 
    authMiddleware as default, 
    isSuperAdmin, 
    isGroupAdmin, 
    isGroupAdminOfGroup,
    isMember,
    isMemberOfGroup
}
