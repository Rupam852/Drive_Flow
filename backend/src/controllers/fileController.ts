import { Request, Response } from 'express';
import { Readable } from 'stream';
import multer from 'multer';
const zipLib = require('archiver') as any;
import drive from '../config/googleDrive';
import { FileMetadata } from '../models/FileMetadata';
import { ActivityLog } from '../models/ActivityLog';
import { User } from '../models/User';
import { logActivity } from '../utils/logger';
import { AuthRequest } from '../middleware/authMiddleware';
import mongoose from 'mongoose';

const DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID as string;

// Use memory storage so we can stream to Drive
export const upload = multer({ storage: multer.memoryStorage() });

// Helper to buffer → Readable stream
const bufferToStream = (buffer: Buffer) => {
  const readable = new Readable();
  readable.push(buffer);
  readable.push(null);
  return readable;
};

// Helper to calculate folder size recursively from DB
const getFolderSize = async (folderId: string): Promise<number> => {
  try {
    const children = await FileMetadata.find({ parentId: folderId, status: 'active' });
    let total = 0;
    for (const child of children) {
      if (child.type === 'application/vnd.google-apps.folder' || child.type === 'folder') {
        total += await getFolderSize(child.fileId);
      } else {
        total += (child.size || 0);
      }
    }
    return total;
  } catch (err) {
    console.error(`Error calculating size for folder ${folderId}:`, err);
    return 0;
  }
};

