'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Folder, File, Files, Upload, FolderPlus, FilePlus, Download, Pencil,
  Trash2, Move, X, ChevronRight, Home, Image, FileText, Film,
  MoreVertical, Check, Users, Clock, Square, CheckSquare, Search, ExternalLink,
  Music, Archive, FileSpreadsheet, Monitor, Package, Smartphone, Minus, Maximize2, Loader2
} from 'lucide-react';
import api from '@/lib/api';

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime: string;
  webViewLink?: string;
}

const ROOT_ID = 'ROOT';

const isFolder = (f: DriveFile) => f.mimeType === 'application/vnd.google-apps.folder';
const isImage = (f: DriveFile) => f.mimeType.startsWith('image/');
const isVideo = (f: DriveFile) => f.mimeType.startsWith('video/');
const isConvertible = (f: DriveFile) => {
  const mime = f.mimeType;
  return mime.startsWith('application/vnd.google-apps.') ||
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mime === 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
};
const isDoc = (f: DriveFile) => isConvertible(f) || f.mimeType.includes('pdf') || f.mimeType.includes('text');

const FileIcon = ({ file }: { file: DriveFile }) => {
  const mime = file.mimeType.toLowerCase();
  
  if (isFolder(file)) return <Folder className="w-5 h-5 text-yellow-400 fill-yellow-400/10" />;
  
  // Images
  if (isImage(file)) return <Image className="w-5 h-5 text-emerald-400" />;
  
  // Videos
  if (isVideo(file)) return <Film className="w-5 h-5 text-purple-400" />;
  
  // Audio
  if (mime.startsWith('audio/')) return <Music className="w-5 h-5 text-pink-400" />;
  
  // PDFs
  if (mime === 'application/pdf') return <FileText className="w-5 h-5 text-red-500" />;
  
  // Documents / Word
  if (mime.includes('document') || mime.includes('msword')) return <FileText className="w-5 h-5 text-blue-500" />;
  
  // Spreadsheets / Excel
  if (mime.includes('spreadsheet') || mime.includes('excel') || mime.includes('sheet')) return <FileSpreadsheet className="w-5 h-5 text-green-500" />;
  
  // Presentations / PPT
  if (mime.includes('presentation') || mime.includes('powerpoint')) return <Monitor className="w-5 h-5 text-orange-500" />;
  
  // Archives / ZIP
  if (mime.includes('zip') || mime.includes('rar') || mime.includes('tar') || mime.includes('7z')) return <Archive className="w-5 h-5 text-amber-500" />;
  
  // APKs / Apps
  if (mime.includes('android.package-archive') || file.name.toLowerCase().endsWith('.apk')) return <Smartphone className="w-5 h-5 text-teal-400" />;
  
  // Scripts / Code
  if (mime.includes('javascript') || mime.includes('json') || mime.includes('html') || mime.includes('css')) return <Package className="w-5 h-5 text-indigo-400" />;

  return <File className="w-5 h-5 text-gray-400" />;
};

