import express from 'express';
import {
  getAiConfig,
  updateAiConfig,
  testAiConnection,
  assistNotification,
} from '../controllers/aiController';
import { protect, admin } from '../middleware/authMiddleware';

const router = express.Router();

// Admin-protected AI Configuration and assistance endpoints
router.get('/config', protect, admin, getAiConfig);
router.put('/config', protect, admin, updateAiConfig);
router.post('/test', protect, admin, testAiConnection);
router.post('/assist', protect, admin, assistNotification);

export default router;
