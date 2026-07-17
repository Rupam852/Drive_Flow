"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const authController_1 = require("../controllers/authController");
const passwordController_1 = require("../controllers/passwordController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = express_1.default.Router();
router.get('/ping', (req, res) => { res.json({ status: 'ok' }); });
router.get('/app-version', authController_1.getAppVersion);
router.post('/register', authController_1.registerUser);
router.post('/login', authController_1.loginUser);
router.post('/verify-email', authController_1.verifyEmail);
router.post('/resend-otp', authController_1.resendOtp);
router.post('/forgot-password', passwordController_1.forgotPassword);
router.post('/reset-password', passwordController_1.resetPassword);
router.put('/profile', authMiddleware_1.protect, authController_1.updateProfile);
exports.default = router;
//# sourceMappingURL=authRoutes.js.map