const fmt = (bytes?: string, isFolder?: boolean) => {
  if (isFolder && (!bytes || bytes === '0')) return '---';
  if (!bytes || bytes === '0') return '0 B';
  const b = parseInt(bytes);
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(b) / Math.log(k));
  if (i < 0) return '0 B';
  return parseFloat((b / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

export default function AdminFilesPage() {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [path, setPath] = useState<{ id: string; name: string }[]>([{ id: ROOT_ID, name: 'Root' }]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [actionFile, setActionFile] = useState<DriveFile | null>(null);
  const [renaming, setRenaming] = useState<DriveFile | null>(null);
  const [newName, setNewName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showUploadMenu, setShowUploadMenu] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<{
    name: string;
    size: number;
    status: 'pending' | 'uploading' | 'done' | 'error';
    progress: number;
    error?: string;
  }[]>([]);
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [previewFile, setPreviewFile] = useState<DriveFile | null>(null);
  const [deletingIds, setDeletingIds] = useState<string[]>([]);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [fakeProgress, setFakeProgress] = useState(0);

  // Animate a fake counter 1→99 during indeterminate download phase
  useEffect(() => {
    if (downloadProgress === -1) {
      setFakeProgress(1);
      const interval = setInterval(() => {
        setFakeProgress(prev => {
          if (prev >= 99) { clearInterval(interval); return 99; }
          // Slow down as it approaches 99
          const step = prev < 30 ? 3 : prev < 60 ? 2 : prev < 85 ? 1 : 0.3;
          return Math.min(99, prev + step);
        });
      }, 200);
      return () => clearInterval(interval);
    } else {
      setFakeProgress(0);
    }
  }, [downloadProgress]);
  
  // Real-time Overall Upload Progress based on bytes
  useEffect(() => {
    if (uploadQueue.length === 0) {
      setUploadProgress(0);
      return;
    }
    const totalBytes = uploadQueue.reduce((acc, f) => acc + f.size, 0);
    if (totalBytes === 0) {
      // Fallback if sizes are 0 (e.g. empty files)
      const doneCount = uploadQueue.filter(q => q.status === 'done').length;
      setUploadProgress(Math.round((doneCount * 100) / uploadQueue.length));
      return;
    }
    
    const uploadedBytes = uploadQueue.reduce((acc, f) => {
      if (f.status === 'done') return acc + f.size;
      if (f.status === 'uploading') return acc + (f.size * (f.progress / 100));
      return acc;
    }, 0);
    
    setUploadProgress(Math.round((uploadedBytes * 100) / totalBytes));
  }, [uploadQueue]);
  const [confirmModal, setConfirmModal] = useState<{
    show: boolean,
    title: string,
    message: string,
    onConfirm: () => void,
    isDanger?: boolean
  }>({ show: false, title: '', message: '', onConfirm: () => { }, isDanger: false });
  const [movingIds, setMovingIds] = useState<string[]>([]);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [trashFiles, setTrashFiles] = useState<any[]>([]);
  const [loadingTrash, setLoadingTrash] = useState(false);
  const [selectedTrash, setSelectedTrash] = useState<Set<string>>(new Set());
  const [showUsers, setShowUsers] = useState(false);
  const [downloadingFile, setDownloadingFile] = useState<any>(null);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: 'success' | 'error' }[]>([]);
  const [isUploadMinimized, setIsUploadMinimized] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);

  // Grouped Queue for UI
  const groupedQueue = useMemo(() => {
    const groups: Record<string, any[]> = {};
    const singleFiles: any[] = [];

    uploadQueue.forEach(item => {
      if (item.name.includes('/')) {
        const root = item.name.split('/')[0];
        if (!groups[root]) groups[root] = [];
        groups[root].push(item);
      } else {
        singleFiles.push({ ...item, isGroup: false });
      }
    });

    const result = Object.entries(groups).map(([name, items]) => {
      const done = items.filter(i => i.status === 'done').length;
      const total = items.length;
      const totalProgress = items.reduce((acc, i) => acc + (i.progress || 0), 0);
      const progress = Math.round(totalProgress / total);
      const status = items.every(i => i.status === 'done') ? 'done' :
        items.some(i => i.status === 'error') ? 'error' :
          items.some(i => i.status === 'uploading') ? 'uploading' : 'pending';

      return {
        name,
        isGroup: true,
        count: total,
        doneCount: done,
        progress,
        status,
        size: items.reduce((acc, i) => acc + i.size, 0)
      };
    });

    return [...result, ...singleFiles];
  }, [uploadQueue]);
  const uploadXhrRef = useRef<XMLHttpRequest | null>(null);

  const currentFolder = path[path.length - 1]!;

  const loadFiles = async (folderId: string) => {
    setLoading(true);
    setSelected(new Set());
    try {
      const res = await api.get(`/files?parentId=${folderId}`);
      setFiles(res.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (!searchQuery) {
      loadFiles(currentFolder.id);
    } else {
      const timer = setTimeout(async () => {
        setLoading(true);
        try {
          const res = await api.get(`/files/search?q=${encodeURIComponent(searchQuery)}`);
          setFiles(res.data);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [searchQuery, currentFolder.id]);

  // Push a sentinel history entry whenever a modal opens, so back gesture closes it
  useEffect(() => {
    const anyModalOpen = !!previewFile || !!renaming || showLogs || showTrash || showUsers || showMoveModal || showDownloadModal || showNewFolderModal;
    if (anyModalOpen) {
      window.history.pushState({ modal: true }, '');
    }
  }, [previewFile, renaming, showLogs, showTrash, showUsers, showMoveModal, showDownloadModal, showNewFolderModal]);

  useEffect(() => {
    if (!searchQuery) {
      loadFiles(currentFolder.id);
    }

    const handlePopState = (e: PopStateEvent) => {
      // If a modal is open, close it and stay on the page
      if (previewFile) { setPreviewFile(null); return; }
      if (renaming) { setRenaming(null); return; }
      if (showLogs) { setShowLogs(false); return; }
      if (showTrash) { setShowTrash(false); return; }
      if (showUsers) { setShowUsers(false); return; }
      if (showMoveModal) { setShowMoveModal(false); return; }
      if (showDownloadModal) { setShowDownloadModal(false); return; }
      if (showNewFolderModal) { setShowNewFolderModal(false); return; }
      if (confirmModal.show) { setConfirmModal(c => ({ ...c, show: false })); return; }

      // Otherwise handle folder navigation
      if (e.state?.path) {
        setPath(e.state.path);
        loadFiles(e.state.path[e.state.path.length - 1].id);
        return;
      }

      const params = new URLSearchParams(window.location.search);
      const folderId = params.get('folder') || ROOT_ID;
      const existing = path.find(p => p.id === folderId);
      if (existing) {
        setPath(path.slice(0, path.indexOf(existing) + 1));
        loadFiles(folderId);
      } else {
        api.get(`/files/${folderId}/metadata`).then(res => {
          setPath([{ id: ROOT_ID, name: 'Root' }, { id: folderId, name: res.data.name }]);
        }).catch(() => {
          setPath([{ id: ROOT_ID, name: 'Root' }, { id: folderId, name: 'Folder' }]);
        });
        loadFiles(folderId);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [currentFolder.id, previewFile, renaming, showLogs, showTrash, showUsers, showMoveModal, showDownloadModal, showNewFolderModal, confirmModal.show]);


  const filteredFiles = useMemo(() => {
    const matchesCategory = (f: DriveFile) => {
      if (activeCategory === 'all') return true;
      if (activeCategory === 'folders') return f.mimeType === 'application/vnd.google-apps.folder';
      if (activeCategory === 'images') return f.mimeType.startsWith('image/');
      if (activeCategory === 'docs') return (f.mimeType.includes('document') || f.mimeType.includes('pdf') || f.mimeType.includes('text'));
      if (activeCategory === 'videos') return f.mimeType.startsWith('video/');
      return true;
    };

    const sorted = files.filter(matchesCategory).sort((a, b) => {
      const aFolder = isFolder(a);
      const bFolder = isFolder(b);
      if (aFolder && !bFolder) return -1;
      if (!aFolder && bFolder) return 1;
      return a.name.localeCompare(b.name);
    });
    return sorted;
  }, [files, activeCategory]);

  const addToast = (msg: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  };

  const fetchStats = async () => {
    try {
      const res = await api.get(`/files/admin-stats?parentId=${currentFolder.id}`);
      setStats(res.data);
    } catch (e) { console.error(e); }
  };

  const cancelUpload = () => {
    if (uploadXhrRef.current) {
      uploadXhrRef.current.abort();
      setUploading(false);
      setUploadProgress(0);
      addToast('Upload cancelled', 'error');
    }
  };

  useEffect(() => {
    fetchStats();
  }, [currentFolder.id]);

  // Escape key closes the topmost modal (mirrors back gesture)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (previewFile) { setPreviewFile(null); return; }
      if (renaming) { setRenaming(null); return; }
      if (showNewFolderModal) { setShowNewFolderModal(false); return; }
      if (showDownloadModal) { setShowDownloadModal(false); return; }
      if (showMoveModal) { setShowMoveModal(false); return; }
      if (showLogs) { setShowLogs(false); return; }
      if (showTrash) { setShowTrash(false); return; }
      if (showUsers) { setShowUsers(false); return; }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [previewFile, renaming, showNewFolderModal, showDownloadModal, showMoveModal, showLogs, showTrash, showUsers]);

  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await api.get('/files/admin-logs');
      setLogs(res.data);
      setShowLogs(true);
    } catch (e) { console.error(e); }
    finally { setLoadingLogs(false); }
  };

  const fetchTrash = async () => {
    setLoadingTrash(true);
    try {
      const res = await api.get('/files/admin-trash');
      setTrashFiles(res.data);
      setShowTrash(true);
    } catch (e) { console.error(e); }
    finally { setLoadingTrash(false); }
  };

  const restoreFile = async (id: string) => {
    try {
      await api.put(`/files/${id}/restore`);
      addToast('File restored!');
      setTrashFiles(prev => prev.filter(f => f.id !== id));
      loadFiles(currentFolder.id);
      fetchStats();
    } catch (e) { addToast('Restore failed', 'error'); }
  };

  const handleEmptyTrash = async () => {
    setConfirmModal({
      show: true,
      title: 'Empty Trash?',
      message: 'This will permanently delete ALL items in the trash bin. This action cannot be undone.',
      isDanger: true,
      onConfirm: async () => {
        addToast('Emptying trash...');
        try {
          await api.delete('/files/trash/all');
          addToast('Trash bin emptied successfully');
          setTrashFiles([]);
          setSelectedTrash(new Set());
          fetchStats();
        } catch (e: any) {
          addToast(e.response?.data?.message || 'Error emptying trash', 'error');
        }
        setConfirmModal(prev => ({ ...prev, show: false }));
      }
    });
  };

  const handleDeletePermanently = async (ids: string[]) => {
    setConfirmModal({
      show: true,
      title: 'Permanently Delete?',
      message: `Are you sure you want to delete ${ids.length} item(s) permanently?`,
      isDanger: true,
      onConfirm: async () => {
        addToast('Deleting items...');
        try {
          await api.delete('/files/trash', { data: { fileIds: ids } });
          addToast('Items deleted permanently');
          setTrashFiles(prev => prev.filter(f => !ids.includes(f.id)));
          setSelectedTrash(new Set());
          fetchStats();
        } catch (e: any) {
          addToast(e.response?.data?.message || 'Error deleting items', 'error');
        }
        setConfirmModal(prev => ({ ...prev, show: false }));
      }
    });
  };

  const handleRestoreAll = async () => {
    setConfirmModal({
      show: true,
      title: 'Restore All Items?',
      message: 'This will restore all items from the trash to their original locations.',
      isDanger: false,
      onConfirm: async () => {
        addToast('Restoring all...');
        try {
          await api.put('/files/trash/restore-all');
          addToast('All items restored');
          setTrashFiles([]);
          setSelectedTrash(new Set());
          loadFiles(currentFolder.id);
          fetchStats();
        } catch (e: any) {
          addToast(e.response?.data?.message || 'Restore all failed', 'error');
        }
        setConfirmModal(prev => ({ ...prev, show: false }));
      }
    });
  };

  const handleRestoreBulk = async (ids: string[]) => {
    addToast(`Restoring ${ids.length} items...`);
    try {
      await api.put('/files/trash/restore-bulk', { fileIds: ids });
      addToast('Items restored successfully');
      setTrashFiles(prev => prev.filter(f => !ids.includes(f.id)));
      setSelectedTrash(new Set());
      loadFiles(currentFolder.id);
      fetchStats();
    } catch (e: any) {
      addToast(e.response?.data?.message || 'Bulk restore failed', 'error');
    }
  };

  const handleUpdateUserStatus = async (userId: string, status: string) => {
    try {
      await api.put('/files/admin-users/status', { userId, status });
      addToast(`User status updated to ${status}`);
      setUsers(prev => prev.map(u => u._id === userId ? { ...u, status } : u));
    } catch (e: any) {
      addToast(e.response?.data?.message || 'Error updating status', 'error');
    }
  };

  const handleDeleteUser = async (userId: string, name: string) => {
    setConfirmModal({
      show: true,
      title: 'Delete User?',
      message: `Are you sure you want to delete user "${name}"? This action cannot be undone and will remove all their access.`,
      isDanger: true,
      onConfirm: async () => {
        try {
          await api.delete(`/files/admin-users/${userId}`);
          addToast('User deleted successfully');
          setUsers(prev => prev.filter(u => u._id !== userId));
        } catch (e: any) {
          addToast(e.response?.data?.message || 'Error deleting user', 'error');
        }
        setConfirmModal(prev => ({ ...prev, show: false }));
      }
    });
  };

  const handleClearLogs = async () => {
    setConfirmModal({
      show: true,
      title: 'Clear Activity Logs?',
      message: 'This will permanently delete all system activity logs. This cannot be undone.',
      isDanger: true,
      onConfirm: async () => {
        try {
          await api.delete('/files/admin-logs');
          addToast('Activity logs cleared');
          setLogs([]);
        } catch (e: any) {
          addToast(e.response?.data?.message || 'Error clearing logs', 'error');
        }
        setConfirmModal(prev => ({ ...prev, show: false }));
      }
    });
  };

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await api.get('/files/admin-users');
      setUsers(res.data);
      setShowUsers(true);
    } catch (e) { console.error(e); }
    finally { setLoadingUsers(false); }
  };

  const [longPressTimer, setLongPressTimer] = useState<any>(null);

  const handleItemTouchStart = (id: string) => {
    const timer = setTimeout(() => {
      toggleSelect(id);
      if (navigator.vibrate) navigator.vibrate(50);
    }, 500);
    setLongPressTimer(timer);
  };

  const handleItemTouchEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  const handleItemClick = (file: DriveFile) => {
    // If we are in selection mode, click toggles selection
    if (selected.size > 0) {
      toggleSelect(file.id);
    } else {
      // Normal navigation
      if (file.mimeType === 'application/vnd.google-apps.folder') navigate(file);
      else setPreviewFile(file);
    }
  };

  const handleMove = async (targetId: string, idsToMove?: string[]) => {
    if (actionLoading) return;
    const ids = idsToMove || movingIds;
    if (ids.length === 0) return;
    setActionLoading(true);
    try {
      await api.put('/files/move', { fileIds: ids, targetParentId: targetId });
      setFiles(prev => prev.filter(f => !ids.includes(f.id)));
      setSelected(new Set());
      setShowMoveModal(false);
      addToast('Moved successfully');
    } catch (e) { addToast('Move failed', 'error'); }
    finally { setActionLoading(false); }
  };

  const performDirectUpload = async (file: File, parentId: string) => {
    const sessionRes = await api.post('/files/upload-session', {
      name: file.name,
      mimeType: file.type || 'application/octet-stream',
      parentId,
      size: file.size
    });
    const { uploadUrl } = sessionRes.data;

    const uploadReq = new XMLHttpRequest();
    uploadXhrRef.current = uploadReq;
    uploadReq.open('PUT', uploadUrl, true);
    uploadReq.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        setUploadProgress(Math.round((e.loaded * 100) / e.total));
      }
    };

    const driveResponse: any = await new Promise((resolve, reject) => {
      uploadReq.onload = () => {
        uploadXhrRef.current = null;
        if (uploadReq.status >= 200 && uploadReq.status < 300) {
          resolve(JSON.parse(uploadReq.responseText));
        } else {
          console.error('Upload failed with status:', uploadReq.status, uploadReq.responseText);
          reject(new Error(`Upload failed: ${uploadReq.statusText || 'Unknown Error'}`));
        }
      };
      uploadReq.onerror = () => {
        uploadXhrRef.current = null;
        reject(new Error('Network error'));
      };
      uploadReq.onabort = () => {
        uploadXhrRef.current = null;
        reject(new Error('Upload cancelled'));
      };
      uploadReq.send(file);
    });

    await api.post('/files/upload-complete', {
      fileId: driveResponse.id,
      name: file.name,
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
      parentId
    });
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const targetInput = e.target as HTMLInputElement;
    const filesList = targetInput.files;
    if (!filesList || filesList.length === 0) return;
    const files = Array.from(filesList);

    // Build initial queue
    const queue = files.map(f => ({
      name: f.webkitRelativePath || f.name,
      size: f.size,
      status: 'pending' as const,
      progress: 0,
    }));
    setUploadQueue(queue);
    setShowUploadModal(true);
    setUploading(true);
    setShowUploadMenu(false);

    // ── Smart folder cache ─────────────────────────────────────────────
    // Key: "parentId::folderName" → existing or newly-created drive folder id
    // This prevents creating duplicate folders even across multiple upload sessions
    const folderCache: Record<string, string> = {};

    const getOrCreateFolder = async (name: string, parentId: string): Promise<string> => {
      const cacheKey = `${parentId}::${name}`;
      if (folderCache[cacheKey]) return folderCache[cacheKey];

      // Check if a folder with this name already exists under parentId
      try {
        const res = await api.get(`/files?parentId=${parentId}`);
        const existing = (res.data as any[]).find(
          (f: any) => f.mimeType === 'application/vnd.google-apps.folder' && f.name === name
        );
        if (existing) {
          folderCache[cacheKey] = existing.id;
          return existing.id;
        }
      } catch { /* fall through to create */ }

      // Doesn't exist → create it
      const created = await api.post('/files/folder', { name, parentId });
      folderCache[cacheKey] = created.data.id;
      return created.data.id;
    };
    // ──────────────────────────────────────────────────────────────────

    let doneCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const relativePath = (file as any).webkitRelativePath || '';
      const pathParts = relativePath ? relativePath.split('/').slice(0, -1) : [];

      setUploadQueue(prev => prev.map((q, idx) =>
        idx === i ? { ...q, status: 'uploading' } : q
      ));

      try {
        // Resolve the correct parent folder, creating missing folders along the way
        let parentId = currentFolder.id;
        for (const part of pathParts) {
          parentId = await getOrCreateFolder(part, parentId);
        }

        // Upload file
        const sessionRes = await api.post('/files/upload-session', {
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          parentId,
          size: file.size
        });
        const { uploadUrl } = sessionRes.data;

        const fileId = await new Promise<string>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          uploadXhrRef.current = xhr;
          xhr.open('PUT', uploadUrl, true);
          xhr.upload.onprogress = (ev) => {
            if (ev.lengthComputable) {
              const pct = Math.round((ev.loaded * 100) / ev.total);
              setUploadQueue(prev => prev.map((q, idx) =>
                idx === i ? { ...q, progress: pct } : q
              ));
            }
          };
          xhr.onload = () => {
            uploadXhrRef.current = null;
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const res = JSON.parse(xhr.responseText);
                resolve(res.id || '');
              } catch (e) {
                resolve('');
              }
            } else reject(new Error(`HTTP ${xhr.status}`));
          };
          xhr.onerror = () => { uploadXhrRef.current = null; reject(new Error('Network error')); };
          xhr.onabort = () => { uploadXhrRef.current = null; reject(new Error('Cancelled')); };
          xhr.send(file);
        });

        await api.post('/files/upload-complete', {
          fileId,
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          size: file.size,
          parentId
        });

        doneCount++;
        setUploadQueue(prev => prev.map((q, idx) =>
          idx === i ? { ...q, status: 'done', progress: 100 } : q
        ));
      } catch (err: any) {
        setUploadQueue(prev => prev.map((q, idx) =>
          idx === i ? { ...q, status: 'error', error: err.message } : q
        ));
      }
    }

    await loadFiles(currentFolder.id);
    fetchStats();
    setUploading(false);
    targetInput.value = ''; // Reset input at the very end

    // Auto close modal after 2 seconds if everything finished
    setTimeout(() => {
      setShowUploadModal(false);
      setUploadQueue([]);
    }, 2000);
  };



  const handleFolderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const filesList = e.target.files;
    if (!filesList || filesList.length === 0) return;

    setUploading(true);
    setUploadProgress(0);
    const totalFiles = filesList.length;
    let uploadedCount = 0;

    // Map to keep track of created folder IDs to avoid duplicates
    const folderCache: Record<string, string> = { '': currentFolder.id };

    try {
      for (let i = 0; i < filesList.length; i++) {
        const file = filesList[i];
        const relativePath = (file as any).webkitRelativePath || '';
        const pathParts = relativePath.split('/');
        pathParts.pop(); // Remove filename

        // Ensure all folders in the path exist
        let parentId = currentFolder.id;
        let currentPath = '';

        for (const part of pathParts) {
          const nextPath = currentPath ? `${currentPath}/${part}` : part;
          if (!folderCache[nextPath]) {
            // Create folder
            const res = await api.post('/files/folder', { name: part, parentId });
            folderCache[nextPath] = res.data.id;
          }
          parentId = folderCache[nextPath];
          currentPath = nextPath;
        }

        // Upload file to the resolved parentId
        const form = new FormData();
        form.append('file', file);
        form.append('parentId', parentId);
        await api.post('/files/upload', form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        uploadedCount++;
        setUploadProgress(Math.round((uploadedCount * 100) / totalFiles));
      }
      await loadFiles(currentFolder.id);
    } catch (e) {
      console.error('Folder upload failed:', e);
    } finally {
      setUploading(false);
      setShowUploadMenu(false);
    }
  };

  const createNewFolder = async () => {
    if (!newFolderName || actionLoading) return;
    setActionLoading(true);
    try {
      await api.post('/files/folder', { name: newFolderName, parentId: currentFolder.id });
      setNewFolderName('');
      setShowNewFolderModal(false);
      await loadFiles(currentFolder.id);
      fetchStats();
      addToast('Folder created!');
    } catch (e) {
      addToast('Error creating folder', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateDoc = async () => {
    if (actionLoading) return;
    setActionLoading(true);
    try {
      const res = await api.post('/files/doc', { name: 'Untitled Document', parentId: currentFolder.id });
      window.open(res.data.webViewLink, '_blank');
      await loadFiles(currentFolder.id);
      fetchStats();
    } catch (e) { console.error(e); }
    finally { setActionLoading(false); }
  };

  const handleRename = async () => {
    if (!renaming || !newName || actionLoading) return;
    setActionLoading(true);
    try {
      await api.put(`/files/${renaming.id}/rename`, { name: newName });
      setFiles(prev => prev.map(f => f.id === renaming.id ? { ...f, name: newName } : f));
      setRenaming(null);
      addToast('File renamed!');
    } catch (e) {
      addToast('Error renaming', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (ids: string[]) => {
    setDeletingIds(prev => [...prev, ...ids]);
    try {
      await api.delete('/files', { data: { fileIds: ids } });
      setFiles(prev => prev.filter(f => !ids.includes(f.id)));
      setSelected(new Set());
      addToast('Items moved to trash');
      fetchStats();
    } catch (e) { addToast('Delete failed', 'error'); }
    finally { setDeletingIds(prev => prev.filter(id => !ids.includes(id))); }
  };

  const handleDownload = async (file: DriveFile, format?: string) => {
    if (isConvertible(file) && !format && !isFolder(file)) {
      setDownloadingFile(file);
      setShowDownloadModal(true);
      return;
    }
    if (format) {
      const token = localStorage.getItem('token');
      const url = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/files/${file.id}/download?token=${token}&format=${format}`;
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', file.name);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setShowDownloadModal(false);
      return;
    }

    // If it's a folder, use the bulk-download endpoint to zip it
    if (isFolder(file)) {
      addToast('Preparing folder ZIP...');
      setDownloadProgress(-1); // Show overlay immediately
      try {
        const res = await api.post('/files/bulk-download', { fileIds: [file.id] }, {
          responseType: 'blob',
          onDownloadProgress: (progressEvent: any) => {
            if (progressEvent.total && progressEvent.total > 0) {
              setDownloadProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total));
            } else {
              setDownloadProgress(-1); // indeterminate
            }
          }
        });
        const url = window.URL.createObjectURL(new Blob([res.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `${file.name}.zip`);
        document.body.appendChild(link);
        link.click();
        link.parentNode?.removeChild(link);
        window.URL.revokeObjectURL(url);
      } catch (e) {
        console.error(e);
        addToast('Folder download failed', 'error');
      } finally {
        setDownloadProgress(null);
      }
      return;
    }

    // Regular file — show progress then direct download
    setDownloadProgress(-1);
    try {
      addToast('Preparing direct download...');
      const res = await api.get(`/files/${file.id}/direct-download`);
      const { webContentLink } = res.data;
      if (webContentLink) {
        const link = document.createElement('a');
        link.href = webContentLink;
        link.setAttribute('target', '_blank');
        document.body.appendChild(link);
        link.click();
        link.parentNode?.removeChild(link);
      } else {
        addToast('Direct link not available', 'error');
      }
    } catch (e) {
      console.error(e);
      addToast('Download failed', 'error');
    } finally {
      setDownloadProgress(null);
    }

    setShowDownloadModal(false);
  };

  const navigate = (folder: DriveFile) => {
    setSearchQuery('');
    const newPath = [...path, { id: folder.id, name: folder.name }];
    setPath(newPath);
    const url = new URL(window.location.href);
    url.searchParams.set('folder', folder.id);
    window.history.pushState({ path: newPath }, '', url);
  };

  const breadcrumbNav = (idx: number) => {
    const newPath = path.slice(0, idx + 1);
    setPath(newPath);
    const url = new URL(window.location.href);
    url.searchParams.set('folder', newPath[newPath.length - 1].id);
    window.history.pushState({ path: newPath }, '', url);
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  return (
    <motion.div
      className="space-y-4"
      onPanEnd={(_, info) => {
        // Swipe from left to right (offset x > 100) and path length > 1
        if (info.offset.x > 100 && Math.abs(info.offset.y) < 50 && path.length > 1) {
          breadcrumbNav(path.length - 2);
        }
      }}
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
      onDrop={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const file = e.dataTransfer.files?.[0];
        if (!file) return;

        setUploading(true);
        setUploadProgress(0);
        try {
          await performDirectUpload(file, currentFolder.id);
          await loadFiles(currentFolder.id);
          fetchStats();
        } catch (err) { console.error(err); }
        finally { setUploading(false); }
      }}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        {/* Left: back button + title + breadcrumb */}
        <div className="flex items-start gap-3 min-w-0">
          {path.length > 1 && (
            <button onClick={() => breadcrumbNav(path.length - 2)}
              className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white transition-colors shrink-0 mt-0.5" title="Go Back">
              <ChevronRight className="w-5 h-5 rotate-180" />
            </button>
          )}
          <div className="min-w-0">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              File Manager
              {stats && (
                <span className="text-[10px] font-normal bg-white/5 border border-white/10 px-2 py-0.5 rounded-full text-gray-400">
                  {stats.totalFiles} Files • {stats.totalFolders} Folders
                </span>
              )}
            </h2>
            {/* Breadcrumb */}
            <div className="flex items-center gap-1 mt-1 overflow-x-auto no-scrollbar max-w-[70vw] sm:max-w-sm">
              {searchQuery ? (
                <span className="text-sm text-purple-400 font-medium flex items-center gap-2 whitespace-nowrap">
                  <Search className="w-4 h-4" /> Search results for "{searchQuery}"
                </span>
              ) : (
                path.map((p, i) => (
                  <span key={i} className="flex items-center gap-1 shrink-0">
                    {i > 0 && <ChevronRight className="w-3 h-3 text-gray-500 shrink-0" />}
                    <button
                      onClick={() => breadcrumbNav(i)}
                      className={`text-sm transition-colors whitespace-nowrap ${i === path.length - 1 ? 'text-white font-medium' : 'text-gray-400 hover:text-white'}`}
                    >
                      {i === 0 ? <Home className="w-4 h-4" /> : (p.name.length > 20 ? p.name.substring(0, 17) + '...' : p.name)}
                    </button>
                  </span>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right: storage bar */}
        {stats && (
          <div className="w-full sm:w-56 bg-white/5 p-3 rounded-2xl border border-white/10 shrink-0 self-start sm:self-auto">
            <div className="flex justify-between text-[10px] text-gray-400 mb-1.5 font-medium uppercase tracking-wider">
              <span>Storage Usage</span>
              <span>{fmt(stats.used)} / {fmt(stats.limit)}</span>
            </div>
            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(Number(stats.used) > 0 ? 1 : 0, (Number(stats.used) / (Number(stats.limit) || 10 * 1024 * 1024 * 1024)) * 100)}%` }}
                className="h-full bg-gradient-to-r from-purple-500 to-pink-500 shadow-[0_0_10px_rgba(168,85,247,0.4)]"
              />
            </div>
          </div>
        )}
      </div>


      {/* Search & Categories */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between mb-2">
        <div className="relative w-full md:max-w-md group">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-gray-500 group-focus-within:text-purple-400 transition-colors">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all outline-none shadow-lg shadow-black/20"
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar w-full md:w-auto pb-1">
          {[
            { id: 'all', label: 'All', icon: <Home className="w-3 h-3" /> },
            { id: 'folders', label: 'Folders', icon: <Folder className="w-3 h-3 text-yellow-400" /> },
            { id: 'images', label: 'Images', icon: <Image className="w-3 h-3" /> },
            { id: 'docs', label: 'Docs', icon: <FileText className="w-3 h-3" /> },
            { id: 'videos', label: 'Videos', icon: <Film className="w-3 h-3" /> },
          ].map(cat => (
            <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all border
                ${activeCategory === cat.id
                  ? 'bg-purple-600 text-white border-purple-500'
                  : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10 hover:border-white/20'}`}>
              {cat.icon} {cat.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-2">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar w-full sm:w-auto pb-2">
          {selected.size > 0 && (
            <div className="flex items-center gap-2 bg-white/5 p-1 rounded-2xl border border-white/10 shrink-0">
              <span className="text-sm text-gray-400 px-3 font-medium whitespace-nowrap">{selected.size} selected</span>
              <button onClick={() => { setMovingIds(Array.from(selected)); setShowMoveModal(true); }}
                className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors text-sm whitespace-nowrap">
                <Move className="w-4 h-4" /> Move
              </button>
              <button onClick={async () => {
                const token = localStorage.getItem('token');
                const res = await api.post('/files/bulk-download', { fileIds: Array.from(selected) }, { responseType: 'blob' });
                const url = window.URL.createObjectURL(new Blob([res.data]));
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', 'bulk-download.zip');
                document.body.appendChild(link);
                link.click();
                link.remove();
              }}
                className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors text-sm whitespace-nowrap">
                <Download className="w-4 h-4" /> Download
              </button>
              <button onClick={() => handleDelete(Array.from(selected))}
                className="flex items-center gap-2 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors text-sm whitespace-nowrap">
                <Trash2 className="w-4 h-4" /> Delete
              </button>
              <button onClick={() => setSelected(new Set())}
                className="p-2 text-gray-400 hover:text-white transition-colors" title="Clear selection">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* View Toggle */}
          <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 shrink-0">
            <button onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
              <MoreVertical className="w-4 h-4 rotate-90" />
            </button>
            <button onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
              <Square className="w-4 h-4" />
            </button>
          </div>

          <button onClick={fetchLogs}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 text-white rounded-xl hover:bg-white/10 transition-all text-sm font-medium shrink-0">
            <MoreVertical className="w-4 h-4" /> Activity
          </button>

          <button onClick={fetchTrash}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 text-white rounded-xl hover:bg-white/10 transition-all text-sm font-medium shrink-0">
            <Trash2 className="w-4 h-4" /> Trash
          </button>

          <button onClick={fetchUsers}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 text-white rounded-xl hover:bg-white/10 transition-all text-sm font-medium shrink-0">
            <Users className="w-4 h-4" /> Users
          </button>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* New */}
          <div className="relative">
            <button onClick={() => { setShowNewMenu(!showNewMenu); setShowUploadMenu(false); }}
              className="flex items-center gap-1.5 px-4 py-2 bg-white/5 border border-white/10 text-white rounded-xl hover:bg-white/10 transition-colors text-sm font-medium">
              <FilePlus className="w-4 h-4" /> New
            </button>
            <AnimatePresence>
              {showNewMenu && (
                <>
                  <div className="fixed inset-0 z-0 cursor-default" onClick={() => setShowNewMenu(false)} />
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                    className="absolute right-0 top-full mt-2 glass border border-white/10 rounded-xl p-1 z-10 min-w-[160px]">
                    <button onClick={() => { setShowNewFolderModal(true); setShowNewMenu(false); }}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-200 hover:bg-white/10 rounded-lg">
                      <FolderPlus className="w-4 h-4 text-yellow-400" /> New Folder
                    </button>
                    <button onClick={() => { handleCreateDoc(); setShowNewMenu(false); }}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-200 hover:bg-white/10 rounded-lg">
                      <FileText className="w-4 h-4 text-blue-300" /> New Document
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          {/* Upload */}
          <div className="relative">
            <button onClick={() => { setShowUploadMenu(!showUploadMenu); setShowNewMenu(false); }}
              className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 text-white rounded-xl text-sm font-medium hover:bg-purple-500 transition-all active:scale-95">
              <Upload className="w-4 h-4" /> Upload
            </button>
            <AnimatePresence>
              {showUploadMenu && (
                <>
                  <div className="fixed inset-0 z-0 cursor-default" onClick={() => setShowUploadMenu(false)} />
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                    className="absolute right-0 top-full mt-2 glass border border-white/10 rounded-xl p-1 z-10 min-w-[190px]">
                    {/* Multi-file pick */}
                    <button onClick={() => { fileInput.current?.click(); setShowUploadMenu(false); }}
                      className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-gray-200 hover:bg-white/10 rounded-lg">
                      <Files className="w-4 h-4 text-purple-400" /> Upload Files
                      <span className="ml-auto text-[10px] text-gray-500 bg-white/5 px-1.5 rounded">multi</span>
                    </button>
                    {/* Folder pick */}
                    <button onClick={() => { folderInput.current?.click(); setShowUploadMenu(false); }}
                      className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-gray-200 hover:bg-white/10 rounded-lg">
                      <Folder className="w-4 h-4 text-yellow-400" /> Upload Folder
                      <span className="ml-auto text-[10px] text-gray-500 bg-white/5 px-1.5 rounded">dir</span>
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
            {/* Multi-file input */}
            <input ref={fileInput} type="file" multiple className="hidden" onChange={handleUpload} />
            {/* Folder input (uses handleUpload too — webkitRelativePath will be set) */}
            <input
              ref={folderInput}
              type="file"
              multiple
              className="hidden"
              onChange={handleUpload}
              {...({ webkitdirectory: '', directory: '' } as any)}
            />
          </div>
        </div>
      </div>

      {/* Batch Upload Queue Modal */}
      <AnimatePresence>
        {showUploadModal && !isUploadMinimized && (
          <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4"
            onClick={() => { if (!uploading) { setShowUploadModal(false); setUploadQueue([]); } }}>
            <motion.div
              initial={{ y: 60, opacity: 0, scale: 0.95 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 60, opacity: 0, scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="glass-card w-full sm:max-w-lg max-h-[85vh] flex flex-col rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl"
            >
              {/* Header */}
              <div className="px-4 pt-4 pb-3 border-b border-white/10 bg-white/5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                  <div>
                    <h3 className="text-base font-bold text-white">Uploading Files</h3>
                    <p className="text-[11px] text-gray-400">
                      {uploadQueue.filter(q => q.status === 'done').length} / {uploadQueue.length} completed
                      {uploading && ` · ${uploadProgress}% overall`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {uploading && (
                    <>
                      <button onClick={() => setIsUploadMinimized(true)}
                        className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-all" title="Minimize">
                        <Minus className="w-5 h-5" />
                      </button>
                      <button onClick={cancelUpload}
                        className="text-xs font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-1.5 rounded-lg hover:bg-red-500/20 transition-all">
                        Cancel
                      </button>
                    </>
                  )}
                  {!uploading && (
                    <button onClick={() => { setShowUploadModal(false); setUploadQueue([]); }}
                      className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-all">
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Overall progress bar */}
              <div className="h-1 bg-white/5 shrink-0">
                <motion.div
                  className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                  animate={{ width: `${uploadProgress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>

              {/* File list */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2 no-scrollbar">
                {groupedQueue.map((item, i) => (
                  <div key={i} className={`p-3 rounded-2xl border transition-all
                    ${item.status === 'done' ? 'bg-emerald-500/5 border-emerald-500/20'
                      : item.status === 'error' ? 'bg-red-500/5 border-red-500/20'
                        : item.status === 'uploading' ? 'bg-purple-500/10 border-purple-500/30'
                          : 'bg-white/3 border-white/5'}`}>
                    <div className="flex items-center gap-2.5">
                      {/* Status icon */}
                      <div className="shrink-0">
                        {item.status === 'done' && <Check className="w-4 h-4 text-emerald-400" />}
                        {item.status === 'error' && <X className="w-4 h-4 text-red-400" />}
                        {item.status === 'uploading' && (
                          <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                        )}
                        {item.status === 'pending' && (
                          <div className="w-4 h-4 rounded-full border border-white/20" />
                        )}
                      </div>
                      {/* Name + info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {item.isGroup ? <Folder className="w-3.5 h-3.5 text-yellow-500" /> : <FileIcon file={{ mimeType: 'file', name: item.name } as any} />}
                          <p className="text-xs font-medium text-white truncate">{item.name}</p>
                        </div>
                        {item.isGroup ? (
                          <p className="text-[10px] text-gray-500 truncate">Folder · {item.doneCount} / {item.count} files</p>
                        ) : (
                          <p className="text-[10px] text-gray-500 truncate">{fmt(String(item.size))}</p>
                        )}
                        {item.status === 'error' && (
                          <p className="text-[10px] text-red-400">{(item as any).error}</p>
                        )}
                      </div>
                      {/* Progress */}
                      <div className="shrink-0 text-right">
                        {item.status === 'uploading' || item.status === 'done' ? (
                          <span className={`text-[10px] font-bold ${item.status === 'done' ? 'text-emerald-400' : 'text-purple-400'}`}>
                            {item.progress}%
                          </span>
                        ) : (
                          <span className="text-[10px] text-gray-600">
                            {item.isGroup ? fmt(String(item.size)) : ''}
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Progress bar */}
                    {(item.status === 'uploading' || (item.isGroup && item.progress > 0 && item.progress < 100)) && (
                      <div className="mt-2 h-1 w-full bg-white/5 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-purple-500"
                          initial={{ width: 0 }}
                          animate={{ width: `${item.progress}%` }}
                          transition={{ duration: 0.3 }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Upload Indicator (Minimized) */}
      <AnimatePresence>
        {showUploadModal && isUploadMinimized && (
          <motion.div
            initial={{ y: 100, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 100, opacity: 0, scale: 0.9 }}
            whileHover={{ scale: 1.02 }}
            className="fixed bottom-6 right-6 z-[130] glass-card p-4 rounded-3xl flex items-center gap-4 shadow-2xl border border-purple-500/30 min-w-[280px] max-w-[320px]"
          >
            <div className="w-12 h-12 rounded-2xl bg-purple-500/20 flex items-center justify-center shrink-0 border border-purple-500/20">
              <Upload className="w-6 h-6 text-purple-400 animate-bounce" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-bold text-white">Uploading...</p>
                <span className="text-xs font-black text-purple-400">{uploadProgress}%</span>
              </div>
              <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                  animate={{ width: `${uploadProgress}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
              <p className="text-[10px] text-gray-500 mt-2 truncate">
                {uploadQueue.filter(q => q.status === 'done').length} / {uploadQueue.length} files done
              </p>
            </div>
            <button
              onClick={() => setIsUploadMinimized(false)}
              className="p-3 bg-purple-600/20 hover:bg-purple-600/40 text-purple-400 rounded-2xl transition-all active:scale-90"
              title="Maximize"
            >
              <Maximize2 className="w-5 h-5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* File Grid/List View */}
      <div className="glass-card rounded-2xl overflow-hidden min-h-[400px]">
        {loading ? (
          <div className={`p-6 ${viewMode === 'grid' ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4' : 'space-y-3'}`}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className={`bg-white/5 animate-pulse rounded-xl ${viewMode === 'grid' ? 'h-32' : 'h-12'}`} />
            ))}
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="py-20 text-center text-gray-500 flex flex-col items-center gap-3">
            <Folder className="w-12 h-12 opacity-20" />
            <p>{searchQuery ? 'No matches found' : 'This folder is empty'}</p>
          </div>
        ) : viewMode === 'list' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="w-10 px-4 py-3 text-center">
                    <button onClick={() => selected.size === filteredFiles.length ? setSelected(new Set()) : setSelected(new Set(filteredFiles.map(f => f.id)))}>
                      {selected.size === filteredFiles.length && filteredFiles.length > 0
                        ? <CheckSquare className="w-4 h-4 text-purple-400" />
                        : <Square className="w-4 h-4 text-gray-500" />}
                    </button>
                  </th>
                  {['Name', 'Size', 'Modified', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredFiles.map((file, i) => (
                  <motion.tr key={file.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}
                    className={`border-b border-white/5 hover:bg-white/5 transition-colors group ${selected.has(file.id) ? 'bg-purple-500/10' : ''}`}>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => toggleSelect(file.id)}>
                        {selected.has(file.id) ? <CheckSquare className="w-4 h-4 text-purple-400" /> : <Square className="w-4 h-4 text-gray-500 hover:text-gray-300" />}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleItemClick(file)}
                        onTouchStart={() => handleItemTouchStart(file.id)}
                        onTouchEnd={handleItemTouchEnd}
                        onContextMenu={(e) => { e.preventDefault(); toggleSelect(file.id); }}
                        className="flex items-center gap-3 text-white hover:text-purple-300 transition-colors w-full text-left">
                        <FileIcon file={file} />
                        <span className="text-sm font-medium truncate max-w-[150px] sm:max-w-[300px]">{file.name}</span>
                      </button>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-sm">{fmt(file.size, isFolder(file))}</td>
                    <td className="px-4 py-3 text-gray-400 text-sm whitespace-nowrap">{new Date(file.modifiedTime).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 transition-opacity">
                        <button onClick={(e) => { e.stopPropagation(); setRenaming(file); setNewName(file.name); }} title="Rename"
                          className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handleDownload(file); }} title="Download"
                          className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
                          <Download className="w-4 h-4" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); setMovingIds([file.id]); setShowMoveModal(true); }} title="Move"
                          className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
                          <Move className="w-4 h-4" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handleDelete([file.id]); }} title="Delete"
                          disabled={deletingIds.includes(file.id)}
                          className="p-1.5 rounded-lg hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors">
                          {deletingIds.includes(file.id)
                            ? <span className="w-4 h-4 border border-current border-t-transparent rounded-full animate-spin inline-block" />
                            : <Trash2 className="w-4 h-4" />}
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          /* Grid View */
          <div className="p-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {filteredFiles.map((file, i) => (
              <motion.div key={file.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.02 }}
                draggable
                onDragStart={(e: any) => {
                  e.dataTransfer.setData('fileId', file.id);
                  e.dataTransfer.setData('fileName', file.name);
                }}
                onDragOver={(e) => {
                  if (file.mimeType === 'application/vnd.google-apps.folder') {
                    e.preventDefault();
                    e.currentTarget.classList.add('bg-purple-500/20', 'border-purple-500');
                  }
                }}
                onDragLeave={(e) => {
                  e.currentTarget.classList.remove('bg-purple-500/20', 'border-purple-500');
                }}
                onDrop={async (e) => {
                  if (file.mimeType === 'application/vnd.google-apps.folder') {
                    e.preventDefault();
                    e.currentTarget.classList.remove('bg-purple-500/20', 'border-purple-500');
                    const draggedId = e.dataTransfer.getData('fileId');
                    if (draggedId && draggedId !== file.id) {
                      handleMove(file.id, [draggedId]);
                    }
                  }
                }}
                className={`relative p-4 rounded-3xl border transition-all cursor-pointer group flex flex-col items-center gap-3
                  ${selected.has(file.id)
                    ? 'bg-purple-500/10 border-purple-500/40'
                    : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/20'}`}
                onClick={() => handleItemClick(file)}
                onTouchStart={() => handleItemTouchStart(file.id)}
                onTouchEnd={handleItemTouchEnd}
                onContextMenu={(e) => { e.preventDefault(); toggleSelect(file.id); }}
              >
                {/* Selection Checkbox */}
                <div className={`absolute top-2 left-2 z-10 transition-all duration-200 
                  ${selected.has(file.id) ? 'opacity-100 scale-100' : 'opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100'}`}
                  onClick={e => { e.stopPropagation(); toggleSelect(file.id); }}>
                  <div className={`p-1 rounded-md border transition-all
                    ${selected.has(file.id) ? 'bg-purple-500 border-purple-400' : 'bg-black/40 border-white/10 hover:border-white/30'}`}>
                    {selected.has(file.id)
                      ? <Check className="w-2.5 h-2.5 text-white stroke-[4px]" />
                      : <div className="w-2.5 h-2.5" />
                    }
                  </div>
                </div>
                <div className="w-12 h-12 flex items-center justify-center rounded-xl bg-white/5">
                  <FileIcon file={file} />
                </div>
                <div className="text-center w-full">
                  <p className="text-white text-xs font-medium truncate mb-1">{file.name}</p>
                  <p className="text-gray-500 text-[10px]">{fmt(file.size, isFolder(file))}</p>
                </div>
                {/* Grid Hover Actions */}
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm opacity-0 group-hover:opacity-100 rounded-3xl flex items-center justify-center gap-2 transition-all">
                  <button onClick={e => { e.stopPropagation(); handleDownload(file); }} className="p-2 bg-white/10 rounded-lg hover:bg-white/20 text-white"><Download className="w-4 h-4" /></button>
                  <button onClick={e => { e.stopPropagation(); setMovingIds([file.id]); setShowMoveModal(true); }} className="p-2 bg-white/10 rounded-lg hover:bg-white/20 text-white"><Move className="w-4 h-4" /></button>
                  <button onClick={e => { e.stopPropagation(); handleDelete([file.id]); }} className="p-2 bg-red-500/20 rounded-lg hover:bg-red-500/30 text-red-400"><Trash2 className="w-4 h-4" /></button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Rename Modal */}
      <AnimatePresence>
        {renaming && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="glass-card max-w-sm w-full p-6 rounded-2xl">
              <h3 className="text-white font-semibold text-lg mb-4">Rename</h3>
              <input autoFocus value={newName} onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !actionLoading && handleRename()}
                disabled={actionLoading}
                className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 mb-4 disabled:opacity-50" />
              <div className="flex gap-2 justify-end">
                <button onClick={() => setRenaming(null)} disabled={actionLoading} className="px-4 py-2 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors disabled:opacity-50">Cancel</button>
                <button onClick={handleRename} disabled={actionLoading} className="px-4 py-2 rounded-xl bg-purple-600 text-white hover:bg-purple-500 transition-all flex items-center gap-2 disabled:opacity-50">
                  {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {actionLoading ? 'Renaming...' : 'Rename'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* New Folder Modal */}
      <AnimatePresence>
        {showNewFolderModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="glass-card max-w-sm w-full p-6 rounded-2xl">
              <h3 className="text-white font-semibold text-lg mb-4">New Folder</h3>
              <input autoFocus value={newFolderName} onChange={e => setNewFolderName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !actionLoading && createNewFolder()}
                placeholder="Folder name"
                disabled={actionLoading}
                className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 mb-4 disabled:opacity-50" />
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowNewFolderModal(false)} disabled={actionLoading} className="px-4 py-2 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors disabled:opacity-50">Cancel</button>
                <button onClick={createNewFolder} disabled={actionLoading} className="px-4 py-2 rounded-xl bg-purple-600 text-white hover:bg-purple-500 transition-all flex items-center gap-2 disabled:opacity-50">
                  {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {actionLoading ? 'Creating...' : 'Create'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Preview Modal */}
      <AnimatePresence>
        {previewFile && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-xl p-0 sm:p-4"
            onClick={() => setPreviewFile(null)}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full h-full sm:max-w-5xl sm:max-h-[90vh] flex flex-col glass-card border-none sm:rounded-[32px] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.5)]">

              {/* Top Bar */}
              <div className="p-4 sm:p-6 flex items-center justify-between bg-white/5 border-b border-white/5">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center shrink-0">
                    <FileIcon file={previewFile} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-white font-bold truncate text-sm sm:text-base">{previewFile.name}</h3>
                    <p className="text-[9px] sm:text-[10px] text-gray-500 uppercase tracking-widest truncate">{previewFile.mimeType}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 sm:gap-2 shrink-0 ml-2">
                  {(previewFile.mimeType === 'application/pdf' || isConvertible(previewFile)) && (
                    <button onClick={() => window.open(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/files/${previewFile.id}/download?token=${localStorage.getItem('token')}&inline=true${isConvertible(previewFile) ? '&format=pdf' : ''}`, '_blank')}
                      className="p-2 sm:p-3 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-all active:scale-90" title="Open in New Tab">
                      <ExternalLink className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                  )}
                  <button onClick={() => handleDownload(previewFile)}
                    className="p-2 sm:p-3 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-all active:scale-90" title="Download">
                    <Download className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                  <button onClick={() => setPreviewFile(null)}
                    className="p-2 sm:p-3 bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-400 rounded-xl transition-all active:scale-90">
                    <X className="w-5 h-5 sm:w-6 sm:h-6" />
                  </button>
                </div>
              </div>

              {/* Media Content */}
              <div className="flex-1 relative flex items-center justify-center bg-black/20 overflow-hidden group">
                <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none">
                  <div className="w-64 h-64 bg-purple-500/30 rounded-full blur-[100px]" />
                </div>

                {isImage(previewFile) ? (
                  <img
                    src={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/files/${previewFile.id}/download?token=${localStorage.getItem('token')}&inline=true`}
                    alt={previewFile.name}
                    className="max-h-full max-w-full object-contain shadow-2xl relative z-10" />
                ) : isVideo(previewFile) ? (
                  <video
                    controls
                    autoPlay
                    className="max-h-full w-full relative z-10 shadow-2xl"
                    src={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/files/${previewFile.id}/download?token=${localStorage.getItem('token')}&inline=true`} />
                ) : (previewFile.mimeType === 'application/pdf' || isConvertible(previewFile)) ? (
                  <iframe
                    src={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/files/${previewFile.id}/download?token=${localStorage.getItem('token')}&inline=true${isConvertible(previewFile) ? '&format=pdf' : ''}#toolbar=0`}
                    className="w-full h-full border-none relative z-10 bg-white" />
                ) : (
                  <div className="flex flex-col items-center gap-6 text-gray-500 relative z-10">
                    <div className="w-24 h-24 bg-white/5 rounded-[32px] flex items-center justify-center border border-white/5 shadow-2xl">
                      <FileIcon file={previewFile} />
                    </div>
                    <div className="text-center">
                      <p className="text-white font-medium">No Live Preview</p>
                      <p className="text-xs text-gray-500 mt-1">Download to view this file type</p>
                      <button onClick={() => handleDownload(previewFile)}
                        className="mt-6 px-6 py-2.5 bg-purple-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-purple-500 transition-all shadow-lg shadow-purple-600/20">
                        Download Now
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Move Modal */}
      <MoveFilesModal
        show={showMoveModal}
        onClose={() => { setShowMoveModal(false); setMovingIds([]); }}
        onMove={handleMove}
        currentFolderId={currentFolder.id}
        filesToMove={files.filter(f => movingIds.includes(f.id))}
      />

      {/* Activity Logs Modal */}
      <AnimatePresence>
        {showLogs && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
            onClick={() => setShowLogs(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-card max-w-2xl w-full max-h-[80vh] flex flex-col rounded-3xl overflow-hidden shadow-2xl">
              <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/5">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <MoreVertical className="w-5 h-5 text-purple-400" /> System Activity
                </h3>
                <div className="flex items-center gap-2">
                  {logs.length > 0 && (
                    <button onClick={handleClearLogs}
                      className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl transition-all text-xs font-bold uppercase tracking-widest border border-red-500/20">
                      Clear All
                    </button>
                  )}
                  <button onClick={() => setShowLogs(false)} className="text-gray-400 hover:text-white p-2 hover:bg-white/5 rounded-full transition-all">
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
                {loadingLogs ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-16 bg-white/5 rounded-2xl animate-pulse" />
                  ))
                ) : logs.length === 0 ? (
                  <div className="py-20 text-center text-gray-500 italic">No activities recorded yet</div>
                ) : (
                  logs.map((log, i) => (
                    <div key={log._id} className="relative pl-8 pb-8 last:pb-0 group">
                      {/* Timeline Line */}
                      {i !== logs.length - 1 && (
                        <div className="absolute left-[11px] top-6 bottom-0 w-[2px] bg-white/5 group-hover:bg-purple-500/20 transition-colors" />
                      )}
                      {/* Timeline Dot */}
                      <div className={`absolute left-0 top-1.5 w-6 h-6 rounded-full border-2 border-black flex items-center justify-center z-10 transition-all
                        ${log.action === 'upload' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]' :
                          log.action === 'delete' ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.4)]' :
                            log.action === 'download' ? 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.4)]' :
                              'bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.4)]'}`}>
                        {log.action === 'upload' ? <Upload className="w-3 h-3 text-white" /> :
                          log.action === 'delete' ? <Trash2 className="w-3 h-3 text-white" /> :
                            log.action === 'download' ? <Download className="w-3 h-3 text-white" /> :
                              <Clock className="w-3 h-3 text-white" />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <p className="text-white text-sm font-semibold">
                            <span className="text-purple-400 font-bold">{log.user?.name || 'Someone'}</span>
                            {' '}{log.action === 'upload' ? 'uploaded' :
                              log.action === 'delete' ? 'deleted' :
                                log.action === 'download' ? 'downloaded' :
                                  log.action.replace('_', ' ')}
                          </p>
                          <span className="text-[10px] text-gray-500 whitespace-nowrap">{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <p className="text-gray-400 text-xs leading-relaxed italic">"{log.details}"</p>
                        <p className="text-[10px] text-gray-600 mt-1">{new Date(log.timestamp).toLocaleDateString()}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Trash Modal */}
      <AnimatePresence>
        {showTrash && (
          <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md sm:p-4"
            onClick={() => { setShowTrash(false); setSelectedTrash(new Set()); }}>
            <motion.div
              initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-card w-full sm:max-w-2xl max-h-[90vh] sm:max-h-[80vh] flex flex-col rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl"
            >
              {/* Header — two-row layout on mobile */}
              <div className="px-4 pt-4 pb-3 border-b border-white/10 bg-white/5 space-y-3">
                {/* Row 1: Title + Close */}
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Trash2 className="w-5 h-5 text-red-400 shrink-0" /> Trash Bin
                    {trashFiles.length > 0 && (
                      <span className="text-xs font-normal text-gray-400 bg-white/5 px-2 py-0.5 rounded-full border border-white/10">
                        {trashFiles.length} items
                      </span>
                    )}
                  </h3>
                  <button onClick={() => { setShowTrash(false); setSelectedTrash(new Set()); }}
                    className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-all shrink-0">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Row 2: Action buttons */}
                {trashFiles.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    {selectedTrash.size > 0 ? (
                      <>
                        <button onClick={() => handleRestoreBulk(Array.from(selectedTrash))}
                          className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-xl hover:bg-purple-500/30 active:scale-95 transition-all text-xs font-semibold">
                          <Check className="w-3.5 h-3.5" /> Restore ({selectedTrash.size})
                        </button>
                        <button onClick={() => handleDeletePermanently(Array.from(selectedTrash))}
                          className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl hover:bg-red-500/30 active:scale-95 transition-all text-xs font-semibold">
                          <Trash2 className="w-3.5 h-3.5" /> Delete ({selectedTrash.size})
                        </button>
                        <button onClick={() => setSelectedTrash(new Set())}
                          className="p-2 text-gray-500 hover:text-white hover:bg-white/10 rounded-lg transition-all">
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={handleRestoreAll}
                          className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-500 active:scale-95 transition-all text-xs font-semibold shadow-lg shadow-purple-600/20">
                          <Check className="w-3.5 h-3.5" /> Restore All
                        </button>
                        <button onClick={handleEmptyTrash}
                          className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 bg-red-600 text-white rounded-xl hover:bg-red-500 active:scale-95 transition-all text-xs font-semibold shadow-lg shadow-red-600/20">
                          <Trash2 className="w-3.5 h-3.5" /> Empty Trash
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* File List */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2 no-scrollbar">
                {loadingTrash ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-16 bg-white/5 rounded-2xl animate-pulse" />
                  ))
                ) : trashFiles.length === 0 ? (
                  <div className="py-20 text-center text-gray-500 italic">Trash is empty</div>
                ) : (
                  trashFiles.map((file) => (
                    <div key={file.id}
                      className={`p-3 border rounded-2xl flex items-center gap-3 cursor-pointer transition-all active:scale-[0.98]
                        ${selectedTrash.has(file.id) ? 'border-purple-500/50 bg-purple-500/10' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}
                      onClick={() => {
                        const next = new Set(selectedTrash);
                        if (next.has(file.id)) next.delete(file.id);
                        else next.add(file.id);
                        setSelectedTrash(next);
                      }}>

                      {/* Checkbox */}
                      <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all
                        ${selectedTrash.has(file.id) ? 'bg-purple-500 border-purple-500' : 'border-white/20'}`}>
                        {selectedTrash.has(file.id) && <Check className="w-3 h-3 text-white" />}
                      </div>

                      {/* Icon */}
                      <FileIcon file={{ mimeType: file.mimeType } as any} />

                      {/* Name + Date */}
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{file.name}</p>
                        <p className="text-[10px] text-gray-500">{new Date(file.modifiedTime).toLocaleDateString()}</p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={(e) => { e.stopPropagation(); restoreFile(file.id); }}
                          className="px-3 py-1.5 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-lg hover:bg-purple-500/40 transition-all text-[10px] font-bold active:scale-90">
                          Restore
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handleDeletePermanently([file.id]); }}
                          className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all active:scale-90">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>


      {/* Users Modal */}
      <AnimatePresence>
        {showUsers && (
          <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md sm:p-4"
            onClick={() => setShowUsers(false)}>
            <motion.div
              initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-card w-full sm:max-w-2xl min-h-[60vh] max-h-[92vh] sm:max-h-[80vh] flex flex-col rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl"
            >
              {/* Header */}
              <div className="px-4 pt-4 pb-3 border-b border-white/10 bg-white/5 flex items-center justify-between shrink-0">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-emerald-400 shrink-0" /> Users Management
                  {users.length > 0 && (
                    <span className="text-xs font-normal text-gray-400 bg-white/5 px-2 py-0.5 rounded-full border border-white/10">
                      {users.length}
                    </span>
                  )}
                </h3>
                <button onClick={() => setShowUsers(false)}
                  className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-all shrink-0">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* User List */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2 no-scrollbar">
                {loadingUsers ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-20 bg-white/5 rounded-2xl animate-pulse" />
                  ))
                ) : users.length === 0 ? (
                  <div className="py-20 text-center text-gray-500 italic">No users found</div>
                ) : (
                  users.map((u) => (
                    <div key={u._id} className="p-3 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 transition-all">
                      {/* Row 1: Avatar + Name + Status badge */}
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500/30 to-pink-500/20 flex items-center justify-center text-purple-300 font-bold text-sm uppercase shrink-0 border border-white/10">
                          {u.name[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-white text-sm font-semibold truncate">{u.name}</p>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0
                              ${u.status === 'approved'
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : u.status === 'rejected'
                                  ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                                  : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'}`}>
                              {u.status || 'pending'}
                            </span>
                            <span className="text-[10px] text-purple-400 font-bold uppercase shrink-0">{u.role}</span>
                          </div>
                          <p className="text-[11px] text-gray-500 truncate mt-0.5">{u.email}</p>
                        </div>
                      </div>

                      {/* Row 2: Action buttons — full width, with labels */}
                      <div className="flex items-center gap-2">
                        {u.status !== 'approved' && (
                          <button onClick={() => handleUpdateUserStatus(u._id, 'approved')}
                            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 rounded-xl hover:bg-emerald-500/25 active:scale-95 transition-all text-xs font-semibold">
                            <Check className="w-3.5 h-3.5" /> Approve
                          </button>
                        )}
                        {u.status !== 'rejected' && (
                          <button onClick={() => handleUpdateUserStatus(u._id, 'rejected')}
                            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl hover:bg-red-500/20 active:scale-95 transition-all text-xs font-semibold">
                            <X className="w-3.5 h-3.5" /> Reject
                          </button>
                        )}
                        {u.status !== 'pending' && (
                          <button onClick={() => handleUpdateUserStatus(u._id, 'pending')}
                            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-xl hover:bg-amber-500/20 active:scale-95 transition-all text-xs font-semibold">
                            <Clock className="w-3.5 h-3.5" /> Pending
                          </button>
                        )}
                        <button onClick={() => handleDeleteUser(u._id, u.name)}
                          className="p-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl hover:bg-red-500/25 active:scale-90 transition-all" title="Delete User">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>


      <AnimatePresence>
        {showDownloadModal && downloadingFile && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
            onClick={() => setShowDownloadModal(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-card max-w-sm w-full p-6 rounded-3xl shadow-2xl border border-white/10">
              <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                <Download className="w-5 h-5 text-purple-400" /> Download Options
              </h3>
              <p className="text-sm text-gray-400 mb-6">Choose format for <b>{downloadingFile.name}</b></p>

              <div className="grid gap-3">
                <button onClick={() => handleDownload(downloadingFile, 'pdf')}
                  className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-purple-500/10 hover:border-purple-500/30 transition-all group text-left">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-500/20 rounded-lg text-red-400 group-hover:scale-110 transition-transform">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-white font-medium text-sm">PDF Document</p>
                      <p className="text-[10px] text-gray-500">Best for sharing & printing</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-purple-400 transition-colors" />
                </button>

                <button onClick={() => handleDownload(downloadingFile, downloadingFile.mimeType.startsWith('application/vnd.google-apps.') ? 'docx' : 'original')}
                  className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-blue-500/10 hover:border-blue-500/30 transition-all group text-left">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400 group-hover:scale-110 transition-transform">
                      <File className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-white font-medium text-sm">Word Document (.docx)</p>
                      <p className="text-[10px] text-gray-500">Best for editing</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-blue-400 transition-colors" />
                </button>
              </div>

              <button onClick={() => setShowDownloadModal(false)}
                className="w-full mt-6 py-2 text-sm text-gray-500 hover:text-white transition-colors">
                Cancel
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmModal.show && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="glass-card max-w-sm w-full p-6 rounded-3xl shadow-2xl border border-white/10 text-center">
              <div className={`w-14 h-14 rounded-2xl mx-auto mb-5 flex items-center justify-center ${confirmModal.isDanger ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'}`}>
                {confirmModal.isDanger ? <Trash2 className="w-7 h-7" /> : <Check className="w-7 h-7" />}
              </div>
              <h3 className="text-xl font-bold text-white mb-2 tracking-tight">{confirmModal.title}</h3>
              <p className="text-sm text-gray-400 mb-8 leading-relaxed px-2">{confirmModal.message}</p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmModal(prev => ({ ...prev, show: false }))}
                  disabled={actionLoading}
                  className="flex-1 py-3 rounded-xl bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white transition-all font-medium border border-white/5 disabled:opacity-50">
                  Cancel
                </button>
                <button onClick={async () => {
                  if (actionLoading) return;
                  setActionLoading(true);
                  try {
                    await confirmModal.onConfirm();
                    setConfirmModal(prev => ({ ...prev, show: false }));
                  } catch (e) {
                    console.error(e);
                  } finally {
                    setActionLoading(false);
                  }
                }}
                  disabled={actionLoading}
                  className={`flex-1 py-3 rounded-xl text-white font-bold transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50
                    ${confirmModal.isDanger
                      ? 'bg-red-600 hover:bg-red-500 shadow-lg shadow-red-600/20'
                      : 'bg-purple-600 hover:bg-purple-500 shadow-lg shadow-purple-600/20'}`}>
                  {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {actionLoading ? 'Processing...' : 'Confirm'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>


      {/* Toasts */}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3">
        <AnimatePresence>
          {toasts.map(t => (
            <motion.div key={t.id} initial={{ x: 100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 100, opacity: 0 }}
              className={`px-4 py-3 rounded-2xl shadow-2xl backdrop-blur-md border flex items-center gap-3 min-w-[200px]
                ${t.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
              <div className={`w-2 h-2 rounded-full ${t.type === 'success' ? 'bg-green-400 animate-pulse' : 'bg-red-400 animate-pulse'}`} />
              <span className="text-sm font-medium">{t.msg}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Download Progress Overlay */}
      <AnimatePresence>
        {downloadProgress !== null && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-black/70 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.85, opacity: 0 }}
              className="glass-card p-8 rounded-3xl max-w-xs w-full text-center border border-white/20 shadow-2xl">

              {/* Circular Progress */}
              <div className="relative w-24 h-24 mx-auto mb-6">
                <svg viewBox="0 0 96 96" className="w-full h-full -rotate-90">
                  {/* Track */}
                  <circle cx="48" cy="48" r="40" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
                  {/* Progress Arc */}
                  <motion.circle
                    cx="48" cy="48" r="40"
                    fill="none"
                    stroke="url(#dlGrad)"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={251}
                    animate={downloadProgress === -1
                      ? { strokeDashoffset: [210, 20, 210], rotate: [0, 360] }
                      : { strokeDashoffset: 251 - (251 * downloadProgress) / 100 }
                    }
                    transition={downloadProgress === -1
                      ? { duration: 1.4, repeat: Infinity, ease: "easeInOut" }
                      : { duration: 0.4, ease: "easeOut" }
                    }
                    style={{ originX: '50%', originY: '50%' }}
                  />
                  <defs>
                    <linearGradient id="dlGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#8b5cf6" />
                      <stop offset="100%" stopColor="#ec4899" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <motion.span
                    key={downloadProgress === -1 ? 'fake' : 'real'}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-xl font-bold text-white tabular-nums"
                  >
                    {downloadProgress === -1
                      ? `${Math.round(fakeProgress)}%`
                      : `${downloadProgress}%`
                    }
                  </motion.span>
                </div>
              </div>

              <h3 className="text-lg font-bold text-white mb-1">
                {downloadProgress === -1 ? 'Preparing...' : `Downloading ${downloadProgress}%`}
              </h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                {downloadProgress === -1
                  ? 'Zipping your files, please wait'
                  : 'Downloading your files...'}
              </p>

              {/* Progress bar */}
              <div className="mt-6 h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                {downloadProgress === -1 ? (
                  <motion.div
                    className="h-full bg-gradient-to-r from-purple-600 to-pink-500 rounded-full"
                    animate={{ width: `${Math.round(fakeProgress)}%` }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                  />
                ) : (
                  <motion.div
                    className="h-full bg-gradient-to-r from-purple-600 to-pink-500 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${downloadProgress}%` }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                  />
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function MoveFilesModal({ show, onClose, onMove, currentFolderId, filesToMove }: any) {
  const [folders, setFolders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentPath, setCurrentPath] = useState<any[]>([{ id: ROOT_ID, name: 'Root' }]);

  const loadFolders = async (parentId: string) => {
    setLoading(true);
    try {
      const res = await api.get(`/files?parentId=${parentId}`);
      setFolders(res.data.filter((f: any) => f.mimeType === 'application/vnd.google-apps.folder' && !filesToMove.some((m: any) => m.id === f.id)));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (show) loadFolders(currentPath[currentPath.length - 1].id); }, [show, currentPath]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="glass-card max-w-md w-full p-6 rounded-2xl flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold text-lg">Move to...</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex items-center gap-1 mb-4 overflow-x-auto pb-2 no-scrollbar">
          {currentPath.map((p, i) => (
            <button key={i} onClick={() => setCurrentPath(currentPath.slice(0, i + 1))}
              className="text-xs text-gray-400 hover:text-white whitespace-nowrap">
              {i > 0 && ' / '} {p.name}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto space-y-1 mb-6 pr-2 custom-scrollbar">
          {loading ? (
            <div className="py-8 text-center text-gray-500">Loading...</div>
          ) : (
            <>
              {currentPath.length > 1 && (
                <button onClick={() => setCurrentPath(currentPath.slice(0, -1))}
                  className="flex items-center gap-3 w-full px-3 py-2 text-sm text-purple-400 hover:bg-purple-500/10 rounded-xl transition-colors text-left border border-dashed border-purple-500/20 mb-2">
                  <ChevronRight className="w-4 h-4 rotate-180" />
                  <span>Go back to parent</span>
                </button>
              )}
              {folders.length === 0 ? (
                <div className="py-8 text-center text-gray-500">No sub-folders here</div>
              ) : (
                folders.map(f => (
                  <button key={f.id} onClick={() => setCurrentPath([...currentPath, { id: f.id, name: f.name }])}
                    className="flex items-center gap-3 w-full px-3 py-2 text-sm text-gray-300 hover:bg-white/5 rounded-xl transition-colors text-left group">
                    <Folder className="w-4 h-4 text-yellow-400" />
                    <span className="flex-1 truncate">{f.name}</span>
                    <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-gray-400" />
                  </button>
                ))
              )}
            </>
          )}
        </div>

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors text-sm">Cancel</button>
          <button onClick={() => onMove(currentPath[currentPath.length - 1].id)}
            disabled={currentPath[currentPath.length - 1].id === currentFolderId}
            className="px-6 py-2 rounded-xl bg-[var(--color-primary)] text-white hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm shadow-lg shadow-purple-500/20">
            Move Here
          </button>
        </div>
      </motion.div>
    </div>
  );
}
