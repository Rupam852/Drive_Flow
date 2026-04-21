import express from 'express';
import { getUsers, approveUser, rejectUser, pendingUser, deleteUser } from '../controllers/userController';
import { protect, admin } from '../middleware/authMiddleware';

const router = express.Router();

router.get('/', protect, admin, getUsers);
router.put('/:id/approve', protect, admin, approveUser);
router.put('/:id/reject', protect, admin, rejectUser);
router.put('/:id/pending', protect, admin, pendingUser);
router.delete('/:id', protect, admin, deleteUser);

export default router;
