import User from '../models/user.model.js'
import { ApiResponse } from '../utils/ApiResponse.js'
import { ApiError } from '../utils/ApiError.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { sendEmail } from '../utils/mail.js'
import jwt from "jsonwebtoken"

// -----------------------------------------------------------
// HELPER: Generate Access & Refresh Tokens
// -----------------------------------------------------------
const generateAccessAndRefreshTokens = async (userId) => {
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false })

        return { accessToken, refreshToken }
    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating tokens")
    }
}

// Cookie options for security
const cookieOptions = {
    httpOnly: true,
    secure: true, // Set to true in production (HTTPS)
    sameSite: 'None'
}

// -----------------------------------------------------------
// 1. REGISTER USER
// -----------------------------------------------------------
const registerUser = asyncHandler(async (req, res) => {
    const { name, email, username, password } = req.body

    if ([name, email, password, username].some((field) => field?.trim() === '')) {
        throw new ApiError(400, "All fields are required")
    }

    const existingUser = await User.findOne({ $or: [{ username }, { email }] })
    if (existingUser) {
        throw new ApiError(409, "User with email or username already exists")
    }

    const user = await User.create({
        name,
        email,
        password, // Model pre-save hook will hash this
        username: username.toLowerCase()
    })

    const createdUser = await User.findById(user._id).select("-password -refreshToken")

    return res.status(201).json(
        new ApiResponse(201, createdUser, "User Registered successfully")
    )
})

// -----------------------------------------------------------
// 2. LOGIN USER (Step 1: Password Check -> Send OTP)
// -----------------------------------------------------------
const loginUser = asyncHandler(async (req, res) => {
    const { email, password } = req.body

    if (!email || !password) {
        throw new ApiError(400, "Email and password are required")
    }

    const user = await User.findOne({ email })
    if (!user) {
        throw new ApiError(404, "User does not exist")
    }

    const isPasswordValid = await user.isPasswordCorrect(password)
    if (!isPasswordValid) {
        throw new ApiError(401, "Invalid user credentials")
    }

    // Pass sahi hai, ab OTP generate karo
    const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString()
    
    user.otp = generatedOtp
    user.otpExpiry = new Date(Date.now() + 5 * 60 * 1000) // 5 minutes validity
    await user.save({ validateBeforeSave: false })

    // Send OTP via Email
    try {
        await sendEmail(
            user.email, 
            "Login OTP Verification", 
            `Your login OTP is ${generatedOtp}. It will expire in 5 minutes.`
        )
    } catch (error) {
        throw new ApiError(500, "Error sending OTP email. Please try again.")
    }

    // Note: Tokens nahi bhej rahe, sirf confirm kar rahe hain password sahi hai
    return res.status(200).json(
        new ApiResponse(200, { email: user.email, mfaRequired: true }, "Password verified. OTP sent to email.")
    )
})

// -----------------------------------------------------------
// 3. VERIFY OTP (Step 2: Final Login & Token Issuance)
// -----------------------------------------------------------
const verifyOTP = asyncHandler(async (req, res) => {
    const { email, otp } = req.body

    if (!email || !otp) {
        throw new ApiError(400, "Email and OTP are required")
    }

    const user = await User.findOne({ email })
    if (!user || !user.otp) {
        throw new ApiError(400, "No OTP found for this user")
    }

    // Check Expiry
    if (user.otpExpiry < Date.now()) {
        throw new ApiError(410, "OTP has expired")
    }

    // Match OTP
    if (user.otp !== otp) {
        throw new ApiError(401, "Invalid OTP")
    }

    // Clear OTP and set Verified status
    user.otp = undefined
    user.otpExpiry = undefined
    user.isVerified = true 
    await user.save({ validateBeforeSave: false })

    // FINAL STEP: Generate tokens
    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id)
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken -otp -otpExpiry")

    return res.status(200)
        .cookie("accessToken", accessToken, cookieOptions)
        .cookie("refreshToken", refreshToken, cookieOptions)
        .json(new ApiResponse(200, { user: loggedInUser, accessToken, refreshToken }, "Login successful! Tokens issued."))
})

// -----------------------------------------------------------
// 4. LOGOUT USER
// -----------------------------------------------------------
const logoutUser = asyncHandler(async (req, res) => {
    // req.user verifyJWT middleware se aata hai
    await User.findByIdAndUpdate(
        req.user._id,
        { $unset: { refreshToken: 1 } },
        { new: true }
    )

    return res.status(200)
        .clearCookie("accessToken", cookieOptions)
        .clearCookie("refreshToken", cookieOptions)
        .json(new ApiResponse(200, {}, "User logged out successfully"))
})

// -----------------------------------------------------------
// 5. REFRESH ACCESS TOKEN
// -----------------------------------------------------------
const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if (!incomingRefreshToken) {
        throw new ApiError(401, "Unauthorized request")
    }

    try {
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET)

        const user = await User.findById(decodedToken?._id)
        if (!user || incomingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401, "Refresh token is invalid or expired")
        }

        const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id)

        return res.status(200)
            .cookie("accessToken", accessToken, cookieOptions)
            .cookie("refreshToken", refreshToken, cookieOptions)
            .json(new ApiResponse(200, { accessToken, refreshToken }, "Access token refreshed"))
            
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token")
    }
})

// -----------------------------------------------------------
// 6. TOGGLE MFA (Security Settings)
// -----------------------------------------------------------
const toggleMFA = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id)
    user.twoFactorEnabled = !user.twoFactorEnabled
    await user.save({ validateBeforeSave: false })

    return res.status(200).json(
        new ApiResponse(200, { twoFactorEnabled: user.twoFactorEnabled }, `MFA is now ${user.twoFactorEnabled ? 'Enabled' : 'Disabled'}`)
    )
})

export {
    registerUser,
    loginUser,
    verifyOTP,
    logoutUser,
    refreshAccessToken,
    toggleMFA
}