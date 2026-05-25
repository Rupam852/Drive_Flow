import express from 'express';
import { registerUser, loginUser, verifyEmail, resendOtp, getAppVersion } from '../controllers/authController';
import { forgotPassword, resetPassword } from '../controllers/passwordController';

const router = express.Router();

router.get('/app-version', getAppVersion);
router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/verify-email', verifyEmail);
router.post('/resend-otp', resendOtp);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

export default router;
