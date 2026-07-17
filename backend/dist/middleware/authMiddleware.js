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
    else if (req.query.downloadToken) {
        token = req.query.downloadToken;
    }
    if (token) {
        try {
            const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
            // If this is a download-specific token, restrict it to download routes
            if (decoded.purpose === 'download') {
                const isDownloadRoute = req.path.includes('/download') || req.path.includes('/bulk-download');
                if (!isDownloadRoute) {
                    return res.status(401).json({ message: 'Token not authorized for this action' });
                }
                // Verify requested file matches the token scope
                const fileId = req.params.id || req.query.fileId;
                if (decoded.fileId && fileId && decoded.fileId !== fileId) {
                    return res.status(401).json({ message: 'Token not authorized for this file' });
                }
                const requestedIds = req.query.fileIds;
                if (decoded.fileIds && requestedIds && decoded.fileIds !== requestedIds) {
                    return res.status(401).json({ message: 'Token not authorized for these files' });
                }
            }
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