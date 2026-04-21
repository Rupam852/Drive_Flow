import { Request, Response } from 'express';
import { User } from '../models/User';

// @desc    Get all users (Admin only)
// @route   GET /api/users
// @access  Private/Admin
export const getUsers = async (req: Request, res: Response) => {
  try {
    const users = await User.find({}).select('-passwordHash');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

// @desc    Approve user
// @route   PUT /api/users/:id/approve
// @access  Private/Admin
export const approveUser = async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.params.id);
    if (user) {
      user.status = 'approved';
      const updatedUser = await user.save();
      res.json({ message: 'User approved successfully', user: updatedUser });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

// @desc    Reject user
// @route   PUT /api/users/:id/reject
// @access  Private/Admin
export const rejectUser = async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.params.id);
    if (user) {
      user.status = 'rejected';
      const updatedUser = await user.save();
      res.json({ message: 'User rejected successfully', user: updatedUser });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

// @desc    Set user as pending
// @route   PUT /api/users/:id/pending
// @access  Private/Admin
export const pendingUser = async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.params.id);
    if (user) {
      user.status = 'pending';
      const updatedUser = await user.save();
      res.json({ message: 'User moved to pending successfully', user: updatedUser });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private/Admin
export const deleteUser = async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.params.id);
    if (user) {
      // Prevent deleting self (admin)
      if (user.role === 'admin') {
        return res.status(400).json({ message: 'Cannot delete admin user' });
      }
      await User.findByIdAndDelete(req.params.id);
      res.json({ message: 'User deleted successfully' });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};
