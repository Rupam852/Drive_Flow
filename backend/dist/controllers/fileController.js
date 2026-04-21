"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFileMetadata = exports.clearActivityLogs = exports.getDownloadLink = exports.finalizeUpload = exports.getUploadSession = exports.deleteUser = exports.updateUserStatus = exports.getAllUsers = exports.emptyTrash = exports.deletePermanently = exports.restoreAll = exports.restoreBulk = exports.restoreFile = exports.getTrashedFiles = exports.getUserActivityLogs = exports.getActivityLogs = exports.searchFiles = exports.bulkDownload = exports.getDriveStats = exports.downloadFile = exports.trashFiles = exports.moveFiles = exports.renameFile = exports.createDoc = exports.createFolder = exports.uploadFile = exports.listFiles = exports.upload = void 0;
const axios_1 = __importDefault(require("axios"));
const stream_1 = require("stream");
const multer_1 = __importDefault(require("multer"));
const zipLib = require('archiver');
const googleDrive_1 = __importDefault(require("../config/googleDrive"));
const FileMetadata_1 = require("../models/FileMetadata");
const ActivityLog_1 = require("../models/ActivityLog");
const User_1 = require("../models/User");
const logger_1 = require("../utils/logger");
const mongoose_1 = __importDefault(require("mongoose"));
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
// Helper to calculate folder sizes in O(N) memory without lagging
const createFolderSizeCalculator = async () => {
    const allFiles = await FileMetadata_1.FileMetadata.find({ status: 'active' }, 'fileId parentId size type').lean();
    const childrenMap = {};
    for (const f of allFiles) {
        if (!f.parentId)
            continue;
        if (!childrenMap[f.parentId])
            childrenMap[f.parentId] = [];
        childrenMap[f.parentId].push(f);
    }
    const sizesMap = {};
    const computeSize = (folderId) => {
        if (sizesMap[folderId] !== undefined)
            return sizesMap[folderId];
        let total = 0;
        const children = childrenMap[folderId] || [];
        for (const child of children) {
            if (child.type === 'application/vnd.google-apps.folder' || child.type === 'folder') {
                total += computeSize(child.fileId);
            }
            else {
                total += (child.size || 0);
            }
        }
        sizesMap[folderId] = total;
        return total;
    };
    return computeSize;
};
// @desc  List all files/folders
// @route GET /api/files?parentId=xxx
const listFiles = async (req, res) => {
    try {
        let parentId = req.query.parentId || DRIVE_FOLDER_ID;
        // Failsafe for missing or literal 'undefined'/'null' passed from frontend
        if (!parentId || parentId === 'undefined' || parentId === 'null' || parentId === 'ROOT' || parentId.trim() === '') {
            parentId = DRIVE_FOLDER_ID;
        }
        // Remove any accidental quotes or whitespace
        parentId = parentId.replace(/['"]/g, '').trim();
        console.log(`[listFiles] Requesting files for parentId: ${parentId}`);
        const driveRes = await googleDrive_1.default.files.list({
            q: `'${parentId}' in parents and trashed = false`,
            fields: 'files(id, name, mimeType, size, createdTime, modifiedTime)',
            orderBy: 'folder,name',
        });
        const files = driveRes.data.files || [];
        // Sort: Folders first, then Natural Sort by name
        files.sort((a, b) => {
            const aIsFolder = a.mimeType === 'application/vnd.google-apps.folder';
            const bIsFolder = b.mimeType === 'application/vnd.google-apps.folder';
            if (aIsFolder && !bIsFolder)
                return -1;
            if (!aIsFolder && bIsFolder)
                return 1;
            return (a.name || '').localeCompare(b.name || '', undefined, { numeric: true, sensitivity: 'base' });
        });
        // Fast memory-based folder size calculation
        const getFolderSize = await createFolderSizeCalculator();
        const filesWithFolderSizes = files.map((file) => {
            if (file.mimeType === 'application/vnd.google-apps.folder') {
                const folderSize = getFolderSize(file.id);
                return { ...file, size: folderSize.toString() };
            }
            return file;
        });
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
        let parentId = req.body.parentId || DRIVE_FOLDER_ID;
        if (parentId === 'ROOT')
            parentId = DRIVE_FOLDER_ID;
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
            rootId: DRIVE_FOLDER_ID,
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
        let { name, parentId } = req.body;
        let parent = parentId || DRIVE_FOLDER_ID;
        if (parent === 'ROOT')
            parent = DRIVE_FOLDER_ID;
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
            name: response.data.name ?? 'Untitled Folder',
            type: 'application/vnd.google-apps.folder',
            ownerUserId: req.user?._id,
            parentId: parent,
            rootId: DRIVE_FOLDER_ID,
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
        let { name, parentId } = req.body;
        let parent = parentId || DRIVE_FOLDER_ID;
        if (parent === 'ROOT')
            parent = DRIVE_FOLDER_ID;
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
            name: response.data.name ?? 'Untitled Document',
            type: 'application/vnd.google-apps.document',
            ownerUserId: req.user?._id,
            parentId: parent,
            rootId: DRIVE_FOLDER_ID,
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
// Helper to recursively get all child file IDs
const getAllChildIds = async (folderIds) => {
    let allIds = [];
    let currentFolders = folderIds;
    while (currentFolders.length > 0) {
        const children = await FileMetadata_1.FileMetadata.find({ parentId: { $in: currentFolders } });
        if (children.length === 0)
            break;
        const childIds = children.map(c => c.fileId);
        allIds = [...allIds, ...childIds];
        // Only continue with folders for next level
        currentFolders = children
            .filter(c => c.type === 'folder')
            .map(c => c.fileId);
    }
    return allIds;
};
// @desc  Trash files (Soft delete)
const trashFiles = async (req, res) => {
    try {
        const { fileIds } = req.body;
        if (!fileIds || !Array.isArray(fileIds)) {
            res.status(400).json({ message: 'Invalid request' });
            return;
        }
        // Get all children recursively if any of these are folders
        const allNestedIds = await getAllChildIds(fileIds);
        const idsToUpdate = [...fileIds, ...allNestedIds];
        for (const id of fileIds) {
            await googleDrive_1.default.files.update({ fileId: id, requestBody: { trashed: true } });
        }
        // Update metadata for everything
        await FileMetadata_1.FileMetadata.updateMany({ fileId: { $in: idsToUpdate } }, { status: 'trashed' });
        await (0, logger_1.logActivity)(req.user?._id, 'trash', `Moved ${fileIds.length} items to trash (including nested contents)`);
        res.json({ message: 'Items moved to trash' });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.trashFiles = trashFiles;
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
                const format = req.query.format || 'pdf';
                let exportMime = 'application/pdf';
                let ext = '.pdf';
                if (meta.data.mimeType === 'application/vnd.google-apps.document') {
                    if (format === 'docx') {
                        exportMime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
                        ext = '.docx';
                    }
                }
                else if (meta.data.mimeType === 'application/vnd.google-apps.spreadsheet') {
                    if (format !== 'pdf') {
                        exportMime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
                        ext = '.xlsx';
                    }
                }
                else if (meta.data.mimeType === 'application/vnd.google-apps.presentation') {
                    if (format !== 'pdf') {
                        exportMime = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
                        ext = '.pptx';
                    }
                }
                const response = await googleDrive_1.default.files.export({ fileId, mimeType: exportMime }, { responseType: 'stream' });
                let safeName = encodeURIComponent(meta.data.name || 'file');
                // Remove existing extension if we are adding a new one
                if (safeName.toLowerCase().endsWith('.docx') || safeName.toLowerCase().endsWith('.xlsx') || safeName.toLowerCase().endsWith('.pptx') || safeName.toLowerCase().endsWith('.pdf')) {
                    safeName = safeName.substring(0, safeName.lastIndexOf('.'));
                }
                res.setHeader('Content-Disposition', `attachment; filename="${safeName}${ext}"; filename*=UTF-8''${safeName}${ext}`);
                res.setHeader('Content-Type', exportMime);
                response.data.on('error', (err) => {
                    console.error('Export stream error:', err);
                    if (!res.headersSent)
                        res.status(500).send('Download failed');
                }).pipe(res);
            }
            else {
                const format = req.query.format;
                const isConvertible = meta.data.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
                    meta.data.mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                    meta.data.mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
                if (format === 'pdf' && isConvertible) {
                    try {
                        const tempCopy = await googleDrive_1.default.files.copy({
                            fileId,
                            requestBody: {
                                name: `TEMP_CONV_${Date.now()}`,
                                mimeType: meta.data.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                                    ? 'application/vnd.google-apps.document'
                                    : meta.data.mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                                        ? 'application/vnd.google-apps.spreadsheet'
                                        : 'application/vnd.google-apps.presentation'
                            }
                        });
                        if (tempCopy.data.id) {
                            const exportRes = await googleDrive_1.default.files.export({ fileId: tempCopy.data.id, mimeType: 'application/pdf' }, { responseType: 'stream' });
                            let fileName = meta.data.name || 'file';
                            if (fileName.toLowerCase().endsWith('.docx') || fileName.toLowerCase().endsWith('.xlsx') || fileName.toLowerCase().endsWith('.pptx')) {
                                fileName = fileName.substring(0, fileName.lastIndexOf('.'));
                            }
                            const safeName = encodeURIComponent(fileName);
                            res.setHeader('Content-Disposition', `attachment; filename="${safeName}.pdf"; filename*=UTF-8''${safeName}.pdf`);
                            res.setHeader('Content-Type', 'application/pdf');
                            exportRes.data.on('end', async () => {
                                try {
                                    await googleDrive_1.default.files.delete({ fileId: tempCopy.data.id });
                                }
                                catch (e) {
                                    console.error('Cleanup error:', e);
                                }
                            });
                            exportRes.data.pipe(res);
                            return;
                        }
                    }
                    catch (e) {
                        console.error('PDF Conversion error:', e);
                    }
                }
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
                // Use URI encoding for filename to support spaces and special chars
                const safeName = encodeURIComponent(fileName);
                res.setHeader('Content-Disposition', `attachment; filename="${safeName}"; filename*=UTF-8''${safeName}`);
                res.setHeader('Content-Type', mimeType);
                response.data.on('error', (err) => {
                    console.error('Download stream error:', err);
                    if (!res.headersSent)
                        res.status(500).send('Download failed');
                }).pipe(res);
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
        // Helper to sync Drive files to DB recursively
        const syncDriveData = async (parentId, userId, rootId) => {
            try {
                const res = await googleDrive_1.default.files.list({
                    q: `'${parentId}' in parents and trashed = false`,
                    fields: 'files(id, name, mimeType, size)',
                });
                const files = res.data.files || [];
                for (const file of files) {
                    await FileMetadata_1.FileMetadata.findOneAndUpdate({ fileId: file.id }, {
                        fileId: file.id,
                        name: file.name,
                        type: file.mimeType,
                        size: file.size ? parseInt(file.size) : 0,
                        parentId: parentId,
                        rootId: rootId,
                        ownerUserId: new mongoose_1.default.Types.ObjectId(userId),
                        status: 'active'
                    }, { upsert: true, new: true });
                    if (file.mimeType === 'application/vnd.google-apps.folder') {
                        await syncDriveData(file.id, userId, rootId);
                    }
                }
            }
            catch (error) {
                console.error('Sync error:', error);
            }
        };
        const userId = req.user?._id;
        // Trigger a sync of the root folder in the background so it doesn't block the dashboard load
        // This allows the dashboard to render instantly using the MongoDB cache
        syncDriveData(DRIVE_FOLDER_ID, userId, DRIVE_FOLDER_ID).catch(err => console.error("Background sync failed", err));
        // Total Files: Recursive count (all files anywhere in the storage)
        const totalFiles = await FileMetadata_1.FileMetadata.countDocuments({ rootId: DRIVE_FOLDER_ID, status: 'active', type: { $nin: ['application/vnd.google-apps.folder', 'folder'] } });
        // Total Folders: ONLY count folders that are directly in the main storage folder (root)
        const totalFolders = await FileMetadata_1.FileMetadata.countDocuments({
            rootId: DRIVE_FOLDER_ID,
            status: 'active',
            type: 'application/vnd.google-apps.folder',
            parentId: DRIVE_FOLDER_ID
        });
        // Global storage usage
        const totalSizeRes = await FileMetadata_1.FileMetadata.aggregate([
            { $match: { rootId: DRIVE_FOLDER_ID, status: 'active', type: { $nin: ['application/vnd.google-apps.folder', 'folder'] } } },
            { $group: { _id: null, total: { $sum: '$size' } } }
        ]);
        const usedBytes = totalSizeRes[0]?.total || 0;
        const APP_LIMIT_BYTES = 10 * 1024 * 1024 * 1024; // 10GB
        // File type breakdown for chart
        const typesRes = await FileMetadata_1.FileMetadata.aggregate([
            { $match: { rootId: DRIVE_FOLDER_ID, status: 'active', type: { $nin: ['application/vnd.google-apps.folder', 'folder'] } } },
            { $group: { _id: '$type', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);
        res.json({
            used: usedBytes.toString(),
            limit: APP_LIMIT_BYTES.toString(),
            totalFiles,
            totalFolders,
            types: typesRes,
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
        // Helper to get all files in a folder recursively
        const getAllFilesInFolder = async (folderId, pathPrefix = '') => {
            let results = [];
            const children = await FileMetadata_1.FileMetadata.find({ parentId: folderId, status: 'active' });
            for (const child of children) {
                if (child.type === 'application/vnd.google-apps.folder' || child.type === 'folder') {
                    const sub = await getAllFilesInFolder(child.fileId, `${pathPrefix}${child.name}/`);
                    results = results.concat(sub);
                }
                else {
                    results.push({ id: child.fileId, path: pathPrefix, name: child.name, mimeType: child.type });
                }
            }
            return results;
        };
        let filesToZip = [];
        for (const fileId of fileIds) {
            try {
                const meta = await googleDrive_1.default.files.get({ fileId, fields: 'id, name, mimeType' });
                const fileName = meta.data.name || 'file';
                if (meta.data.mimeType === 'application/vnd.google-apps.folder') {
                    const children = await getAllFilesInFolder(fileId, `${fileName}/`);
                    filesToZip = filesToZip.concat(children);
                }
                else {
                    filesToZip.push({ id: fileId, path: '', name: fileName, mimeType: meta.data.mimeType });
                }
            }
            catch (err) {
                console.error(`Error resolving file/folder ${fileId}:`, err);
            }
        }
        for (const file of filesToZip) {
            try {
                const fullPathName = file.path + file.name;
                const isGoogleDoc = file.mimeType?.startsWith('application/vnd.google-apps.');
                if (isGoogleDoc) {
                    const exportRes = await googleDrive_1.default.files.export({ fileId: file.id, mimeType: 'application/pdf' }, { responseType: 'stream' });
                    archive.append(exportRes.data, { name: fullPathName + '.pdf' });
                }
                else {
                    const downRes = await googleDrive_1.default.files.get({ fileId: file.id, alt: 'media' }, { responseType: 'stream' });
                    archive.append(downRes.data, { name: fullPathName });
                }
            }
            catch (err) {
                console.error(`Error adding file ${file.id} to bulk ZIP:`, err);
            }
        }
        await archive.finalize();
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.bulkDownload = bulkDownload;
// @desc  Global deep search in MongoDB
// @route GET /api/files/search?q=xyz
const searchFiles = async (req, res) => {
    try {
        const q = req.query.q;
        if (!q) {
            res.json([]);
            return;
        }
        // Case-insensitive substring match is usually better for files
        const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escaped, 'i');
        const files = await FileMetadata_1.FileMetadata.find({
            rootId: DRIVE_FOLDER_ID,
            status: 'active',
            name: { $regex: regex }
        }).limit(100);
        const getFolderSize = await createFolderSizeCalculator();
        const mapped = files.map((f) => {
            let size = f.size?.toString() || '0';
            if (f.type === 'application/vnd.google-apps.folder' || f.type === 'folder') {
                size = getFolderSize(f.fileId).toString();
            }
            return {
                id: f.fileId,
                name: f.name,
                mimeType: f.type,
                size,
                modifiedTime: f.updatedAt || new Date().toISOString()
            };
        });
        res.json(mapped);
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.searchFiles = searchFiles;
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
// @desc  Get user activity logs
const getUserActivityLogs = async (req, res) => {
    try {
        const logs = await ActivityLog_1.ActivityLog.find({ user: req.user?._id })
            .sort({ timestamp: -1 })
            .limit(50);
        res.json(logs);
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.getUserActivityLogs = getUserActivityLogs;
// @desc  Get all trashed files
const getTrashedFiles = async (req, res) => {
    try {
        // In Google Drive, when you trash a folder, its children also have trashed=true.
        // To show only "top-level" trashed items, we can't easily do it with just 'q'.
        // However, usually we only want to show items that the user explicitly deleted.
        const files = await googleDrive_1.default.files.list({
            q: "trashed = true",
            fields: 'files(id, name, mimeType, size, modifiedTime, parents)',
            pageSize: 100,
        });
        const allFiles = files.data.files || [];
        const trashedIds = new Set(allFiles.map(f => f.id));
        // Filter by files that belong to the current rootId in our DB
        const rootTrashedMetas = await FileMetadata_1.FileMetadata.find({ rootId: DRIVE_FOLDER_ID, status: 'trashed' });
        const rootTrashedIds = new Set(rootTrashedMetas.map(m => m.fileId));
        const topLevelTrash = allFiles.filter(f => {
            // Must belong to this root
            if (!f.id || !rootTrashedIds.has(f.id))
                return false;
            if (!f.parents || f.parents.length === 0)
                return true;
            // If any parent is also in the trash list, this is a nested item
            return !f.parents.some(parentId => trashedIds.has(parentId));
        });
        res.json(topLevelTrash);
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.getTrashedFiles = getTrashedFiles;
// @desc  Restore file from trash
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
// @desc  Bulk restore files
const restoreBulk = async (req, res) => {
    try {
        const { fileIds } = req.body;
        if (!fileIds || !Array.isArray(fileIds)) {
            res.status(400).json({ message: 'Invalid request' });
            return;
        }
        for (const id of fileIds) {
            await googleDrive_1.default.files.update({ fileId: id, requestBody: { trashed: false } });
            await FileMetadata_1.FileMetadata.findOneAndUpdate({ fileId: id }, { status: 'active' });
        }
        await (0, logger_1.logActivity)(req.user?._id, 'bulk_restore', `Restored ${fileIds.length} items`);
        res.json({ message: 'Items restored' });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.restoreBulk = restoreBulk;
// @desc  Restore all items from trash
const restoreAll = async (req, res) => {
    try {
        // We need to find all trashed items first to update them in Drive one by one
        // (Drive API doesn't have a bulk restore for specific items easily without knowing IDs)
        const trashed = await FileMetadata_1.FileMetadata.find({ status: 'trashed' });
        for (const item of trashed) {
            await googleDrive_1.default.files.update({ fileId: item.fileId, requestBody: { trashed: false } });
            item.status = 'active';
            await item.save();
        }
        await (0, logger_1.logActivity)(req.user?._id, 'restore_all', 'Restored all items from trash');
        res.json({ message: 'All items restored' });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.restoreAll = restoreAll;
// @desc  Permanently delete files
const deletePermanently = async (req, res) => {
    try {
        const { fileIds } = req.body;
        if (!fileIds || !Array.isArray(fileIds)) {
            res.status(400).json({ message: 'Invalid request' });
            return;
        }
        const allNestedIds = await getAllChildIds(fileIds);
        const idsToDelete = [...fileIds, ...allNestedIds];
        for (const id of fileIds) {
            try {
                await googleDrive_1.default.files.delete({ fileId: id });
            }
            catch (e) {
                // If file already deleted in Drive, just continue
                console.warn(`Drive delete failed for ${id}:`, e.message);
            }
        }
        await FileMetadata_1.FileMetadata.deleteMany({ fileId: { $in: idsToDelete } });
        await (0, logger_1.logActivity)(req.user?._id, 'delete_permanent', `Permanently deleted ${fileIds.length} items`);
        res.json({ message: 'Items deleted permanently' });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.deletePermanently = deletePermanently;
// @desc  Empty trash bin
const emptyTrash = async (req, res) => {
    try {
        try {
            await googleDrive_1.default.files.emptyTrash();
        }
        catch (e) {
            console.warn('Drive emptyTrash failed (likely scope issue):', e.message);
            // We continue and delete from MongoDB anyway to act as a soft delete
        }
        await FileMetadata_1.FileMetadata.deleteMany({ rootId: DRIVE_FOLDER_ID, status: 'trashed' });
        await (0, logger_1.logActivity)(req.user?._id, 'empty_trash', 'Emptied trash bin');
        res.json({ message: 'Trash emptied' });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.emptyTrash = emptyTrash;
// @desc  Get all users (Admin only)
const getAllUsers = async (req, res) => {
    try {
        const users = await User_1.User.find({ role: 'user' }).select('-passwordHash').sort({ createdAt: -1 });
        res.json(users);
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.getAllUsers = getAllUsers;
// @desc  Update user status (Admin only)
const updateUserStatus = async (req, res) => {
    try {
        const { userId, status } = req.body;
        if (!['approved', 'rejected', 'pending'].includes(status)) {
            res.status(400).json({ message: 'Invalid status' });
            return;
        }
        const user = await User_1.User.findByIdAndUpdate(userId, { status }, { new: true });
        if (!user) {
            res.status(404).json({ message: 'User not found' });
            return;
        }
        await (0, logger_1.logActivity)(req.user?._id, 'update_user_status', `Updated user ${user.email} status to ${status}`);
        res.json(user);
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.updateUserStatus = updateUserStatus;
// @desc  Delete user (Admin only)
const deleteUser = async (req, res) => {
    try {
        const { userId } = req.params;
        const user = await User_1.User.findByIdAndDelete(userId);
        if (!user) {
            res.status(404).json({ message: 'User not found' });
            return;
        }
        // Optional: Delete user's files? User might want to keep them or delete them.
        // For now, just delete the user.
        await (0, logger_1.logActivity)(req.user?._id, 'delete_user', `Deleted user ${user.email}`);
        res.json({ message: 'User deleted successfully' });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.deleteUser = deleteUser;
// @desc  Get a resumable upload session URL from Google Drive
// @route POST /api/files/upload-session
const getUploadSession = async (req, res) => {
    try {
        const { name, mimeType, parentId, size } = req.body;
        if (!name || !mimeType) {
            res.status(400).json({ message: 'Name and mimeType are required' });
            return;
        }
        let targetParentId = parentId || DRIVE_FOLDER_ID;
        if (targetParentId === 'ROOT')
            targetParentId = DRIVE_FOLDER_ID;
        const oauth2Client = googleDrive_1.default.context._options.auth;
        const { token } = await oauth2Client.getAccessToken();
        // Make a POST request to Google Drive to start a resumable session
        const response = await axios_1.default.post('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable', {
            name,
            mimeType,
            parents: [targetParentId]
        }, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'X-Upload-Content-Type': mimeType,
                'Origin': req.headers.origin || 'http://localhost:3000',
                ...(size ? { 'X-Upload-Content-Length': size.toString() } : {})
            }
        });
        const uploadUrl = response.headers.location;
        if (!uploadUrl) {
            throw new Error('Google Drive did not return an upload URL');
        }
        res.json({ uploadUrl });
    }
    catch (error) {
        console.error('Upload session error:', error);
        res.status(500).json({ message: error.message });
    }
};
exports.getUploadSession = getUploadSession;
// @desc  Finalize direct client upload and save metadata
// @route POST /api/files/upload-complete
const finalizeUpload = async (req, res) => {
    try {
        const { fileId, name, mimeType, size, parentId } = req.body;
        let targetParentId = parentId || DRIVE_FOLDER_ID;
        if (targetParentId === 'ROOT')
            targetParentId = DRIVE_FOLDER_ID;
        await FileMetadata_1.FileMetadata.create({
            fileId,
            name,
            type: mimeType || 'application/octet-stream',
            size: Number(size || 0),
            ownerUserId: req.user?._id,
            parentId: targetParentId,
            rootId: DRIVE_FOLDER_ID,
            status: 'active',
        });
        await (0, logger_1.logActivity)(req.user?._id, 'upload', `Uploaded file (Direct): ${name}`);
        res.status(201).json({ message: 'Metadata saved successfully' });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.finalizeUpload = finalizeUpload;
// @desc  Get direct download link
// @route GET /api/files/:id/direct-download
const getDownloadLink = async (req, res) => {
    try {
        const fileId = req.params['id'];
        // Set permission to anyone with link can view (needed for direct download)
        try {
            await googleDrive_1.default.permissions.create({
                fileId,
                requestBody: { role: 'reader', type: 'anyone' }
            });
        }
        catch (e) {
            console.warn('Could not set permissions (might already be set):', e.message);
        }
        const meta = await googleDrive_1.default.files.get({ fileId, fields: 'id, name, webContentLink, webViewLink, mimeType' });
        await (0, logger_1.logActivity)(req.user?._id, 'download', `Generated direct download link for: ${meta.data.name}`);
        res.json({
            webContentLink: meta.data.webContentLink,
            webViewLink: meta.data.webViewLink,
            mimeType: meta.data.mimeType
        });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.getDownloadLink = getDownloadLink;
// @desc  Clear all activity logs (Admin only)
const clearActivityLogs = async (req, res) => {
    try {
        await ActivityLog_1.ActivityLog.deleteMany({});
        await (0, logger_1.logActivity)(req.user?._id, 'clear_logs', 'Cleared all system activity logs');
        res.json({ message: 'All activity logs cleared successfully' });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.clearActivityLogs = clearActivityLogs;
// @desc  Get single file metadata
// @route GET /api/files/:id/metadata
const getFileMetadata = async (req, res) => {
    try {
        const { id } = req.params;
        let fileId = id;
        if (fileId === 'ROOT')
            fileId = DRIVE_FOLDER_ID;
        // Try DB first
        let meta = await FileMetadata_1.FileMetadata.findOne({ fileId });
        if (!meta) {
            // Fallback to Drive if not in DB
            const driveMeta = await googleDrive_1.default.files.get({ fileId, fields: 'id, name, mimeType' });
            meta = {
                fileId: driveMeta.data.id,
                name: driveMeta.data.name,
                mimeType: driveMeta.data.mimeType
            };
        }
        res.json(meta);
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.getFileMetadata = getFileMetadata;
//# sourceMappingURL=fileController.js.map