"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const userController_1 = require("../controllers/userController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = express_1.default.Router();
router.get('/', authMiddleware_1.protect, authMiddleware_1.admin, userController_1.getUsers);
router.put('/:id/approve', authMiddleware_1.protect, authMiddleware_1.admin, userController_1.approveUser);
router.put('/:id/reject', authMiddleware_1.protect, authMiddleware_1.admin, userController_1.rejectUser);
router.put('/:id/pending', authMiddleware_1.protect, authMiddleware_1.admin, userController_1.pendingUser);
router.delete('/:id', authMiddleware_1.protect, authMiddleware_1.admin, userController_1.deleteUser);
exports.default = router;
//# sourceMappingURL=userRoutes.js.map