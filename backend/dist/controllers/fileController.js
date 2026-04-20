"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllUsers = exports.restoreFile = exports.getTrashedFiles = exports.getActivityLogs = exports.bulkDownload = exports.getDriveStats = exports.downloadFile = exports.deleteFiles = exports.moveFiles = exports.renameFile = exports.createDoc = exports.createFolder = exports.uploadFile = exports.listFiles = exports.upload = void 0;
const stream_1 = require("stream");
const multer_1 = __importDefault(require("multer"));
const zipLib = require('archiver');
const googleDrive_1 = __importDefault(require("../config/googleDrive"));
const FileMetadata_1 = require("../models/FileMetadata");
const ActivityLog_1 = require("../models/ActivityLog");
const User_1 = require("../models/User");
const logger_1 = require("../utils/logger");
const DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;
// Use memory storage so we can stream to Drive
exports.upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
// Helper to buffer → Readable stream
const bufferToStream = (buffer) => {
    const readable = new stream_1.Readable();
    readable.push(buffer);
    readable.push(null);
    return readable;
};
// Helper to calculate folder size recursively from DB
const getFolderSize = async (folderId) => {
    try {
        const children = await FileMetadata_1.FileMetadata.find({ parentId: folderId, status: 'active' });
        let total = 0;
        for (const child of children) {
            if (child.type === 'folder') {
                total += await getFolderSize(child.fileId);
            }
            else {
                total += (child.size || 0);
            }
        }
        return total;
    }
    catch (err) {
        console.error(`Error calculating size for folder ${folderId}:`, err);
        return 0;
    }
};
// @desc  List all files/folders
// @route GET /api/files?parentId=xxx
const listFiles = async (req, res) => {
    try {
        const parentId = req.query.parentId || DRIVE_FOLDER_ID;
        console.log(`[listFiles] Requesting files for parentId: ${parentId}`);
        const driveRes = await googleDrive_1.default.files.list({
            q: `'${parentId}' in parents and trashed = false`,
            fields: 'files(id, name, mimeType, size, createdTime, modifiedTime)',
            orderBy: 'folder,name',
        });
        const files = driveRes.data.files || [];
        // Calculate sizes for folders
        const filesWithFolderSizes = await Promise.all(files.map(async (file) => {
            if (file.mimeType === 'application/vnd.google-apps.folder') {
                const folderSize = await getFolderSize(file.id);
                return { ...file, size: folderSize.toString() };
            }
            return file;
        }));
        res.json(filesWithFolderSizes);
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.listFiles = listFiles;
// @desc  Upload a file
// @route POST /api/files/upload
const uploadFile = async (req, res) => {
    try {
        if (!req.file) {
            res.status(400).json({ message: 'No file uploaded' });
            return;
        }
        const parentId = req.body.parentId || DRIVE_FOLDER_ID;
        const response = await googleDrive_1.default.files.create({
            requestBody: {
                name: req.file.originalname,
                parents: [parentId],
            },
            media: {
                mimeType: req.file.mimetype,
                body: bufferToStream(req.file.buffer),
            },
            fields: 'id, name, mimeType, size',
        });
        await FileMetadata_1.FileMetadata.create({
            fileId: response.data.id ?? '',
            name: response.data.name ?? 'Untitled',
            type: response.data.mimeType ?? 'application/octet-stream',
            size: Number(response.data.size ?? 0),
            ownerUserId: req.user?._id,
            parentId,
            status: 'active',
        });
        await (0, logger_1.logActivity)(req.user?._id, 'upload', `Uploaded file: ${req.file?.originalname}`);
        res.status(201).json(response.data);
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.uploadFile = uploadFile;
// @desc  Create a folder
// @route POST /api/files/folder
const createFolder = async (req, res) => {
    try {
        const { name, parentId } = req.body;
        const parent = parentId || DRIVE_FOLDER_ID;
        const response = await googleDrive_1.default.files.create({
            requestBody: {
                name,
                mimeType: 'application/vnd.google-apps.folder',
                parents: [parent],
            },
            fields: 'id, name, mimeType',
        });
        await FileMetadata_1.FileMetadata.create({
            fileId: response.data.id ?? '',
            name: response.data.name ?? 'Untitled',
            type: 'folder',
            ownerUserId: req.user?._id,
            parentId: parent,
            status: 'active',
        });
        await (0, logger_1.logActivity)(req.user?._id, 'create_folder', `Created folder: ${name}`);
        res.status(201).json(response.data);
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.createFolder = createFolder;
// @desc  Create a Google Doc
// @route POST /api/files/doc
const createDoc = async (req, res) => {
    try {
        const { name, parentId } = req.body;
        const parent = parentId || DRIVE_FOLDER_ID;
        const response = await googleDrive_1.default.files.create({
            requestBody: {
                name,
                mimeType: 'application/vnd.google-apps.document',
                parents: [parent],
            },
            fields: 'id, name, mimeType, webViewLink',
        });
        await FileMetadata_1.FileMetadata.create({
            fileId: response.data.id ?? '',
            name: response.data.name ?? 'Untitled',
            type: 'application/vnd.google-apps.document',
            ownerUserId: req.user?._id,
            parentId: parent,
            status: 'active',
        });
        res.status(201).json(response.data);
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.createDoc = createDoc;
// @desc  Rename a file/folder
// @route PUT /api/files/:id/rename
const renameFile = async (req, res) => {
    try {
        const { name } = req.body;
        const fileId = req.params['id'];
        const response = await googleDrive_1.default.files.update({
            fileId,
            requestBody: { name },
            fields: 'id, name',
        });
        await FileMetadata_1.FileMetadata.findOneAndUpdate({ fileId }, { name });
        await (0, logger_1.logActivity)(req.user?._id, 'rename', `Renamed file ID ${fileId} to ${name}`);
        res.json(response.data);
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.renameFile = renameFile;
// @desc  Move file(s) to another folder
// @route PUT /api/files/move
const moveFiles = async (req, res) => {
    try {
        const { fileIds, targetParentId, newParentId } = req.body;
        const targetId = targetParentId || newParentId;
        const results = [];
        for (const fileId of fileIds) {
            const fileData = await googleDrive_1.default.files.get({ fileId, fields: 'parents' });
            const previousParents = (fileData.data.parents || []).join(',');
            const response = await googleDrive_1.default.files.update({
                fileId,
                addParents: targetId,
                removeParents: previousParents,
                fields: 'id, parents',
            });
            await FileMetadata_1.FileMetadata.findOneAndUpdate({ fileId }, { parentId: targetId });
            results.push(response.data);
        }
        await (0, logger_1.logActivity)(req.user?._id, 'move', `Moved ${fileIds.length} files to folder ID ${targetId}`);
        res.json(results);
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.moveFiles = moveFiles;
// @desc  Delete file(s)
// @route DELETE /api/files
const deleteFiles = async (req, res) => {
    try {
        const { fileIds } = req.body;
        for (const fileId of fileIds) {
            await googleDrive_1.default.files.update({ fileId, requestBody: { trashed: true } });
            await FileMetadata_1.FileMetadata.findOneAndUpdate({ fileId }, { status: 'trashed' });
        }
        await (0, logger_1.logActivity)(req.user?._id, 'delete', `Moved ${fileIds.length} files to trash`);
        res.json({ message: 'File(s) moved to trash successfully' });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.deleteFiles = deleteFiles;
// @desc  Download a file or folder (ZIP)
// @route GET /api/files/:id/download
const downloadFile = async (req, res) => {
    try {
        const fileId = req.params['id'];
        const meta = await googleDrive_1.default.files.get({ fileId, fields: 'id, name, mimeType' });
        await (0, logger_1.logActivity)(req.user?._id, 'download', `Downloaded ${meta.data.mimeType === 'application/vnd.google-apps.folder' ? 'Folder ZIP' : 'File'}: ${meta.data.name}`);
        if (meta.data.mimeType === 'application/vnd.google-apps.folder') {
            // Handle Folder ZIP
            const archive = zipLib('zip', { zlib: { level: 9 } });
            res.setHeader('Content-Disposition', `attachment; filename="${meta.data.name}.zip"`);
            res.setHeader('Content-Type', 'application/zip');
            archive.pipe(res);
            const addFolderToZip = async (fId, zip, folderPath) => {
                const listRes = await googleDrive_1.default.files.list({
                    q: `'${fId}' in parents and trashed = false`,
                    fields: 'files(id, name, mimeType)',
                });
                const items = listRes.data.files || [];
                for (const item of items) {
                    const itemPath = folderPath + item.name;
                    if (item.mimeType === 'application/vnd.google-apps.folder') {
                        await addFolderToZip(item.id, zip, itemPath + '/');
                    }
                    else if (item.mimeType?.startsWith('application/vnd.google-apps.')) {
                        // Google Docs to PDF in ZIP
                        const exportRes = await googleDrive_1.default.files.export({ fileId: item.id, mimeType: 'application/pdf' }, { responseType: 'stream' });
                        zip.append(exportRes.data, { name: itemPath + '.pdf' });
                    }
                    else {
                        const downRes = await googleDrive_1.default.files.get({ fileId: item.id, alt: 'media' }, { responseType: 'stream' });
                        zip.append(downRes.data, { name: itemPath });
                    }
                }
            };
            await addFolderToZip(fileId, archive, '');
            await archive.finalize();
        }
        else {
            // Handle single file
            const isGoogleDoc = meta.data.mimeType?.startsWith('application/vnd.google-apps.');
            if (isGoogleDoc) {
                const response = await googleDrive_1.default.files.export({ fileId, mimeType: 'application/pdf' }, { responseType: 'stream' });
                res.setHeader('Content-Disposition', `attachment; filename="${meta.data.name}.pdf"`);
                res.setHeader('Content-Type', 'application/pdf');
                response.data.pipe(res);
            }
            else {
                const response = await googleDrive_1.default.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });
                let fileName = meta.data.name || 'file';
                const mimeType = meta.data.mimeType || 'application/octet-stream';
                // Add extension if missing
                const extMap = {
                    'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif',
                    'application/pdf': '.pdf', 'application/zip': '.zip',
                    'text/plain': '.txt', 'video/mp4': '.mp4',
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx'
                };
                const hasExt = fileName.includes('.');
                if (!hasExt && extMap[mimeType]) {
                    fileName += extMap[mimeType];
                }
                res.attachment(fileName);
                res.setHeader('Content-Type', mimeType);
                response.data.pipe(res);
            }
        }
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.downloadFile = downloadFile;
// @desc  Get drive storage stats
// @route GET /api/files/stats
const getDriveStats = async (req, res) => {
    try {
        // Total files and folders in the app
        const totalFiles = await FileMetadata_1.FileMetadata.countDocuments({ status: 'active', type: { $ne: 'folder' } });
        const totalFolders = await FileMetadata_1.FileMetadata.countDocuments({ status: 'active', type: 'folder' });
        // Global app usage: Sum of ALL active files in the database
        const totalSizeRes = await FileMetadata_1.FileMetadata.aggregate([
            { $match: { status: 'active', type: { $ne: 'folder' } } },
            { $group: { _id: null, total: { $sum: '$size' } } }
        ]);
        const usedBytes = totalSizeRes[0]?.total || 0;
        // Hard limit set to 10GB as requested
        const APP_LIMIT_BYTES = 10 * 1024 * 1024 * 1024; // 10GB
        res.json({
            used: usedBytes.toString(),
            limit: APP_LIMIT_BYTES.toString(),
            totalFiles,
            totalFolders,
        });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.getDriveStats = getDriveStats;
// @desc  Bulk download multiple files as ZIP
// @route POST /api/files/bulk-download
const bulkDownload = async (req, res) => {
    try {
        const { fileIds } = req.body;
        if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
            res.status(400).json({ message: 'No file IDs provided' });
            return;
        }
        const archive = zipLib('zip', { zlib: { level: 9 } });
        res.setHeader('Content-Disposition', 'attachment; filename="bulk-download.zip"');
        res.setHeader('Content-Type', 'application/zip');
        archive.pipe(res);
        for (const fileId of fileIds) {
            try {
                const meta = await googleDrive_1.default.files.get({ fileId, fields: 'id, name, mimeType' });
                const fileName = meta.data.name || 'file';
                if (meta.data.mimeType === 'application/vnd.google-apps.folder') {
                    continue; // Folders skipped for now in bulk file ZIP
                }
                const isGoogleDoc = meta.data.mimeType?.startsWith('application/vnd.google-apps.');
                if (isGoogleDoc) {
                    const exportRes = await googleDrive_1.default.files.export({ fileId, mimeType: 'application/pdf' }, { responseType: 'stream' });
                    archive.append(exportRes.data, { name: fileName + '.pdf' });
                }
                else {
                    const downRes = await googleDrive_1.default.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });
                    archive.append(downRes.data, { name: fileName });
                }
            }
            catch (err) {
                console.error(`Error adding file ${fileId} to bulk ZIP:`, err);
            }
        }
        await archive.finalize();
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.bulkDownload = bulkDownload;
// @desc  Get all activity logs (Admin only)
// @route GET /api/files/logs
const getActivityLogs = async (req, res) => {
    try {
        const logs = await ActivityLog_1.ActivityLog.find()
            .populate('user', 'name email')
            .sort({ timestamp: -1 })
            .limit(100);
        res.json(logs);
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.getActivityLogs = getActivityLogs;
// @desc  Get all trashed files
// @route GET /api/files/trash
const getTrashedFiles = async (req, res) => {
    try {
        const files = await googleDrive_1.default.files.list({
            q: "trashed = true",
            fields: 'files(id, name, mimeType, size, modifiedTime)',
            pageSize: 100,
        });
        res.json(files.data.files);
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.getTrashedFiles = getTrashedFiles;
// @desc  Restore file from trash
// @route PUT /api/files/:id/restore
const restoreFile = async (req, res) => {
    try {
        const fileId = req.params['id'];
        await googleDrive_1.default.files.update({ fileId, requestBody: { trashed: false } });
        await FileMetadata_1.FileMetadata.findOneAndUpdate({ fileId }, { status: 'active' });
        await (0, logger_1.logActivity)(req.user?._id, 'restore', `Restored file ID ${fileId}`);
        res.json({ message: 'File restored successfully' });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.restoreFile = restoreFile;
// @desc  Get all users (Admin only)
// @route GET /api/files/users
const getAllUsers = async (req, res) => {
    try {
        const users = await User_1.User.find().select('-password').sort({ createdAt: -1 });
        res.json(users);
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.getAllUsers = getAllUsers;
//# sourceMappingURL=fileController.js.map