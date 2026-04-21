"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.approved = exports.admin = exports.protect = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = require("../models/User");
const protect = async (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }
    else if (req.query.token) {
        token = req.query.token;
    }
    if (token) {
        try {
            const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
            req.user = (await User_1.User.findById(decoded.id).select('-passwordHash'));
            return next();
        }
        catch (error) {
            return res.status(401).json({ message: 'Not authorized, token failed' });
        }
    }
    if (!token) {
        return res.status(401).json({ message: 'Not authorized, no token' });
    }
};
exports.protect = protect;
const admin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    }
    else {
        res.status(401).json({ message: 'Not authorized as an admin' });
    }
};
exports.admin = admin;
const approved = (req, res, next) => {
    if (req.user && req.user.status === 'approved') {
        next();
    }
    else {
        res.status(403).json({ message: 'Account not approved. Please contact admin.' });
    }
};
exports.approved = approved;
//# sourceMappingURL=authMiddleware.js.map