import express from "express"
import { register, Login, user, logout, getAllUsers , getUserById } from "../controller/user.controller.js"
import authMiddleware, { isSuperAdmin } from "../middleware/authMiddleware.js"

const router = express.Router()

router.post("/register", register)
router.post("/login", Login)
router.get("/user", authMiddleware, user)
router.get("/all", authMiddleware, isSuperAdmin, getAllUsers)
router.get("/:id", authMiddleware, getUserById)
router.post("/logout", logout)
    
export default router
