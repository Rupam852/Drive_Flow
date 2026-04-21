"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteUser = exports.pendingUser = exports.rejectUser = exports.approveUser = exports.getUsers = void 0;
const User_1 = require("../models/User");
// @desc    Get all users (Admin only)
// @route   GET /api/users
// @access  Private/Admin
const getUsers = async (req, res) => {
    try {
        const users = await User_1.User.find({}).select('-passwordHash');
        res.json(users);
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.getUsers = getUsers;
// @desc    Approve user
// @route   PUT /api/users/:id/approve
// @access  Private/Admin
const approveUser = async (req, res) => {
    try {
        const user = await User_1.User.findById(req.params.id);
        if (user) {
            user.status = 'approved';
            const updatedUser = await user.save();
            res.json({ message: 'User approved successfully', user: updatedUser });
        }
        else {
            res.status(404).json({ message: 'User not found' });
        }
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.approveUser = approveUser;
// @desc    Reject user
// @route   PUT /api/users/:id/reject
// @access  Private/Admin
const rejectUser = async (req, res) => {
    try {
        const user = await User_1.User.findById(req.params.id);
        if (user) {
            user.status = 'rejected';
            const updatedUser = await user.save();
            res.json({ message: 'User rejected successfully', user: updatedUser });
        }
        else {
            res.status(404).json({ message: 'User not found' });
        }
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.rejectUser = rejectUser;
// @desc    Set user as pending
// @route   PUT /api/users/:id/pending
// @access  Private/Admin
const pendingUser = async (req, res) => {
    try {
        const user = await User_1.User.findById(req.params.id);
        if (user) {
            user.status = 'pending';
            const updatedUser = await user.save();
            res.json({ message: 'User moved to pending successfully', user: updatedUser });
        }
        else {
            res.status(404).json({ message: 'User not found' });
        }
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.pendingUser = pendingUser;
// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private/Admin
const deleteUser = async (req, res) => {
    try {
        const user = await User_1.User.findById(req.params.id);
        if (user) {
            // Prevent deleting self (admin)
            if (user.role === 'admin') {
                return res.status(400).json({ message: 'Cannot delete admin user' });
            }
            await User_1.User.findByIdAndDelete(req.params.id);
            res.json({ message: 'User deleted successfully' });
        }
        else {
            res.status(404).json({ message: 'User not found' });
        }
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.deleteUser = deleteUser;
//# sourceMappingURL=userController.js.map