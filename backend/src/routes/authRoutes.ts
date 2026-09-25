import express from 'express';
import {
  registerUser,
  loginUser,
  verifyEmail,
  resendOtp,
  getAppVersion,
  getProfile,
  updateProfile,
  sendPasswordOtp,
  verifyPasswordOtp,
  googleAuth
} from '../controllers/authController';
import { forgotPassword, resetPassword } from '../controllers/passwordController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

router.get('/ping', (req, res) => { res.json({ status: 'ok' }); });
router.get('/app-version', getAppVersion);
router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/google', googleAuth);
router.post('/verify-email', verifyEmail);
router.post('/resend-otp', resendOtp);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/profile', protect, getProfile);
router.put('/profile', protect, updateProfile);
router.post('/send-password-otp', protect, sendPasswordOtp);
router.post('/verify-password-otp', protect, verifyPasswordOtp);

export default router;
