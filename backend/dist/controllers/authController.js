"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedAdmin = exports.loginUser = exports.registerUser = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = require("../models/User");
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
        const salt = await bcryptjs_1.default.genSalt(10);
        const passwordHash = await bcryptjs_1.default.hash(password, salt);
        const user = await User_1.User.create({
            name,
            email,
            passwordHash,
            role: 'user',
            status: 'pending',
        });
        if (user) {
            res.status(201).json({
                message: 'Registration successful. Please wait for admin approval.',
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
            if (user.status === 'pending') {
                res.status(403).json({ message: 'Please wait for admin approval. Contact admin.' });
                return;
            }
            if (user.status === 'rejected') {
                res.status(403).json({ message: 'Your profile has been rejected. Please contact admin.' });
                return;
            }
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