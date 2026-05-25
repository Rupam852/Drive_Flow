import { Request, Response } from 'express';
import { User } from '../models/User';
import { sendCustomEmail } from '../utils/mailer';

// @desc    Get all users (Admin only)
// @route   GET /api/users
// @access  Private/Admin
export const getUsers = async (req: Request, res: Response) => {
  try {
    const users = await User.find({ isEmailVerified: true }).select('-passwordHash');
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

      // Dispatch welcome activation email asynchronously
      (async () => {
        try {
          const approvedHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px; background-color: #ffffff;">
              <h2 style="color: #10b981; text-align: center; margin-bottom: 20px;">🎉 Account Approved & Activated!</h2>
              <p style="font-size: 16px; color: #333; line-height: 1.6;">Hello <strong>${user.name}</strong>,</p>
              <p style="font-size: 16px; color: #333; line-height: 1.6;">Great news! Our admin has reviewed and **approved** your DriveFlow account registration. Your digital workspace is now fully activated and ready for use.</p>
              <div style="background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <p style="font-size: 15px; color: #065f46; margin: 0; font-weight: bold;">Status: Approved & Active</p>
                <p style="font-size: 14px; color: #047857; margin: 5px 0 0 0;">You can now log in using your registered email and secure password.</p>
              </div>
              <p style="font-size: 15px; color: #333; line-height: 1.6;">Start uploading, storing, and organizing your files securely with complete high-speed encryption.</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.FRONTEND_URL || 'https://driveflowrupam.vercel.app'}/login" style="background-color: #10b981; color: #ffffff; padding: 12px 28px; text-decoration: none; font-size: 16px; font-weight: bold; border-radius: 8px; box-shadow: 0 4px 12px rgba(16,185,129,0.25); display: inline-block;">Log In to Your Workspace</a>
              </div>
              <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 25px 0;" />
              <p style="font-size: 12px; color: #888; text-align: center; margin: 0;">DriveFlow Security Operations Team</p>
            </div>
          `;
          await sendCustomEmail(user.email, '[DriveFlow] Your Account has been Approved! 🎉', approvedHtml);
        } catch (err) {
          console.error(`Failed to send approval welcome email to ${user.email}:`, err);
        }
      })();

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
