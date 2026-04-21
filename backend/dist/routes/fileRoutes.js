"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const fileController_1 = require("../controllers/fileController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = express_1.default.Router();
// Stats
router.get('/stats', authMiddleware_1.protect, fileController_1.getDriveStats);
router.get('/admin-stats', authMiddleware_1.protect, fileController_1.getDriveStats);
router.get('/admin-logs', authMiddleware_1.protect, authMiddleware_1.admin, fileController_1.getActivityLogs);
router.get('/user-logs', authMiddleware_1.protect, fileController_1.getUserActivityLogs);
router.delete('/admin-logs', authMiddleware_1.protect, authMiddleware_1.admin, fileController_1.clearActivityLogs);
router.get('/admin-trash', authMiddleware_1.protect, authMiddleware_1.admin, fileController_1.getTrashedFiles);
router.get('/admin-users', authMiddleware_1.protect, authMiddleware_1.admin, fileController_1.getAllUsers);
router.put('/:id/restore', authMiddleware_1.protect, authMiddleware_1.admin, fileController_1.restoreFile);
router.put('/trash/restore-all', authMiddleware_1.protect, authMiddleware_1.admin, fileController_1.restoreAll);
router.put('/trash/restore-bulk', authMiddleware_1.protect, authMiddleware_1.admin, fileController_1.restoreBulk);
router.put('/admin-users/status', authMiddleware_1.protect, authMiddleware_1.admin, fileController_1.updateUserStatus);
router.delete('/admin-users/:userId', authMiddleware_1.protect, authMiddleware_1.admin, fileController_1.deleteUser);
router.delete('/trash/all', authMiddleware_1.protect, authMiddleware_1.admin, fileController_1.emptyTrash);
router.delete('/trash', authMiddleware_1.protect, authMiddleware_1.admin, fileController_1.deletePermanently);
router.post('/bulk-download', authMiddleware_1.protect, authMiddleware_1.approved, fileController_1.bulkDownload);
// CRUD
router.get('/search', authMiddleware_1.protect, fileController_1.searchFiles);
router.get('/', authMiddleware_1.protect, fileController_1.listFiles);
router.post('/upload', authMiddleware_1.protect, authMiddleware_1.approved, fileController_1.upload.single('file'), fileController_1.uploadFile);
router.post('/folder', authMiddleware_1.protect, authMiddleware_1.approved, fileController_1.createFolder);
router.post('/doc', authMiddleware_1.protect, authMiddleware_1.approved, fileController_1.createDoc);
router.put('/move', authMiddleware_1.protect, authMiddleware_1.approved, fileController_1.moveFiles);
router.put('/:id/rename', authMiddleware_1.protect, authMiddleware_1.approved, fileController_1.renameFile);
router.delete('/', authMiddleware_1.protect, authMiddleware_1.approved, fileController_1.trashFiles);
router.get('/:id/download', authMiddleware_1.protect, authMiddleware_1.approved, fileController_1.downloadFile);
router.get('/:id/direct-download', authMiddleware_1.protect, authMiddleware_1.approved, fileController_1.getDownloadLink);
router.post('/upload-session', authMiddleware_1.protect, authMiddleware_1.approved, fileController_1.getUploadSession);
router.post('/upload-complete', authMiddleware_1.protect, authMiddleware_1.approved, fileController_1.finalizeUpload);
router.get('/:id/metadata', authMiddleware_1.protect, fileController_1.getFileMetadata);
exports.default = router;
//# sourceMappingURL=fileRoutes.js.map