'use client';

import { useEffect, useRef, useState, useMemo, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Folder, File, Files, Upload, FolderPlus, FilePlus, Download, Pencil,
  Trash2, Move, X, ChevronRight, Home, Image, FileText, Film,
  MoreVertical, Check, Users, Clock, Square, CheckSquare, Search, ExternalLink,
  Music, Archive, FileSpreadsheet, Monitor, Package, Smartphone, Minus, Maximize2, Loader2, Plus, RefreshCw,
  CheckCircle, AlertCircle, AlertTriangle, Info, Eye, EyeOff
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import { useAndroidBack } from '@/hooks/useAndroidBack';


interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime: string;
  webViewLink?: string;
  isHidden?: boolean;
}

const ROOT_ID = 'ROOT';

interface UploadItem {
  id?: string;
  name: string;
  size: number;
  status: 'pending' | 'uploading' | 'done' | 'error';
  progress: number;
  error?: string;
  isFolder?: boolean;
  uploadedBytes?: number;
}

const isFolder = (f: DriveFile) => f.mimeType === 'application/vnd.google-apps.folder';
const isImage = (f: DriveFile) => f.mimeType.startsWith('image/');
const isVideo = (f: DriveFile) => f.mimeType.startsWith('video/');
const isConvertible = (f: DriveFile) => {
  const mime = f.mimeType;
  if (mime === 'application/vnd.google-apps.folder') return false;
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

function AdminFilesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
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
  const [uploadQueue, setUploadQueue] = useState<UploadItem[]>([]);

  const updateQueue = (newQueue: UploadItem[]) => {
    uploadQueueRef.current = newQueue;
    setUploadQueue(newQueue);
  };
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
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: 'success' | 'error' | 'info' | 'warning' }[]>([]);
  const [isUploadMinimized, setIsUploadMinimized] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [duplicates, setDuplicates] = useState<any[]>([]);
  const [loadingDuplicates, setLoadingDuplicates] = useState(false);
  const [showZipModal, setShowZipModal] = useState(false);
  const [zipFileName, setZipFileName] = useState('DriveFlow_Export');
  const isCancelledBatch = useRef(false);
  const downloadAbortController = useRef<AbortController | null>(null);
  const uploadQueueRef = useRef<UploadItem[]>([]);

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

  // ── Sync Path with URL on Load ──────────────────────────────────
  useEffect(() => {
    const folderId = searchParams.get('folder');
    if (folderId && folderId !== ROOT_ID && path.length === 1) {
      // If we land on a subfolder directly, try to resolve its name or just show 'Folder'
      api.get(`/files/${folderId}/metadata`).then(res => {
        setPath([{ id: ROOT_ID, name: 'Root' }, { id: folderId, name: res.data.name }]);
      }).catch(() => {
        setPath([{ id: ROOT_ID, name: 'Root' }, { id: folderId, name: 'Folder' }]);
      });
    }
  }, []);

  // ── Popstate navigation handling ──────────────────────────────────
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const state = event.state;
      const modalOpen = previewFile || renaming || showLogs || showTrash || showUsers || showMoveModal || showDownloadModal || showNewFolderModal || confirmModal.show;
      
      if (modalOpen) {
        setPreviewFile(null); setRenaming(null); setShowLogs(false); setShowTrash(false); setShowUsers(false); setShowMoveModal(false); setShowDownloadModal(false); setShowNewFolderModal(false); setConfirmModal(c => ({ ...c, show: false }));
        return;
      }

      if (state?.path) {
        setPath(state.path);
        loadFiles(state.path[state.path.length - 1].id);
      } else if (path.length > 1) {
        const newPath = path.slice(0, -1);
        setPath(newPath);
        loadFiles(newPath[newPath.length - 1].id);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [path, previewFile, renaming, showLogs, showTrash, showUsers, showMoveModal, showDownloadModal, showNewFolderModal, confirmModal.show]);

  const navigateToFolder = (folder: { id: string, name: string }) => {
    const newPath = [...path, folder];
    setPath(newPath);
    window.history.pushState({ path: newPath }, '', `?folder=${folder.id}`);
    loadFiles(folder.id);
  };
  // ──────────────────────────────────────────────────────────────────

  const filteredFiles = useMemo(() => {
    const matchesCategory = (f: DriveFile) => {
      if (activeCategory === 'all') return true;
      if (activeCategory === 'folders') return isFolder(f);
      if (activeCategory === 'images') return isImage(f);
      if (activeCategory === 'docs') return isDoc(f);
      if (activeCategory === 'videos') return isVideo(f);
      return true;
    };

    return files.filter(matchesCategory).sort((a, b) => {
      // 1. Folders first
      const aIsFolder = isFolder(a);
      const bIsFolder = isFolder(b);
      if (aIsFolder && !bIsFolder) return -1;
      if (!aIsFolder && bIsFolder) return 1;

      // 2. Natural sorting for names (handles numbers like 1, 2, 10 correctly)
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [files, activeCategory]);

  const [refreshingStats, setRefreshingStats] = useState(false);

  const addToast = (msg: string, type: 'success' | 'error' | 'info' | 'warning' = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  const fetchStats = async (cleanup = false) => {
    try {
      if (cleanup) setRefreshingStats(true);
      const res = await api.get(`/files/admin-stats?parentId=${currentFolder.id}${cleanup ? '&cleanup=true' : ''}`);
      setStats(res.data);
      if (cleanup) addToast('Statistics cleaned and re-synced', 'success');
    } catch (e) { 
      console.error(e); 
      if (cleanup) addToast('Refresh failed', 'error');
    } finally {
      setRefreshingStats(false);
    }
  };

  const cancelUpload = () => {
    isCancelledBatch.current = true;
    if (uploadXhrRef.current) {
      uploadXhrRef.current.abort();
    }
    setUploading(false);
    addToast('Upload batch cancelled', 'error');
  };

  const cancelSingleUpload = (index: number) => {
    const next = [...uploadQueueRef.current];
    if (next[index] && next[index].status !== 'done') {
      next[index] = { ...next[index], status: 'error', error: 'Cancelled' };
      updateQueue(next);
    }
    // If it's the currently uploading file, abort it
    const current = uploadQueueRef.current.find(q => q.status === 'uploading');
    if (current && uploadQueueRef.current.indexOf(current) === index && uploadXhrRef.current) {
      uploadXhrRef.current.abort();
    }
  };

  const cancelActiveDownload = () => {
    if (downloadAbortController.current) {
      downloadAbortController.current.abort();
      downloadAbortController.current = null;
    }
    setDownloadProgress(null);
    addToast('Download cancelled', 'error');
  };

  useEffect(() => {
    fetchStats();
  }, [currentFolder.id]);

  const handleItemClick = (file: DriveFile) => {
    if (selected.size > 0) {
      toggleSelect(file.id);
    } else if (isFolder(file)) {
      navigateToFolder({ id: file.id, name: file.name });
    } else {
      setPreviewFile(file);
      window.history.pushState({ modal: 'preview' }, '');
    }
  };

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
          loadFiles(currentFolder.id);
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
          loadFiles(currentFolder.id);
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
      setUsers(res.data.filter((u: any) => u.name !== 'Default Admin'));
      setShowUsers(true);
    } catch (e) { console.error(e); }
    finally { setLoadingUsers(false); }
  };

  const fetchDuplicates = async () => {
    setLoadingDuplicates(true);
    try {
      const res = await api.get('/files/admin-duplicates');
      setDuplicates(res.data);
      setShowDuplicates(true);
    } catch (e) { 
      console.error(e); 
      addToast('Error fetching duplicates', 'error');
    } finally { 
      setLoadingDuplicates(false); 
    }
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
      fetchStats();
      loadFiles(currentFolder.id);
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
          try {
            const res = JSON.parse(uploadReq.responseText);
            if (res.id) resolve(res);
            else reject(new Error('Google did not return a File ID'));
          } catch (e) {
            reject(new Error('Invalid response from Google'));
          }
        } else {
          reject(new Error(`Upload failed: ${uploadReq.status} ${uploadReq.statusText}`));
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

    // Group files by top-level folder or individual file name
    const groups: Record<string, { 
      name: string; 
      totalSize: number; 
      fileIndices: number[];
      isFolder: boolean;
      uploadedBytes: number[];
    }> = {};

    files.forEach((f, idx) => {
      const rel = (f as any).webkitRelativePath || '';
      const topName = rel ? rel.split('/')[0] : f.name;
      const isF = !!rel;
      
      if (!groups[topName]) {
        groups[topName] = { 
          name: topName, 
          totalSize: 0, 
          fileIndices: [], 
          isFolder: isF, 
          uploadedBytes: new Array(files.length).fill(0) 
        };
      }
      groups[topName].totalSize += f.size;
      groups[topName].fileIndices.push(idx);
    });

    const displayQueue: UploadItem[] = Object.keys(groups).map(key => ({
      id: key,
      name: groups[key].name,
      size: groups[key].totalSize,
      status: 'pending' as const,
      progress: 0,
      isFolder: groups[key].isFolder,
      uploadedBytes: 0
    }));

    updateQueue(displayQueue);
    setShowUploadModal(true);
    setUploading(true);
    setShowUploadMenu(false);
    isCancelledBatch.current = false;

    const folderCache: Record<string, string> = {};
    const getOrCreateFolder = async (name: string, parentId: string): Promise<string> => {
      const cacheKey = `${parentId}::${name}`;
      if (folderCache[cacheKey]) return folderCache[cacheKey];
      try {
        const created = await api.post('/files/folder', { name, parentId });
        folderCache[cacheKey] = created.data.id;
        return created.data.id;
      } catch (err: any) {
        try {
          const res = await api.get(`/files?parentId=${parentId}`);
          const existing = (res.data as any[]).find(f => f.mimeType === 'application/vnd.google-apps.folder' && f.name === name);
          if (existing) {
            folderCache[cacheKey] = existing.id;
            return existing.id;
          }
        } catch {}
        throw new Error(`Folder Error: ${err.response?.data?.message || err.message}`);
      }
    };

    const fileProgressMap = new Array(files.length).fill(0);

    for (let i = 0; i < files.length; i++) {
      if (isCancelledBatch.current) break;
      
      const file = files[i];
      const rel = (file as any).webkitRelativePath || '';
      const topName = rel ? rel.split('/')[0] : file.name;
      const groupIdx = Object.keys(groups).indexOf(topName);
      
      // Check if this group was cancelled
      if (uploadQueueRef.current[groupIdx]?.status === 'error') {
        fileProgressMap[i] = file.size; // Mark as "processed"
        continue;
      }

      updateQueue(uploadQueueRef.current.map((q, idx) => idx === groupIdx ? { ...q, status: 'uploading' } : q));

      const pathParts = rel ? rel.split('/').slice(0, -1) : [];

      try {
        let parentId = currentFolder.id;
        for (const part of pathParts) {
          if (isCancelledBatch.current) throw new Error('Cancelled');
          parentId = await getOrCreateFolder(part, parentId);
        }

        const sessionRes = await api.post('/files/upload-session', {
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          parentId,
          size: file.size
        });
        const { uploadUrl } = sessionRes.data;

        const fileId = await new Promise<string>(async (resolve, reject) => {
          const CHUNK_SIZE = 2 * 1024 * 1024; // 2MB to stay safely under Vercel's 4.5MB limit
          const totalSize = file.size;
          let start = 0;
          let lastId = '';

          const uploadChunk = async (): Promise<void> => {
            if (isCancelledBatch.current) throw new Error('Cancelled');
            
            const end = Math.min(start + CHUNK_SIZE, totalSize);
            const chunk = file.slice(start, end);

            // TRY DIRECT FIRST
            try {
              await new Promise<void>((resChunk, rejChunk) => {
                const xhr = new XMLHttpRequest();
                xhr.open('PUT', uploadUrl, true);
                xhr.withCredentials = false;
                xhr.timeout = 5000; // 5s timeout for direct, then switch to proxy
                xhr.setRequestHeader('Content-Range', `bytes ${start}-${end - 1}/${totalSize}`);
                xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
                
                xhr.onload = () => {
                  if (xhr.status === 308 || xhr.status === 200 || xhr.status === 201) {
                    try {
                      const resp = JSON.parse(xhr.responseText);
                      if (resp.id) lastId = resp.id;
                    } catch {}
                    resChunk();
                  } else {
                    rejChunk(new Error(`HTTP ${xhr.status}`));
                  }
                };
                xhr.onerror = () => rejChunk(new Error('Direct Blocked'));
                xhr.ontimeout = () => rejChunk(new Error('Direct Timeout'));
                xhr.send(chunk);
              });
            } catch (directErr) {
              console.warn('Direct chunk upload failed, falling back to proxy...', directErr);
              
              // FALLBACK TO PROXY
              await api.put(`/files/upload-proxy?url=${encodeURIComponent(uploadUrl)}`, chunk, {
                headers: {
                  'Content-Range': `bytes ${start}-${end - 1}/${totalSize}`,
                  'Content-Type': file.type || 'application/octet-stream'
                }
              }).then(res => {
                try {
                  if (res.data?.id) lastId = res.data.id;
                } catch {}
              }).catch(proxyErr => {
                throw new Error('Both direct and proxy upload failed. Please check your firewall.');
              });
            }
          };

          try {
            while (start < totalSize) {
              let attempts = 0;
              const maxRetries = 3;
              let success = false;

              while (attempts < maxRetries && !success) {
                try {
                  await uploadChunk();
                  success = true;
                } catch (e) {
                  attempts++;
                  if (attempts >= maxRetries) throw e;
                  await new Promise(r => setTimeout(r, 1000 * attempts)); // Backoff
                }
              }

              start = Math.min(start + CHUNK_SIZE, totalSize);
              // Update Progress
              fileProgressMap[i] = start;
              const group = groups[topName];
              const groupUploaded = group.fileIndices.reduce((acc, idx) => acc + (fileProgressMap[idx] || 0), 0);
              const pct = Math.round((groupUploaded * 100) / group.totalSize);
              updateQueue(uploadQueueRef.current.map((q, idx) => idx === groupIdx ? { ...q, progress: pct, status: 'uploading' } : q));
            }
            resolve(lastId || 'UPLOADED_' + Date.now());
          } catch (err: any) {
            console.error('Chunked Upload Failed:', err);
            reject(new Error(err.message || 'Upload failed after retries.'));
          }
        });

        await api.post('/files/upload-complete', {
          fileId,
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          size: file.size,
          parentId
        });

        fileProgressMap[i] = file.size;
        const group = groups[topName];
        const groupUploaded = group.fileIndices.reduce((acc, idx) => acc + (fileProgressMap[idx] || 0), 0);
        const isDone = group.fileIndices.every(idx => fileProgressMap[idx] >= files[idx].size);
        
        updateQueue(uploadQueueRef.current.map((q, idx) => idx === groupIdx ? { 
          ...q, 
          progress: Math.round((groupUploaded * 100) / group.totalSize),
          status: isDone ? 'done' : 'uploading'
        } : q));

      } catch (err: any) {
        if (err.message === 'Cancelled' || isCancelledBatch.current) {
          updateQueue(uploadQueueRef.current.map((q, idx) => idx === groupIdx ? { ...q, status: 'error', error: 'Cancelled' } : q));
          break; // Stop other files in batch if it's a batch cancel
        } else {
          updateQueue(uploadQueueRef.current.map((q, idx) => idx === groupIdx ? { ...q, status: 'error', error: err.message } : q));
        }
      }
    }

    await loadFiles(currentFolder.id);
    fetchStats();
    setUploading(false);
    try { targetInput.value = ''; } catch (e) {}
    setTimeout(() => { 
      setShowUploadModal(false); 
      updateQueue([]); 
    }, 2000);
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
    
    // Open a blank window immediately to bypass popup blockers
    const newWindow = window.open('about:blank', '_blank');
    
    try {
      const res = await api.post('/files/doc', { name: 'Untitled Document', parentId: currentFolder.id });
      if (newWindow && res.data.webViewLink) {
        newWindow.location.href = res.data.webViewLink;
      } else if (newWindow) {
        newWindow.close();
        addToast('No edit link returned', 'error');
      }
      await loadFiles(currentFolder.id);
      fetchStats();
    } catch (e) { 
      console.error(e);
      if (newWindow) newWindow.close();
      addToast('Error creating document', 'error');
    }
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
      loadFiles(currentFolder.id);
      fetchStats();
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
      loadFiles(currentFolder.id);
    } catch (e) { addToast('Delete failed', 'error'); }
    finally { setDeletingIds(prev => prev.filter(id => !ids.includes(id))); }
  };

  const handleToggleHide = async (file: DriveFile) => {
    const newHidden = !file.isHidden;
    try {
      await api.put(`/files/${file.id}/hide`, { hide: newHidden });
      setFiles(prev => prev.map(f => f.id === file.id ? { ...f, isHidden: newHidden } : f));
      addToast(newHidden ? `"${file.name}" hidden from users` : `"${file.name}" visible to users`);
    } catch (e) {
      addToast('Failed to update visibility', 'error');
    }
  };

  // Universal download trigger - works on both web and Android
  const triggerDownload = (url: string) => {
    // On Capacitor native (Android), _system opens system browser which handles downloads
    const isNative = !!(window as any).Capacitor?.isNativePlatform?.();
    const a = document.createElement('a');
    a.href = url;
    a.target = isNative ? '_system' : '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => document.body.removeChild(a), 500);
  };

  const handleBulkDownload = async (customName?: string) => {
    if (selected.size === 0) return;
    
    // If only one item is selected and no custom name yet, use the item's name directly
    if (selected.size === 1 && !customName) {
      const item = filteredFiles.find(f => selected.has(f.id));
      if (item) {
        handleBulkDownload(item.name);
        return;
      }
    }

    // If no name provided for multiple items, show our beautiful modal
    if (!customName) {
      setZipFileName(`DriveFlow_Export_${new Date().toLocaleDateString().replace(/\//g, '-')}`);
      setShowZipModal(true);
      return;
    }

    setShowZipModal(false);
    addToast('Preparing ZIP download...');
    setDownloadProgress(-1);

    try {
      const token = localStorage.getItem('token_admin') || localStorage.getItem('token') || '';
      const ids = Array.from(selected).join(',');
      const name = encodeURIComponent((customName || 'DriveFlow_Export') + '.zip');
      const url = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/files/bulk-download?fileIds=${ids}&token=${token}&fileName=${name}`;
      
      const isNative = !!(window as any).Capacitor?.isNativePlatform?.();
      if (isNative) {
        triggerDownload(url);
        setTimeout(() => setDownloadProgress(null), 3000);
      } else {
        const response = await api.get(`/files/bulk-download?fileIds=${ids}`, {
          responseType: 'blob',
          onDownloadProgress: (pe) => {
            if (pe.total) setDownloadProgress(Math.round((pe.loaded * 100) / pe.total));
            else setDownloadProgress(-1);
          }
        });
        const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = blobUrl;
        link.setAttribute('download', (customName || 'DriveFlow_Export') + '.zip');
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(blobUrl);
        setDownloadProgress(null);
      }
      setSelected(new Set());
    } catch (e: any) {
      addToast('Bulk download failed', 'error');
      setDownloadProgress(null);
    }
  };

  const handleDownload = async (file: DriveFile, format?: string) => {
    if (isConvertible(file) && !format && !isFolder(file)) {
      setDownloadingFile(file);
      setShowDownloadModal(true);
      return;
    }
    if (format) {
      const token = localStorage.getItem('token_admin') || localStorage.getItem('token') || '';
      const url = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/files/${file.id}/download?token=${token}&format=${format}`;
      triggerDownload(url);
      setShowDownloadModal(false);
      return;
    }

    if (isFolder(file)) {
      addToast('Preparing folder ZIP...');
      setDownloadProgress(-1);
      const token = localStorage.getItem('token_admin') || localStorage.getItem('token') || '';
      const name = encodeURIComponent(file.name + '.zip');
      const url = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/files/bulk-download?fileIds=${file.id}&token=${token}&fileName=${name}`;
      
      const isNative = !!(window as any).Capacitor?.isNativePlatform?.();
      if (isNative) {
        triggerDownload(url);
        setTimeout(() => setDownloadProgress(null), 3000);
      } else {
        try {
          const response = await api.get(`/files/bulk-download?fileIds=${file.id}`, {
            responseType: 'blob',
            onDownloadProgress: (pe) => {
              if (pe.total) setDownloadProgress(Math.round((pe.loaded * 100) / pe.total));
              else setDownloadProgress(-1);
            }
          });
          const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
          const link = document.createElement('a');
          link.href = blobUrl;
          link.setAttribute('download', file.name + '.zip');
          document.body.appendChild(link);
          link.click();
          link.remove();
          window.URL.revokeObjectURL(blobUrl);
          setDownloadProgress(null);
        } catch (e) {
          addToast('Folder download failed', 'error');
          setDownloadProgress(null);
        }
      }
      return;
    }

    // Single file: use direct download for mobile, or axios for web
    addToast('Starting download...');
    setDownloadProgress(-1);
    try {
      const token = localStorage.getItem('token_admin') || localStorage.getItem('token') || '';
      const url = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/files/${file.id}/download?token=${token}`;
      
      const isNative = !!(window as any).Capacitor?.isNativePlatform?.();
      if (isNative) {
        triggerDownload(url);
        setTimeout(() => setDownloadProgress(null), 2000);
      } else {
        const response = await api.get(`/files/${file.id}/download`, {
          responseType: 'blob',
          onDownloadProgress: (pe) => {
            if (pe.total) setDownloadProgress(Math.round((pe.loaded * 100) / pe.total));
          }
        });
        const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = blobUrl;
        link.setAttribute('download', file.name);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(blobUrl);
        setDownloadProgress(null);
      }
    } catch (e) {
      addToast('Download failed', 'error');
      setDownloadProgress(null);
    }
    setShowDownloadModal(false);
  };

  const breadcrumbNav = (idx: number) => {
    const newPath = path.slice(0, idx + 1);
    setPath(newPath);
    loadFiles(newPath[newPath.length - 1].id);
    window.history.pushState({ path: newPath }, '', `?folder=${newPath[newPath.length - 1].id}`);
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  // Android back gesture — priority 10 (modals first, then folder nav, then let layout handle)
  useAndroidBack(() => {
    if (selected.size > 0)           { setSelected(new Set()); return true; }
    if (confirmModal.show)           { setConfirmModal(prev => ({ ...prev, show: false })); return true; }
    if (previewFile)                 { setPreviewFile(null); return true; }
    if (renaming)                    { setRenaming(null); return true; }
    if (showDownloadModal)           { setShowDownloadModal(false); return true; }
    if (showZipModal)                { setShowZipModal(false); return true; }
    if (showNewFolderModal)          { setShowNewFolderModal(false); return true; }
    if (showMoveModal)               { setShowMoveModal(false); return true; }
    if (showLogs)                    { setShowLogs(false); return true; }
    if (showTrash)                   { setShowTrash(false); return true; }
    if (showUsers)                   { setShowUsers(false); return true; }
    if (showDuplicates)              { setShowDuplicates(false); return true; }
    if (path.length > 1) {
      breadcrumbNav(path.length - 2);
      return true;
    }
    return false; // let layout handle (go to dashboard or exit)
  }, 10, [selected, confirmModal.show, previewFile, renaming, showDownloadModal, showZipModal,
      showNewFolderModal, showMoveModal, showLogs, showTrash, showUsers, showDuplicates, path]);

  return (

    <motion.div
      className="space-y-4"
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
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
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
              <button onClick={() => fetchStats(true)} disabled={refreshingStats}
                className={`p-1.5 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all ${refreshingStats ? 'opacity-50' : ''}`}
                title="Deep Refresh Stats">
                <RefreshCw className={`w-3 h-3 text-purple-400 ${refreshingStats ? 'animate-spin' : ''}`} />
              </button>
              {stats && (
                <span className="text-[10px] font-normal bg-white/5 border border-white/10 px-2 py-0.5 rounded-full text-gray-400">
                  {stats.totalFiles} Files • {stats.totalFolders} Folders
                </span>
              )}
            </h2>
            <div className="flex items-center gap-1 mt-1 overflow-x-auto no-scrollbar max-w-[70vw] sm:max-w-sm">
              {path.map((p, i) => (
                <span key={i} className="flex items-center gap-1 shrink-0">
                  {i > 0 && <ChevronRight className="w-3 h-3 text-gray-500 shrink-0" />}
                  <button
                    onClick={() => breadcrumbNav(i)}
                    className={`text-sm transition-colors whitespace-nowrap ${i === path.length - 1 ? 'text-white font-medium' : 'text-gray-400 hover:text-white'}`}
                  >
                    {i === 0 ? <Home className="w-4 h-4" /> : p.name}
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>

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
            className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all outline-none"
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar w-full md:w-auto pb-1">
          {selected.size > 0 ? (
            <div className="flex items-center gap-2 bg-purple-500/10 p-1 rounded-2xl border border-purple-500/20 shrink-0">
              <span className="text-xs text-purple-400 px-3 font-bold whitespace-nowrap">{selected.size} selected</span>
              <button onClick={() => handleBulkDownload()}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all text-xs font-bold whitespace-nowrap">
                <Download className="w-3.5 h-3.5" /> Download
              </button>
              <button onClick={() => { setMovingIds(Array.from(selected)); setShowMoveModal(true); }}
                className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl transition-all text-xs font-bold whitespace-nowrap">
                <Move className="w-3.5 h-3.5" /> Move
              </button>
              <button onClick={() => handleDelete(Array.from(selected))}
                className="flex items-center gap-2 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-xl transition-all text-xs font-bold whitespace-nowrap border border-red-500/10">
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
              <button onClick={() => setSelected(new Set())}
                className="p-2 text-gray-500 hover:text-white transition-colors" title="Clear selection">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            [
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
            ))
          )}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-end gap-3 mb-4">
        <div className="flex flex-nowrap items-center gap-3 shrink-0 ml-auto w-full overflow-x-auto no-scrollbar justify-start sm:justify-end py-1">
          {/* View Toggle */}
          <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 shrink-0">
            <button onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition-all duration-200 ${viewMode === 'list' ? 'bg-purple-600 text-white' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}>
              <MoreVertical className="w-4 h-4 rotate-90" />
            </button>
            <button onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-all duration-200 ${viewMode === 'grid' ? 'bg-purple-600 text-white' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}>
              <Square className="w-4 h-4" />
            </button>
          </div>

          <div className="h-6 w-[1px] bg-white/10 mx-1 shrink-0" />

          {/* Activity / Trash / Users */}
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={fetchLogs}
              className="flex items-center gap-2 px-3 py-2 sm:px-4 bg-white/5 border border-white/10 text-gray-300 rounded-xl hover:bg-white/10 hover:text-white transition-all text-sm font-medium shrink-0"
              title="Activity">
              <Clock className="w-4 h-4 text-purple-400" /> <span className="whitespace-nowrap">Activity</span>
            </button>

            <button onClick={fetchTrash}
              className="flex items-center gap-2 px-3 py-2 sm:px-4 bg-white/5 border border-white/10 text-gray-300 rounded-xl hover:bg-white/10 hover:text-white transition-all text-sm font-medium shrink-0"
              title="Trash">
              <Trash2 className="w-4 h-4 text-red-400" /> <span className="whitespace-nowrap">Trash</span>
            </button>

            <button onClick={fetchUsers}
              className="flex items-center gap-2 px-3 py-2 sm:px-4 bg-white/5 border border-white/10 text-gray-300 rounded-xl hover:bg-white/10 hover:text-white transition-all text-sm font-medium shrink-0"
              title="Users">
              <Users className="w-4 h-4 text-emerald-400" /> <span className="whitespace-nowrap">Users</span>
            </button>

            <button onClick={fetchDuplicates}
              className="flex items-center gap-2 px-3 py-2 sm:px-4 bg-white/5 border border-white/10 text-gray-300 rounded-xl hover:bg-white/10 hover:text-white transition-all text-sm font-medium shrink-0"
              title="Duplicates">
              <Files className="w-4 h-4 text-blue-400" /> <span className="whitespace-nowrap">Duplicates</span>
            </button>
          </div>
        </div>

        {/* New / Upload Group - Moved outside overflow container to prevent clipping */}
        <div className="flex items-center gap-2 shrink-0 relative z-[20]">
          <div className="relative">
            <button onClick={() => { setShowNewMenu(!showNewMenu); setShowUploadMenu(false); }}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 text-white rounded-xl hover:bg-white/10 transition-all text-sm font-medium">
              <Plus className="w-4 h-4 text-purple-400" /> New
            </button>
            <AnimatePresence>
              {showNewMenu && (
                <>
                  <div className="fixed inset-0 z-[40] cursor-default" onClick={() => setShowNewMenu(false)} />
                  <motion.div initial={{ opacity: 0, scale: 0.95, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 8 }}
                    className="absolute left-0 top-full mt-2 glass-card border border-white/10 rounded-2xl p-1.5 z-[50] min-w-[180px] shadow-2xl">
                    <button onClick={() => { setShowNewFolderModal(true); setShowNewMenu(false); }}
                      className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-gray-200 hover:bg-white/10 rounded-xl transition-colors">
                      <FolderPlus className="w-4 h-4 text-yellow-400" /> New Folder
                    </button>
                    <button onClick={() => { handleCreateDoc(); setShowNewMenu(false); }}
                      className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-gray-200 hover:bg-white/10 rounded-xl transition-colors">
                      <FileText className="w-4 h-4 text-blue-400" /> New Document
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          {/* Upload Menu */}
          <div className="relative">
            <button onClick={() => { setShowUploadMenu(!showUploadMenu); setShowNewMenu(false); }}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl text-sm font-bold hover:from-purple-500 hover:to-indigo-500 transition-all active:scale-95 border border-white/10">
              <Upload className="w-4 h-4" /> Upload
            </button>
            <AnimatePresence>
              {showUploadMenu && (
                <>
                  <div className="fixed inset-0 z-[40] cursor-default" onClick={() => setShowUploadMenu(false)} />
                  <motion.div initial={{ opacity: 0, scale: 0.95, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 8 }}
                    className="absolute right-0 top-full mt-2 glass-card border border-white/10 rounded-2xl p-1.5 z-[50] min-w-[200px] shadow-2xl">
                    <button onClick={() => { fileInput.current?.click(); setShowUploadMenu(false); }}
                      className="flex items-center gap-3 w-full px-4 py-3 text-sm text-gray-200 hover:bg-white/10 rounded-xl transition-colors">
                      <Files className="w-4 h-4 text-purple-400" /> Upload Files
                    </button>
                    <button onClick={() => { folderInput.current?.click(); setShowUploadMenu(false); }}
                      className="flex items-center gap-3 w-full px-4 py-3 text-sm text-gray-200 hover:bg-white/10 rounded-xl transition-colors">
                      <Folder className="w-4 h-4 text-yellow-400" /> Upload Folder
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
            <input ref={fileInput} type="file" multiple className="hidden" onChange={handleUpload} />
            <input ref={folderInput} type="file" multiple className="hidden" onChange={handleUpload} {...({ webkitdirectory: '', directory: '' } as any)} />
          </div>
        </div>
      </div>

      {/* File List */}
      <motion.div className="glass-card rounded-2xl overflow-hidden min-h-[400px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        key={currentFolder.id}
      >
        {viewMode === 'list' ? (
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
                  <motion.tr key={file.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.01 }}
                    className={`border-b border-white/5 hover:bg-white/5 transition-colors group ${
                      file.isHidden ? 'opacity-50 bg-amber-500/5 border-amber-500/10' : selected.has(file.id) ? 'bg-purple-500/10' : ''
                    }`}>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => toggleSelect(file.id)}>
                        {selected.has(file.id) ? <CheckSquare className="w-4 h-4 text-purple-400" /> : <Square className="w-4 h-4 text-gray-500 hover:text-gray-300" />}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleItemClick(file)}
                        className="flex items-center gap-3 text-white hover:text-purple-300 transition-colors w-full text-left">
                        <FileIcon file={file} />
                        <span className="text-sm font-medium break-words">{file.name}</span>
                        {file.isHidden && <span title="Hidden from users"><EyeOff className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" /></span>}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-sm">{fmt(file.size, isFolder(file))}</td>
                    <td className="px-4 py-3 text-gray-400 text-sm whitespace-nowrap">{new Date(file.modifiedTime).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 transition-opacity">
                        <button onClick={(e) => { e.stopPropagation(); handleDownload(file); }} title="Download"
                          className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
                          <Download className="w-4 h-4" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); setRenaming(file); setNewName(file.name); }} title="Rename"
                          className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); setMovingIds([file.id]); setShowMoveModal(true); }} title="Move"
                          className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
                          <Move className="w-4 h-4" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handleToggleHide(file); }} title={file.isHidden ? 'Unhide (show to users)' : 'Hide from users'}
                          className={`p-1.5 rounded-lg transition-colors ${file.isHidden ? 'text-amber-400 hover:bg-amber-500/20 hover:text-amber-300' : 'text-gray-400 hover:bg-amber-500/10 hover:text-amber-400'}`}>
                          {file.isHidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
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
                  ${file.isHidden ? 'opacity-50 border-amber-500/30 bg-amber-500/5' : selected.has(file.id)
                    ? 'bg-purple-500/10 border-purple-500/40'
                    : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/20'}`}
                onClick={() => handleItemClick(file)}
                onTouchStart={() => handleItemTouchStart(file.id)}
                onTouchEnd={handleItemTouchEnd}
                onContextMenu={(e) => { e.preventDefault(); toggleSelect(file.id); }}
              >
                {/* Hidden Badge for admin */}
                {file.isHidden && (
                  <div className="absolute top-2 right-2 z-10 bg-amber-500/20 border border-amber-500/40 rounded-lg p-1" title="Hidden from users">
                    <EyeOff className="w-3 h-3 text-amber-400" />
                  </div>
                )}
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
                  <p className="text-white text-xs font-medium break-words mb-1">{file.name}</p>
                  <p className="text-gray-500 text-[10px]">{fmt(file.size, isFolder(file))}</p>
                </div>
                {/* Grid Hover Actions */}
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm opacity-0 group-hover:opacity-100 rounded-3xl flex items-center justify-center gap-2 transition-all">
                  <button onClick={e => { e.stopPropagation(); handleDownload(file); }} className="p-2 bg-white/10 rounded-lg hover:bg-white/20 text-white" title="Download"><Download className="w-4 h-4" /></button>
                  <button onClick={e => { e.stopPropagation(); setRenaming(file); setNewName(file.name); }} className="p-2 bg-white/10 rounded-lg hover:bg-white/20 text-white" title="Rename"><Pencil className="w-4 h-4" /></button>
                  <button onClick={e => { e.stopPropagation(); setMovingIds([file.id]); setShowMoveModal(true); }} className="p-2 bg-white/10 rounded-lg hover:bg-white/20 text-white" title="Move"><Move className="w-4 h-4" /></button>
                  <button onClick={e => { e.stopPropagation(); handleToggleHide(file); }} className={`p-2 rounded-lg transition-colors ${file.isHidden ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30' : 'bg-white/10 text-white hover:bg-amber-500/20 hover:text-amber-400'}`} title={file.isHidden ? 'Unhide' : 'Hide'}>
                    {file.isHidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                  <button onClick={e => { e.stopPropagation(); handleDelete([file.id]); }} className="p-2 bg-red-500/20 rounded-lg hover:bg-red-500/30 text-red-400" title="Delete"><Trash2 className="w-4 h-4" /></button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Rename Modal */}
      <AnimatePresence>
        {renaming && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
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
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
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
                  {previewFile.webViewLink && isConvertible(previewFile) && (
                    <button onClick={() => {
                      const url = previewFile.webViewLink;
                      const isNative = !!(window as any).Capacitor?.isNativePlatform?.();
                      if (isNative) {
                        window.open(url, '_system');
                      } else {
                        const a = document.createElement('a');
                        a.href = url!;
                        a.target = '_blank';
                        a.rel = 'noopener noreferrer';
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                      }
                    }}
                      className="p-2 sm:p-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl transition-all active:scale-90 flex items-center gap-2" title="Edit in Docs">
                      <Pencil className="w-4 h-4 sm:w-5 sm:h-5" />
                      <span className="hidden sm:inline text-xs font-bold whitespace-nowrap">Edit in Docs</span>
                    </button>
                  )}
                  {(previewFile.mimeType === 'application/pdf' || isConvertible(previewFile)) && (
                    <button onClick={() => {
                      const url = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/files/${previewFile.id}/download?token=${localStorage.getItem('token_admin') || localStorage.getItem('token')}&inline=true${isConvertible(previewFile) ? '&format=pdf' : ''}`;
                      const isNative = !!(window as any).Capacitor?.isNativePlatform?.();
                      if (isNative) {
                        window.open(url, '_system');
                      } else {
                        const a = document.createElement('a');
                        a.href = url;
                        a.target = '_blank';
                        a.rel = 'noopener noreferrer';
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                      }
                    }}
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
                    src={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/files/${previewFile.id}/download?token=${localStorage.getItem('token_admin') || localStorage.getItem('token')}&inline=true`}
                    alt={previewFile.name}
                    className="max-h-full max-w-full object-contain shadow-2xl relative z-10" />
                ) : isVideo(previewFile) ? (
                  <video
                    controls
                    autoPlay
                    className="max-h-full w-full relative z-10 shadow-2xl"
                    src={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/files/${previewFile.id}/download?token=${localStorage.getItem('token_admin') || localStorage.getItem('token')}&inline=true`} />
                ) : (previewFile.mimeType === 'application/pdf' || isConvertible(previewFile)) ? (
                  <iframe
                    src={`https://docs.google.com/gview?url=${encodeURIComponent(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/files/${previewFile.id}/download?token=${localStorage.getItem('token_admin') || localStorage.getItem('token')}&inline=true${isConvertible(previewFile) ? '&format=pdf' : ''}`)}&embedded=true`}
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
                        className="mt-6 px-6 py-2.5 bg-purple-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-purple-500 transition-all">
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
        actionLoading={actionLoading}
      />

      {/* Activity Logs Modal */}
      <AnimatePresence>
        {showLogs && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
            onClick={() => setShowLogs(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-card max-w-2xl w-full max-h-[80vh] flex flex-col rounded-3xl overflow-hidden shadow-2xl">
              <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/5">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <MoreVertical className="w-5 h-5 text-purple-400" /> System Activity
                </h3>
                <div className="flex items-center gap-2">
                  <button onClick={fetchLogs} disabled={loadingLogs}
                    className="p-2 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-xl transition-all border border-white/10 disabled:opacity-50" title="Refresh Logs">
                    <RefreshCw className={`w-4 h-4 ${loadingLogs ? 'animate-spin' : ''}`} />
                  </button>
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
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md sm:p-4"
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
                          className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-500 active:scale-95 transition-all text-xs font-semibold">
                          <Check className="w-3.5 h-3.5" /> Restore All
                        </button>
                        <button onClick={handleEmptyTrash}
                          className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 bg-red-600 text-white rounded-xl hover:bg-red-500 active:scale-95 transition-all text-xs font-semibold">
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
                        <p className="text-white text-sm font-medium break-words">{file.name}</p>
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
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md sm:p-4"
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
        {showDuplicates && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
            onClick={() => setShowDuplicates(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-card w-[95vw] sm:max-w-2xl max-h-[85vh] flex flex-col rounded-3xl overflow-hidden shadow-2xl">
              <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                    <Files className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white tracking-tight">Duplicate Files</h3>
                    <p className="text-xs text-gray-400">Identified by name and exact file size</p>
                  </div>
                </div>
                <button onClick={() => setShowDuplicates(false)} className="text-gray-400 hover:text-white p-2 hover:bg-white/5 rounded-full transition-all">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-6 no-scrollbar bg-black/20">
                {loadingDuplicates ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-24 bg-white/5 rounded-2xl animate-pulse" />
                  ))
                ) : duplicates.length === 0 ? (
                  <div className="py-20 text-center flex flex-col items-center gap-4">
                    <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/20">
                      <Check className="w-8 h-8 text-emerald-400" />
                    </div>
                    <p className="text-gray-400 italic">No duplicate files found. Your storage is clean!</p>
                  </div>
                ) : (
                  duplicates.map((group, groupIdx) => (
                    <div key={groupIdx} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden shadow-lg">
                      <div className="px-4 py-3 bg-white/5 border-b border-white/10 flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <FileIcon file={{ mimeType: group.type } as any} />
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-white truncate">{group.name}</p>
                            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-black">{fmt(group.size)} per file • {group.count} copies</p>
                          </div>
                        </div>
                        <div className="bg-blue-500/10 px-2 py-1 rounded-lg border border-blue-500/20">
                          <span className="text-[10px] text-blue-400 font-bold uppercase whitespace-nowrap">Waste: {fmt((group.size * (group.count - 1)).toString())}</span>
                        </div>
                      </div>
                      <div className="divide-y divide-white/5">
                        {group.items.map((item: any, itemIdx: number) => (
                          <div key={itemIdx} className="px-4 py-3 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                            <div className="min-w-0">
                              <p className="text-[11px] text-gray-400 truncate">Uploaded: {new Date(item.createdAt).toLocaleString()}</p>
                              <p className="text-[9px] text-gray-600 font-mono mt-0.5 truncate uppercase">ID: {item.fileId}</p>
                            </div>
                            <button onClick={() => handleDelete([item.fileId])}
                              className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all active:scale-90"
                              title="Delete this copy">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {duplicates.length > 0 && (
                <div className="p-4 bg-white/5 border-t border-white/10 text-center">
                  <p className="text-[10px] text-gray-500 italic font-medium uppercase tracking-widest">Groups are sorted by waste potential</p>
                </div>
              )}
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
              className="glass-card w-[90vw] sm:max-w-sm p-6 rounded-3xl shadow-2xl border border-white/10">
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
      {/* Upload Progress Modal */}
      <AnimatePresence>
        {showUploadModal && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className={`glass-card w-[95vw] sm:max-w-md overflow-hidden flex flex-col transition-all duration-500 shadow-2xl border border-white/10 ${isUploadMinimized ? 'h-16' : 'max-h-[80vh]'}`}>
              
              {/* Header */}
              <div className="p-4 bg-white/5 border-b border-white/5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                      <Upload className={`w-4 h-4 text-purple-400 ${uploading ? 'animate-bounce' : ''}`} />
                    </div>
                    {uploading && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-purple-500 rounded-full border-2 border-[#0a0a0c] animate-pulse" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white leading-tight">
                      {uploading ? 'Uploading Files...' : 'Upload Complete'}
                    </h3>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">
                      {uploadQueue.filter(q => q.status === 'done').length} / {uploadQueue.length} Done
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setIsUploadMinimized(!isUploadMinimized)}
                    className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all">
                    {isUploadMinimized ? <Maximize2 className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
                  </button>
                  {uploading && (
                    <button onClick={cancelUpload}
                      className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                      title="Cancel All">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                  {!uploading && (
                    <button onClick={() => { setShowUploadModal(false); setUploadQueue([]); }}
                      className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Overall Progress Bar (Sticky) */}
              <div className="px-4 py-3 bg-black/20">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-purple-400 uppercase tracking-tighter">Overall Progress</span>
                  <span className="text-xs font-black text-white">{uploadProgress}%</span>
                </div>
                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                  <motion.div 
                    className="h-full bg-gradient-to-r from-purple-600 via-fuchsia-500 to-pink-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${uploadProgress}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              </div>

              {/* Scrollable File List */}
              {!isUploadMinimized && (
                <div className="flex-1 overflow-y-auto p-2 space-y-1 bg-black/40 no-scrollbar">
                  {(uploadQueue || []).map((item, idx) => {
                    if (!item) return null;
                    return (
                      <div key={idx} className="p-3 bg-white/5 border border-white/5 rounded-xl flex items-center gap-3 group hover:bg-white/10 transition-all">
                        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0 border border-white/5">
                          {item.isFolder ? <Folder className="w-4 h-4 text-yellow-400" /> : <File className="w-4 h-4 text-purple-400/60" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-[11px] text-white font-medium truncate">
                              {item.name || 'Unknown Item'}
                            </p>
                            <span className={`text-[9px] font-bold uppercase ${
                              item.status === 'done' ? 'text-emerald-400' :
                              item.status === 'error' ? 'text-rose-400' :
                              'text-purple-400'
                            }`}>
                              {item.status === 'done' ? 'Success' : 
                               item.status === 'error' ? (item.error === 'Cancelled' ? 'Cancelled' : (item.error || 'Failed')) : 
                               `${Math.round(item.progress || 0)}%`}
                            </span>
                          </div>
                          <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden mb-1">
                            <motion.div 
                              className={`h-full ${item.status === 'error' ? 'bg-red-500' : 'bg-purple-500'}`}
                              animate={{ width: `${Math.min(100, item.progress || 0)}%` }}
                            />
                          </div>
                          {item.status === 'error' && item.error !== 'Cancelled' && (
                            <p className="text-[8px] text-rose-400/80 truncate font-medium">
                              {item.error}
                            </p>
                          )}
                        </div>
                        {(item.status === 'uploading' || item.status === 'pending') && (
                          <button onClick={() => cancelSingleUpload(idx)}
                            className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Action Bar (Only if Error) */}
              {!isUploadMinimized && uploadQueue.some(q => q.status === 'error') && (
                <div className="p-3 bg-red-500/10 border-t border-red-500/20">
                  <p className="text-[10px] text-red-400 text-center font-medium">Some files failed to upload. Check your connection.</p>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmModal.show && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="glass-card w-[90vw] sm:max-w-sm p-6 rounded-3xl shadow-2xl border border-white/10 text-center">
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
                      ? 'bg-red-600 hover:bg-red-500'
                      : 'bg-purple-600 hover:bg-purple-500'}`}>
                  {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {actionLoading ? 'Processing...' : 'Confirm'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>


      {/* Toasts */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 sm:left-auto sm:right-6 sm:translate-x-0 z-[200] flex flex-col gap-3 pointer-events-none w-[90vw] sm:w-auto">
        <AnimatePresence>
          {toasts.map(t => (
            <motion.div key={t.id} 
              initial={{ x: 100, opacity: 0, scale: 0.9 }} 
              animate={{ x: 0, opacity: 1, scale: 1 }} 
              exit={{ x: 100, opacity: 0, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className={`pointer-events-auto px-5 py-3.5 rounded-[20px] shadow-2xl backdrop-blur-xl border flex items-center gap-4 min-w-[280px] max-w-sm relative overflow-hidden group
                ${t.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-emerald-500/10' : 
                  t.type === 'error' ? 'bg-rose-500/10 border-rose-500/20 text-rose-400 shadow-rose-500/10' : 
                  t.type === 'warning' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400 shadow-amber-500/10' :
                  'bg-indigo-500/10 border-indigo-500/20 text-indigo-400 shadow-indigo-500/10'}`}>
              
              {/* Animated Background Glow */}
              <div className={`absolute -right-4 -top-4 w-16 h-16 blur-2xl opacity-20 transition-opacity group-hover:opacity-40
                ${t.type === 'success' ? 'bg-emerald-400' : 
                  t.type === 'error' ? 'bg-rose-400' : 
                  t.type === 'warning' ? 'bg-amber-400' :
                  'bg-indigo-400'}`} 
              />

              <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center border shadow-inner
                ${t.type === 'success' ? 'bg-emerald-500/20 border-emerald-500/30' : 
                  t.type === 'error' ? 'bg-rose-500/20 border-rose-500/30' : 
                  t.type === 'warning' ? 'bg-amber-500/20 border-amber-500/30' :
                  'bg-indigo-500/20 border-indigo-500/30'}`}>
                {t.type === 'success' && <CheckCircle className="w-5 h-5" />}
                {t.type === 'error' && <AlertCircle className="w-5 h-5" />}
                {t.type === 'warning' && <AlertTriangle className="w-5 h-5" />}
                {t.type === 'info' && <Info className="w-5 h-5" />}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold tracking-tight leading-tight mb-0.5 uppercase opacity-50">
                  {t.type}
                </p>
                <p className="text-sm font-medium text-white/90 truncate">{t.msg}</p>
              </div>

              <button onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
                className="p-1 hover:bg-white/5 rounded-lg transition-all opacity-0 group-hover:opacity-100">
                <X className="w-3.5 h-3.5 text-gray-500" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Download Progress Overlay */}
      <AnimatePresence>
        {downloadProgress !== null && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-black/70 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.85, opacity: 0 }}
              className="glass-card p-8 rounded-3xl max-w-xs w-full text-center border border-white/20 shadow-2xl relative overflow-hidden">
              
              <button onClick={cancelActiveDownload}
                className="absolute top-4 right-4 p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all active:scale-90 z-10"
                title="Cancel Preparation">
                <X className="w-5 h-5" />
              </button>

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


      {/* Zip Name Modal */}
      <AnimatePresence>
        {showZipModal && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
            onClick={() => setShowZipModal(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-card w-[90vw] sm:max-w-sm p-6 rounded-[32px] shadow-2xl border border-white/10 relative overflow-hidden">
              
              {/* Decorative background element */}
              <div className="absolute -top-24 -right-24 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
              
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/10 flex items-center justify-center mb-6 border border-white/10 mx-auto">
                  <Archive className="w-7 h-7 text-purple-400" />
                </div>
                
                <h3 className="text-xl font-bold text-white text-center mb-2 tracking-tight">Name your ZIP file</h3>
                <p className="text-xs text-gray-500 text-center mb-8 px-4">Enter a name for your compressed archive of {selected.size} items</p>

                <div className="space-y-4">
                  <div className="relative group">
                    <input
                      autoFocus
                      type="text"
                      value={zipFileName}
                      onChange={(e) => setZipFileName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleBulkDownload(zipFileName)}
                      placeholder="Enter ZIP name..."
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all text-sm font-medium"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-600 uppercase group-focus-within:text-purple-500 transition-colors">.zip</div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button onClick={() => setShowZipModal(false)}
                      className="flex-1 py-3.5 rounded-2xl bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-all text-xs font-bold uppercase tracking-widest">
                      Cancel
                    </button>
                    <button onClick={() => handleBulkDownload(zipFileName)}
                      className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 text-white active:scale-95 transition-all text-xs font-bold uppercase tracking-widest">
                      Download
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function AdminFilesPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-[#0a0a0c]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
          <p className="text-gray-400 text-sm animate-pulse">Initializing DriveFlow...</p>
        </div>
      </div>
    }>
      <AdminFilesContent />
    </Suspense>
  );
}

function MoveFilesModal({ show, onClose, onMove, currentFolderId, filesToMove, actionLoading }: any) {
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
        className="glass-card w-[95vw] sm:max-w-md p-6 rounded-2xl flex flex-col max-h-[80vh]">
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
          <button onClick={onClose} disabled={actionLoading} className="px-4 py-2 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors text-sm disabled:opacity-50">Cancel</button>
          <button onClick={() => onMove(currentPath[currentPath.length - 1].id)}
            disabled={actionLoading || currentPath[currentPath.length - 1].id === currentFolderId}
            className="px-6 py-2 rounded-xl bg-purple-600 text-white hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm flex items-center gap-2">
            {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            {actionLoading ? 'Moving...' : 'Move Here'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
