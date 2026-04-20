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
router.get('/admin-trash', authMiddleware_1.protect, authMiddleware_1.admin, fileController_1.getTrashedFiles);
router.get('/admin-users', authMiddleware_1.protect, authMiddleware_1.admin, fileController_1.getAllUsers);
router.put('/:id/restore', authMiddleware_1.protect, authMiddleware_1.admin, fileController_1.restoreFile);
router.post('/bulk-download', fileController_1.bulkDownload);
// CRUD
router.get('/', authMiddleware_1.protect, fileController_1.listFiles);
router.post('/upload', authMiddleware_1.protect, authMiddleware_1.admin, fileController_1.upload.single('file'), fileController_1.uploadFile);
router.post('/folder', authMiddleware_1.protect, authMiddleware_1.admin, fileController_1.createFolder);
router.post('/doc', authMiddleware_1.protect, authMiddleware_1.admin, fileController_1.createDoc);
router.put('/move', authMiddleware_1.protect, authMiddleware_1.admin, fileController_1.moveFiles);
router.put('/:id/rename', authMiddleware_1.protect, authMiddleware_1.admin, fileController_1.renameFile);
router.delete('/', authMiddleware_1.protect, authMiddleware_1.admin, fileController_1.deleteFiles);
router.get('/:id/download', authMiddleware_1.protect, fileController_1.downloadFile);
exports.default = router;
//# sourceMappingURL=fileRoutes.js.map