// @desc  List all files/folders
// @route GET /api/files?parentId=xxx
export const listFiles = async (req: Request, res: Response) => {
  try {
    const parentId = (req.query.parentId as string) || DRIVE_FOLDER_ID;
    console.log(`[listFiles] Requesting files for parentId: ${parentId}`);
    const driveRes = await drive.files.list({
      q: `'${parentId}' in parents and trashed = false`,
      fields: 'files(id, name, mimeType, size, createdTime, modifiedTime)',
      orderBy: 'folder,name',
    });

    const files = driveRes.data.files || [];

    // Sort: Folders first, then Natural Sort by name
    files.sort((a, b) => {
      const aIsFolder = a.mimeType === 'application/vnd.google-apps.folder';
      const bIsFolder = b.mimeType === 'application/vnd.google-apps.folder';
      if (aIsFolder && !bIsFolder) return -1;
      if (!aIsFolder && bIsFolder) return 1;
      return (a.name || '').localeCompare(b.name || '', undefined, { numeric: true, sensitivity: 'base' });
    });

    // Calculate sizes for folders
    const filesWithFolderSizes = await Promise.all(
      files.map(async (file) => {
        if (file.mimeType === 'application/vnd.google-apps.folder') {
          const folderSize = await getFolderSize(file.id!);
          return { ...file, size: folderSize.toString() };
        }
        return file;
      })
    );

    res.json(filesWithFolderSizes);
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

// @desc  Upload a file
// @route POST /api/files/upload
export const uploadFile = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ message: 'No file uploaded' });
      return;
    }
    const parentId = (req.body.parentId as string) || DRIVE_FOLDER_ID;

    const response = await drive.files.create({
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

    await FileMetadata.create({
      fileId: response.data.id ?? '',
      name: response.data.name ?? 'Untitled',
      type: response.data.mimeType ?? 'application/octet-stream',
      size: Number(response.data.size ?? 0),
      ownerUserId: req.user?._id,
      parentId,
      rootId: DRIVE_FOLDER_ID,
      status: 'active',
    });

    await logActivity((req as any).user?._id, 'upload', `Uploaded file: ${req.file?.originalname}`);

    res.status(201).json(response.data);
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

// @desc  Create a folder
// @route POST /api/files/folder
export const createFolder = async (req: AuthRequest, res: Response) => {
  try {
    const { name, parentId } = req.body;
    const parent = parentId || DRIVE_FOLDER_ID;

    const response = await drive.files.create({
      requestBody: {
        name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parent],
      },
      fields: 'id, name, mimeType',
    });

    await FileMetadata.create({
      fileId: response.data.id ?? '',
      name: response.data.name ?? 'Untitled Folder',
      type: 'application/vnd.google-apps.folder',
      ownerUserId: req.user?._id,
      parentId: parent,
      rootId: DRIVE_FOLDER_ID,
      status: 'active',
    });

    await logActivity((req as any).user?._id, 'create_folder', `Created folder: ${name}`);

    res.status(201).json(response.data);
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

// @desc  Create a Google Doc
// @route POST /api/files/doc
export const createDoc = async (req: AuthRequest, res: Response) => {
  try {
    const { name, parentId } = req.body;
    const parent = parentId || DRIVE_FOLDER_ID;

    const response = await drive.files.create({
      requestBody: {
        name,
        mimeType: 'application/vnd.google-apps.document',
        parents: [parent],
      },
      fields: 'id, name, mimeType, webViewLink',
    });

    await FileMetadata.create({
      fileId: response.data.id ?? '',
      name: response.data.name ?? 'Untitled Document',
      type: 'application/vnd.google-apps.document',
      ownerUserId: req.user?._id,
      parentId: parent,
      rootId: DRIVE_FOLDER_ID,
      status: 'active',
    });

    res.status(201).json(response.data);
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

// @desc  Rename a file/folder
// @route PUT /api/files/:id/rename
export const renameFile = async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    const fileId = req.params['id'] as string;
    const response = await (drive.files.update as any)({
      fileId,
      requestBody: { name },
      fields: 'id, name',
    });
    await FileMetadata.findOneAndUpdate({ fileId }, { name });
    await logActivity((req as any).user?._id, 'rename', `Renamed file ID ${fileId} to ${name}`);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

// @desc  Move file(s) to another folder
// @route PUT /api/files/move
export const moveFiles = async (req: Request, res: Response) => {
  try {
    const { fileIds, targetParentId, newParentId } = req.body;
    const targetId = targetParentId || newParentId;
    const results = [];

    for (const fileId of fileIds as string[]) {
      const fileData = await (drive.files.get as any)({ fileId, fields: 'parents' });
      const previousParents = ((fileData.data.parents as string[]) || []).join(',');

      const response = await (drive.files.update as any)({
        fileId,
        addParents: targetId,
        removeParents: previousParents,
        fields: 'id, parents',
      });
      await FileMetadata.findOneAndUpdate({ fileId }, { parentId: targetId });
      results.push(response.data);
    }

    await logActivity((req as any).user?._id, 'move', `Moved ${fileIds.length} files to folder ID ${targetId}`);
    res.json(results);
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

// Helper to recursively get all child file IDs
const getAllChildIds = async (folderIds: string[]): Promise<string[]> => {
  let allIds: string[] = [];
  let currentFolders = folderIds;

  while (currentFolders.length > 0) {
    const children = await FileMetadata.find({ parentId: { $in: currentFolders } });
    if (children.length === 0) break;
    
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
export const trashFiles = async (req: Request, res: Response) => {
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
      await drive.files.update({ fileId: id, requestBody: { trashed: true } });
    }
    
    // Update metadata for everything
    await FileMetadata.updateMany(
      { fileId: { $in: idsToUpdate } },
      { status: 'trashed' }
    );

    await logActivity((req as any).user?._id, 'trash', `Moved ${fileIds.length} items to trash (including nested contents)`);
    res.json({ message: 'Items moved to trash' });
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

// @desc  Download a file or folder (ZIP)
// @route GET /api/files/:id/download
export const downloadFile = async (req: Request, res: Response) => {
  try {
    const fileId = req.params['id'] as string;
    const meta = await drive.files.get({ fileId, fields: 'id, name, mimeType' });

    await logActivity((req as any).user?._id, 'download', `Downloaded ${meta.data.mimeType === 'application/vnd.google-apps.folder' ? 'Folder ZIP' : 'File'}: ${meta.data.name}`);

    if (meta.data.mimeType === 'application/vnd.google-apps.folder') {
      // Handle Folder ZIP
      const archive = zipLib('zip', { zlib: { level: 9 } });
      res.setHeader('Content-Disposition', `attachment; filename="${meta.data.name}.zip"`);
      res.setHeader('Content-Type', 'application/zip');
      
      archive.pipe(res);

      const addFolderToZip = async (fId: string, zip: any, folderPath: string) => {
        const listRes = await drive.files.list({
          q: `'${fId}' in parents and trashed = false`,
          fields: 'files(id, name, mimeType)',
        });
        const items = listRes.data.files || [];
        for (const item of items) {
          const itemPath = folderPath + item.name;
          if (item.mimeType === 'application/vnd.google-apps.folder') {
            await addFolderToZip(item.id!, zip, itemPath + '/');
          } else if (item.mimeType?.startsWith('application/vnd.google-apps.')) {
            // Google Docs to PDF in ZIP
            const exportRes: any = await drive.files.export(
              { fileId: item.id!, mimeType: 'application/pdf' },
              { responseType: 'stream' } as any
            );
            zip.append(exportRes.data, { name: itemPath + '.pdf' });
          } else {
            const downRes: any = await drive.files.get(
              { fileId: item.id!, alt: 'media' },
              { responseType: 'stream' } as any
            );
            zip.append(downRes.data, { name: itemPath });
          }
        }
      };

      await addFolderToZip(fileId, archive, '');
      await archive.finalize();

    } else {
      // Handle single file
      const isGoogleDoc = meta.data.mimeType?.startsWith('application/vnd.google-apps.');
      if (isGoogleDoc) {
        const format = req.query.format as string || 'pdf';
        let exportMime = 'application/pdf';
        let ext = '.pdf';

        if (meta.data.mimeType === 'application/vnd.google-apps.document') {
          if (format === 'docx') {
            exportMime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
            ext = '.docx';
          }
        } else if (meta.data.mimeType === 'application/vnd.google-apps.spreadsheet') {
          if (format !== 'pdf') {
            exportMime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
            ext = '.xlsx';
          }
        } else if (meta.data.mimeType === 'application/vnd.google-apps.presentation') {
          if (format !== 'pdf') {
            exportMime = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
            ext = '.pptx';
          }
        }

        const response: any = await drive.files.export(
          { fileId, mimeType: exportMime },
          { responseType: 'stream' } as any
        );
        
        let safeName = encodeURIComponent(meta.data.name || 'file');
        // Remove existing extension if we are adding a new one
        if (safeName.toLowerCase().endsWith('.docx') || safeName.toLowerCase().endsWith('.xlsx') || safeName.toLowerCase().endsWith('.pptx') || safeName.toLowerCase().endsWith('.pdf')) {
          safeName = safeName.substring(0, safeName.lastIndexOf('.'));
        }

        res.setHeader('Content-Disposition', `attachment; filename="${safeName}${ext}"; filename*=UTF-8''${safeName}${ext}`);
        res.setHeader('Content-Type', exportMime);
        
        response.data.on('error', (err: any) => {
          console.error('Export stream error:', err);
          if (!res.headersSent) res.status(500).send('Download failed');
        }).pipe(res);
      } else {
        const format = req.query.format as string;
        const isConvertible = 
          meta.data.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
          meta.data.mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
          meta.data.mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

        if (format === 'pdf' && isConvertible) {
          try {
            const tempCopy = await drive.files.copy({
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
              const exportRes: any = await drive.files.export(
                { fileId: tempCopy.data.id, mimeType: 'application/pdf' },
                { responseType: 'stream' } as any
              );

              let fileName = meta.data.name || 'file';
              if (fileName.toLowerCase().endsWith('.docx') || fileName.toLowerCase().endsWith('.xlsx') || fileName.toLowerCase().endsWith('.pptx')) {
                fileName = fileName.substring(0, fileName.lastIndexOf('.'));
              }
              const safeName = encodeURIComponent(fileName);
              res.setHeader('Content-Disposition', `attachment; filename="${safeName}.pdf"; filename*=UTF-8''${safeName}.pdf`);
              res.setHeader('Content-Type', 'application/pdf');

              exportRes.data.on('end', async () => {
                try { await drive.files.delete({ fileId: tempCopy.data.id! }); } catch (e) { console.error('Cleanup error:', e); }
              });

              exportRes.data.pipe(res);
              return;
            }
          } catch (e) {
            console.error('PDF Conversion error:', e);
          }
        }

        const response: any = await drive.files.get(
          { fileId, alt: 'media' },
          { responseType: 'stream' } as any
        );
        
        let fileName = meta.data.name || 'file';
        const mimeType = meta.data.mimeType || 'application/octet-stream';

        // Add extension if missing
        const extMap: any = {
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
        
        response.data.on('error', (err: any) => {
          console.error('Download stream error:', err);
          if (!res.headersSent) res.status(500).send('Download failed');
        }).pipe(res);
      }
    }
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

// @desc  Get drive storage stats
// @route GET /api/files/stats
export const getDriveStats = async (req: Request, res: Response) => {
  try {
    // Helper to sync Drive files to DB recursively
    const syncDriveData = async (parentId: string, userId: string, rootId: string) => {
      try {
        const res = await drive.files.list({
          q: `'${parentId}' in parents and trashed = false`,
          fields: 'files(id, name, mimeType, size)',
        });

        const files = res.data.files || [];
        for (const file of files) {
          await FileMetadata.findOneAndUpdate(
            { fileId: file.id },
            {
              fileId: file.id,
              name: file.name,
              type: file.mimeType,
              size: file.size ? parseInt(file.size) : 0,
              parentId: parentId,
              rootId: rootId,
              ownerUserId: new mongoose.Types.ObjectId(userId),
              status: 'active'
            },
            { upsert: true, new: true }
          );

          if (file.mimeType === 'application/vnd.google-apps.folder') {
            await syncDriveData(file.id!, userId, rootId);
          }
        }
      } catch (error) {
        console.error('Sync error:', error);
      }
    };

    const userId = (req as any).user?._id;
    
    // Trigger a sync of the root folder in the background so it doesn't block the dashboard load
    // This allows the dashboard to render instantly using the MongoDB cache
    syncDriveData(DRIVE_FOLDER_ID, userId, DRIVE_FOLDER_ID).catch(err => console.error("Background sync failed", err));
    // Total Files: Recursive count (all files anywhere in the storage)
    const totalFiles = await FileMetadata.countDocuments({ rootId: DRIVE_FOLDER_ID, status: 'active', type: { $nin: ['application/vnd.google-apps.folder', 'folder'] } });
    
    // Total Folders: ONLY count folders that are directly in the main storage folder (root)
    const totalFolders = await FileMetadata.countDocuments({ 
      rootId: DRIVE_FOLDER_ID,
      status: 'active', 
      type: 'application/vnd.google-apps.folder', 
      parentId: DRIVE_FOLDER_ID 
    });

    // Global storage usage
    const totalSizeRes = await FileMetadata.aggregate([
      { $match: { rootId: DRIVE_FOLDER_ID, status: 'active', type: { $nin: ['application/vnd.google-apps.folder', 'folder'] } } },
      { $group: { _id: null, total: { $sum: '$size' } } }
    ]);
    const usedBytes = totalSizeRes[0]?.total || 0;

    const APP_LIMIT_BYTES = 10 * 1024 * 1024 * 1024; // 10GB

    // File type breakdown for chart
    const typesRes = await FileMetadata.aggregate([
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
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

// @desc  Bulk download multiple files as ZIP
// @route POST /api/files/bulk-download
export const bulkDownload = async (req: Request, res: Response) => {
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
        const meta = await drive.files.get({ fileId, fields: 'id, name, mimeType' });
        const fileName = meta.data.name || 'file';

        if (meta.data.mimeType === 'application/vnd.google-apps.folder') {
          continue; // Folders skipped for now in bulk file ZIP
        }

        const isGoogleDoc = meta.data.mimeType?.startsWith('application/vnd.google-apps.');
        if (isGoogleDoc) {
          const exportRes: any = await drive.files.export(
            { fileId, mimeType: 'application/pdf' },
            { responseType: 'stream' } as any
          );
          archive.append(exportRes.data, { name: fileName + '.pdf' });
        } else {
          const downRes: any = await drive.files.get(
            { fileId, alt: 'media' },
            { responseType: 'stream' } as any
          );
          archive.append(downRes.data, { name: fileName });
        }
      } catch (err) {
        console.error(`Error adding file ${fileId} to bulk ZIP:`, err);
      }
    }

    await archive.finalize();
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

// @desc  Get all activity logs (Admin only)
// @route GET /api/files/logs
export const getActivityLogs = async (req: Request, res: Response) => {
  try {
    const logs = await ActivityLog.find()
      .populate('user', 'name email')
      .sort({ timestamp: -1 })
      .limit(100);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

// @desc  Get user activity logs
export const getUserActivityLogs = async (req: AuthRequest, res: Response) => {
  try {
    const logs = await ActivityLog.find({ user: req.user?._id })
      .sort({ timestamp: -1 })
      .limit(50);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

// @desc  Get all trashed files
export const getTrashedFiles = async (req: Request, res: Response) => {
  try {
    // In Google Drive, when you trash a folder, its children also have trashed=true.
    // To show only "top-level" trashed items, we can't easily do it with just 'q'.
    // However, usually we only want to show items that the user explicitly deleted.
    const files = await drive.files.list({
      q: "trashed = true",
      fields: 'files(id, name, mimeType, size, modifiedTime, parents)',
      pageSize: 100,
    });

    const allFiles = files.data.files || [];
    const trashedIds = new Set(allFiles.map(f => f.id));

    // Filter by files that belong to the current rootId in our DB
    const rootTrashedMetas = await FileMetadata.find({ rootId: DRIVE_FOLDER_ID, status: 'trashed' });
    const rootTrashedIds = new Set(rootTrashedMetas.map(m => m.fileId));

    const topLevelTrash = allFiles.filter(f => {
      // Must belong to this root
      if (!f.id || !rootTrashedIds.has(f.id)) return false;

      if (!f.parents || f.parents.length === 0) return true;
      // If any parent is also in the trash list, this is a nested item
      return !f.parents.some(parentId => trashedIds.has(parentId));
    });

    res.json(topLevelTrash);
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

// @desc  Restore file from trash
export const restoreFile = async (req: Request, res: Response) => {
  try {
    const fileId = req.params['id'] as string;
    await drive.files.update({ fileId, requestBody: { trashed: false } });
    await FileMetadata.findOneAndUpdate({ fileId }, { status: 'active' });
    await logActivity((req as any).user?._id, 'restore', `Restored file ID ${fileId}`);
    res.json({ message: 'File restored successfully' });
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

// @desc  Bulk restore files
export const restoreBulk = async (req: Request, res: Response) => {
  try {
    const { fileIds } = req.body;
    if (!fileIds || !Array.isArray(fileIds)) {
      res.status(400).json({ message: 'Invalid request' });
      return;
    }
    for (const id of fileIds) {
      await drive.files.update({ fileId: id, requestBody: { trashed: false } });
      await FileMetadata.findOneAndUpdate({ fileId: id }, { status: 'active' });
    }
    await logActivity((req as any).user?._id, 'bulk_restore', `Restored ${fileIds.length} items`);
    res.json({ message: 'Items restored' });
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

// @desc  Restore all items from trash
export const restoreAll = async (req: Request, res: Response) => {
  try {
    // We need to find all trashed items first to update them in Drive one by one
    // (Drive API doesn't have a bulk restore for specific items easily without knowing IDs)
    const trashed = await FileMetadata.find({ status: 'trashed' });
    for (const item of trashed) {
      await drive.files.update({ fileId: item.fileId, requestBody: { trashed: false } });
      item.status = 'active';
      await item.save();
    }
    await logActivity((req as any).user?._id, 'restore_all', 'Restored all items from trash');
    res.json({ message: 'All items restored' });
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

// @desc  Permanently delete files
export const deletePermanently = async (req: Request, res: Response) => {
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
        await drive.files.delete({ fileId: id });
      } catch (e) {
        // If file already deleted in Drive, just continue
        console.warn(`Drive delete failed for ${id}:`, (e as Error).message);
      }
    }

    await FileMetadata.deleteMany({ fileId: { $in: idsToDelete } });
    
    await logActivity((req as any).user?._id, 'delete_permanent', `Permanently deleted ${fileIds.length} items`);
    res.json({ message: 'Items deleted permanently' });
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

// @desc  Empty trash bin
export const emptyTrash = async (req: Request, res: Response) => {
  try {
    try {
      await drive.files.emptyTrash();
    } catch (e) {
      console.warn('Drive emptyTrash failed (likely scope issue):', (e as Error).message);
      // We continue and delete from MongoDB anyway to act as a soft delete
    }
    
    await FileMetadata.deleteMany({ rootId: DRIVE_FOLDER_ID, status: 'trashed' });
    await logActivity((req as any).user?._id, 'empty_trash', 'Emptied trash bin');
    res.json({ message: 'Trash emptied' });
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

// @desc  Get all users (Admin only)
export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const users = await User.find({ role: 'user' }).select('-passwordHash').sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

// @desc  Update user status (Admin only)
export const updateUserStatus = async (req: Request, res: Response) => {
  try {
    const { userId, status } = req.body;
    if (!['approved', 'rejected', 'pending'].includes(status)) {
      res.status(400).json({ message: 'Invalid status' });
      return;
    }
    const user = await User.findByIdAndUpdate(userId, { status }, { new: true });
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    await logActivity((req as any).user?._id, 'update_user_status', `Updated user ${user.email} status to ${status}`);
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

// @desc  Delete user (Admin only)
export const deleteUser = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const user = await User.findByIdAndDelete(userId);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    // Optional: Delete user's files? User might want to keep them or delete them.
    // For now, just delete the user.
    await logActivity((req as any).user?._id, 'delete_user', `Deleted user ${user.email}`);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

// @desc  Get a resumable upload session URL from Google Drive
// @route POST /api/files/upload-session
export const getUploadSession = async (req: AuthRequest, res: Response) => {
  try {
    const { name, mimeType, parentId, size } = req.body;
    if (!name || !mimeType) {
      res.status(400).json({ message: 'Name and mimeType are required' });
      return;
    }
    const targetParentId = parentId || DRIVE_FOLDER_ID;

    const oauth2Client = (drive as any).context._options.auth;
    const { token } = await oauth2Client.getAccessToken();

    // Make a POST request to Google Drive to start a resumable session
    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Upload-Content-Type': mimeType,
        ...(size ? { 'X-Upload-Content-Length': size.toString() } : {})
      },
      body: JSON.stringify({
        name,
        mimeType,
        parents: [targetParentId]
      })
    });

    if (!response.ok) {
      throw new Error(`Google Drive API error: ${response.statusText}`);
    }

    const uploadUrl = response.headers.get('Location');
    
    res.json({ uploadUrl });
  } catch (error) {
    console.error('Upload session error:', error);
    res.status(500).json({ message: (error as Error).message });
  }
};

// @desc  Finalize direct client upload and save metadata
// @route POST /api/files/upload-complete
export const finalizeUpload = async (req: AuthRequest, res: Response) => {
  try {
    const { fileId, name, mimeType, size, parentId } = req.body;
    const targetParentId = parentId || DRIVE_FOLDER_ID;

    await FileMetadata.create({
      fileId,
      name,
      type: mimeType || 'application/octet-stream',
      size: Number(size || 0),
      ownerUserId: req.user?._id,
      parentId: targetParentId,
      rootId: DRIVE_FOLDER_ID,
      status: 'active',
    });

    await logActivity((req as any).user?._id, 'upload', `Uploaded file (Direct): ${name}`);

    res.status(201).json({ message: 'Metadata saved successfully' });
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

// @desc  Get direct download link
// @route GET /api/files/:id/direct-download
export const getDownloadLink = async (req: Request, res: Response) => {
  try {
    const fileId = req.params['id'] as string;
    
    // Set permission to anyone with link can view (needed for direct download)
    try {
      await drive.permissions.create({
        fileId,
        requestBody: { role: 'reader', type: 'anyone' }
      });
    } catch (e) {
      console.warn('Could not set permissions (might already be set):', (e as Error).message);
    }

    const meta = await drive.files.get({ fileId, fields: 'id, name, webContentLink, webViewLink, mimeType' });
    
    await logActivity((req as any).user?._id, 'download', `Generated direct download link for: ${meta.data.name}`);

    res.json({
      webContentLink: meta.data.webContentLink,
      webViewLink: meta.data.webViewLink,
      mimeType: meta.data.mimeType
    });
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

// @desc  Clear all activity logs (Admin only)
export const clearActivityLogs = async (req: Request, res: Response) => {
  try {
    await ActivityLog.deleteMany({});
    await logActivity((req as any).user?._id, 'clear_logs', 'Cleared all system activity logs');
    res.json({ message: 'All activity logs cleared successfully' });
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};
