"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedAdmin = exports.resendOtp = exports.verifyEmail = exports.loginUser = exports.registerUser = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = require("../models/User");
const logger_1 = require("../utils/logger");
const mailer_1 = require("../utils/mailer");
const generateToken = (id, role) => {
    return jsonwebtoken_1.default.sign({ id, role }, process.env.JWT_SECRET, {
        expiresIn: '30d',
    });
};
const registerUser = async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const userExists = await User_1.User.findOne({ email });
        if (userExists) {
            res.status(400);
            throw new Error('User already exists');
        }
        if (password.length < 6 || password.length > 9) {
            res.status(400);
            throw new Error('Password must be between 6 and 9 characters long');
        }
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
        const salt = await bcryptjs_1.default.genSalt(10);
        const passwordHash = await bcryptjs_1.default.hash(password, salt);
        const user = await User_1.User.create({
            name,
            email,
            passwordHash,
            role: 'user',
            status: 'pending',
            isEmailVerified: false,
            emailVerificationOtp: otp,
            otpExpires,
        });
        if (user) {
            // Send OTP email asynchronously to prevent blocking the response
            // If it fails, the user can use "Resend OTP" on the verification page
            (0, mailer_1.sendOtpEmail)(user.email, otp).catch((err) => {
                console.error('Failed to send initial OTP email:', err);
            });
            await (0, logger_1.logActivity)(user._id, 'register', `New account registered: ${name}`);
            res.status(201).json({
                message: 'Registration successful. OTP sent to email.',
                requireOtp: true,
                email: user.email
            });
        }
        else {
            res.status(400);
            throw new Error('Invalid user data');
        }
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.registerUser = registerUser;
const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User_1.User.findOne({ email });
        if (user && (await bcryptjs_1.default.compare(password, user.passwordHash))) {
            if (!user.isEmailVerified) {
                res.status(403).json({ message: 'Email not verified. Please verify your email first.', requireOtp: true, email: user.email });
                return;
            }
            if (user.status === 'pending') {
                res.status(403).json({ message: 'Please wait for admin approval. Contact admin.' });
                return;
            }
            if (user.status === 'rejected') {
                res.status(403).json({ message: 'Your profile has been rejected. Please contact admin.' });
                return;
            }
            await (0, logger_1.logActivity)(user._id, 'login', `User logged in: ${user.name}`);
            res.json({
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                status: user.status,
                token: generateToken(user._id.toString(), user.role),
            });
        }
        else {
            res.status(401).json({ message: 'Invalid email or password' });
        }
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.loginUser = loginUser;
const verifyEmail = async (req, res) => {
    try {
        const { email, otp } = req.body;
        const user = await User_1.User.findOne({ email });
        if (!user) {
            res.status(404).json({ message: 'User not found' });
            return;
        }
        if (user.isEmailVerified) {
            res.status(400).json({ message: 'Email already verified' });
            return;
        }
        if (user.emailVerificationOtp !== otp) {
            res.status(400).json({ message: 'Invalid OTP' });
            return;
        }
        if (user.otpExpires && user.otpExpires < new Date()) {
            res.status(400).json({ message: 'OTP has expired' });
            return;
        }
        user.isEmailVerified = true;
        user.emailVerificationOtp = undefined;
        user.otpExpires = undefined;
        await user.save();
        res.status(200).json({ message: 'Email verified successfully. Please wait for admin approval.' });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.verifyEmail = verifyEmail;
const resendOtp = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User_1.User.findOne({ email });
        if (!user) {
            res.status(404).json({ message: 'User not found' });
            return;
        }
        if (user.isEmailVerified) {
            res.status(400).json({ message: 'Email already verified' });
            return;
        }
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        user.emailVerificationOtp = otp;
        user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
        await user.save();
        await (0, mailer_1.sendOtpEmail)(user.email, otp);
        res.status(200).json({ message: 'A new OTP has been sent to your email.' });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.resendOtp = resendOtp;
const seedAdmin = async () => {
    try {
        const adminEmail = 'rupambairagya08@gmail.com';
        const adminExists = await User_1.User.findOne({ email: adminEmail });
        if (!adminExists) {
            const salt = await bcryptjs_1.default.genSalt(10);
            const passwordHash = await bcryptjs_1.default.hash('Rupam@123', salt);
            await User_1.User.create({
                name: 'Admin',
                email: adminEmail,
                passwordHash,
                role: 'admin',
                status: 'approved',
                isEmailVerified: true,
            });
            console.log('Admin user seeded');
        }
    }
    catch (error) {
        console.error('Error seeding admin', error);
    }
};
exports.seedAdmin = seedAdmin;
//# sourceMappingURL=authController.js.map