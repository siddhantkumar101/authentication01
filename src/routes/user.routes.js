import { Router } from "express";
import { 
    registerUser, 
    loginUser, 
    verifyOTP, 
    logoutUser, 
    refreshAccessToken, 
    toggleMFA 
} from "../controllers/user.controller.js";
import { verifyJWT } from "../middlewares/auth.js";

const router = Router();

router.route("/register").post(registerUser);

router.route("/login").post(loginUser);

router.route("/verify-otp").post(verifyOTP);

router.route("/refresh-token").post(refreshAccessToken);

router.route("/logout").post(verifyJWT, logoutUser);

router.route("/toggle-mfa").post(verifyJWT, toggleMFA);

export default router;