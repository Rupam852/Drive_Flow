import express from 'express';
import {
  listFiles,
  uploadFile,
  createFolder,
  createDoc,
  renameFile,
  moveFiles,
  trashFiles,
  downloadFile,
  getDriveStats,
  upload,
  bulkDownload,
  getActivityLogs,
  getUserActivityLogs,
  getTrashedFiles,
  restoreFile,
  getAllUsers,
  deletePermanently,
  emptyTrash,
  restoreBulk,
  restoreAll,
  updateUserStatus,
  deleteUser,
  clearActivityLogs,
  getUploadSession,
  finalizeUpload,
  getDownloadLink,
  searchFiles,
  getFileMetadata,
  findDuplicates,
  uploadProxy,
} from '../controllers/fileController';
import { protect, admin, approved } from '../middleware/authMiddleware';

const router = express.Router();

// Stats
router.get('/stats', protect, getDriveStats);
router.get('/admin-stats', protect, getDriveStats);
router.get('/admin-logs', protect, admin, getActivityLogs);
router.get('/user-logs', protect, getUserActivityLogs);
router.delete('/admin-logs', protect, admin, clearActivityLogs);
router.get('/admin-trash', protect, admin, getTrashedFiles);
router.get('/admin-users', protect, admin, getAllUsers);
router.get('/admin-duplicates', protect, admin, findDuplicates);
router.put('/:id/restore', protect, admin, restoreFile);
router.put('/trash/restore-all', protect, admin, restoreAll);
router.put('/trash/restore-bulk', protect, admin, restoreBulk);
router.put('/admin-users/status', protect, admin, updateUserStatus);
router.delete('/admin-users/:userId', protect, admin, deleteUser);
router.delete('/trash/all', protect, admin, emptyTrash);
router.delete('/trash', protect, admin, deletePermanently);
router.post('/bulk-download', protect, approved, bulkDownload);

// CRUD
router.get('/search', protect, searchFiles);
router.get('/', protect, listFiles);
router.post('/upload', protect, approved, upload.single('file'), uploadFile);
router.post('/folder', protect, approved, createFolder);
router.post('/doc', protect, approved, createDoc);
router.put('/move', protect, approved, moveFiles);
router.put('/:id/rename', protect, approved, renameFile);
router.delete('/', protect, approved, trashFiles);
router.get('/:id/download', protect, approved, downloadFile);
router.get('/:id/direct-download', protect, approved, getDownloadLink);
router.post('/upload-session', protect, approved, getUploadSession);
router.put('/upload-proxy', protect, approved, express.raw({ type: '*/*', limit: '10mb' }), uploadProxy);
router.post('/upload-complete', protect, approved, finalizeUpload);
router.get('/:id/metadata', protect, getFileMetadata);

export default router;
