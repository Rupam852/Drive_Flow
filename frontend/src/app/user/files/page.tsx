'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Folder, File, Download, Eye, X, ChevronRight, Home, Image, FileText, Film, MoreVertical, Check, Square, Search, ExternalLink } from 'lucide-react';
import api from '@/lib/api';
import { useAndroidBack } from '@/hooks/useAndroidBack';


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
  if (mime === 'application/vnd.google-apps.folder') return false;
  return mime.startsWith('application/vnd.google-apps.') || 
         mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
         mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
         mime === 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
};
const isDoc = (f: DriveFile) => isConvertible(f) || f.mimeType.includes('pdf') || f.mimeType.includes('text');

const FileIcon = ({ file }: { file: DriveFile }) => {
  if (isFolder(file)) return <Folder className="w-5 h-5 text-yellow-400" />;
  if (isImage(file)) return <Image className="w-5 h-5 text-blue-400" />;
  if (file.mimeType === 'application/vnd.google-apps.document') return <FileText className="w-5 h-5 text-blue-300" />;
  if (file.mimeType.startsWith('video/')) return <Film className="w-5 h-5 text-purple-400" />;
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

export default function UserFilesPage() {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [path, setPath] = useState<{ id: string; name: string }[]>([{ id: ROOT_ID, name: 'Root' }]);
  const [previewFile, setPreviewFile] = useState<DriveFile | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [stats, setStats] = useState<any>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [downloadingFile, setDownloadingFile] = useState<any>(null);
  const [movingIds, setMovingIds] = useState<string[]>([]);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: 'success' | 'error' }[]>([]);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [fakeProgress, setFakeProgress] = useState(0);
  const [zipNameModal, setZipNameModal] = useState(false);
  const [zipName, setZipName] = useState('');
  const zipNameRef = useRef<HTMLInputElement>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  const [downloadStatus, setDownloadStatus] = useState<{ show: boolean; fileName: string; status: 'loading' | 'success' | 'error' }>({
    show: false, fileName: '', status: 'loading'
  });

  // Animate fake counter 1→99 during indeterminate download phase
  useEffect(() => {
    if (downloadProgress === -1) {
      setFakeProgress(1);
      const interval = setInterval(() => {
        setFakeProgress(prev => {
          if (prev >= 99) { clearInterval(interval); return 99; }
          const step = prev < 30 ? 3 : prev < 60 ? 2 : prev < 85 ? 1 : 0.3;
          return Math.min(99, prev + step);
        });
      }, 200);
      return () => clearInterval(interval);
    } else {
      setFakeProgress(0);
    }
  }, [downloadProgress]);
  const currentFolder = path[path.length - 1]!;

  const loadFiles = async (folderId: string) => {
    setLoading(true);
    try {
      const res = await api.get(`/files?parentId=${folderId}`);
      setFiles(res.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const fetchStats = async () => {
    try {
      const res = await api.get(`/files/stats?parentId=${currentFolder.id}`);
      setStats(res.data);
    } catch (e) { console.error(e); }
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
    const anyModalOpen = !!previewFile || showDownloadModal || showMoveModal;
    if (anyModalOpen) {
      window.history.pushState({ modal: true }, '');
    }
  }, [previewFile, showDownloadModal, showMoveModal]);

  useEffect(() => {
    if (!searchQuery) {
      loadFiles(currentFolder.id);
    }
    fetchStats();

    const handlePopState = (e: PopStateEvent) => {
      // If a modal is open, close it and stay on the page
      if (previewFile)       { setPreviewFile(null);        return; }
      if (showDownloadModal) { setShowDownloadModal(false); return; }
      if (showMoveModal)     { setShowMoveModal(false);     return; }

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
  }, [currentFolder.id, previewFile, showDownloadModal, showMoveModal]);


  const filteredFiles = useMemo(() => {
    const matchesCategory = (f: DriveFile) => {
      if (activeCategory === 'all') return true;
      if (activeCategory === 'folders') return isFolder(f);
      if (activeCategory === 'images') return isImage(f);
      if (activeCategory === 'docs') return isDoc(f);
      if (activeCategory === 'videos') return isVideo(f);
      return true;
    };

    const sorted = files.filter(matchesCategory).sort((a, b) => {
      const aFolder = isFolder(a);
      const bFolder = isFolder(b);
      if (aFolder && !bFolder) return -1;
      if (!aFolder && bFolder) return 1;
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    });
    return sorted;
  }, [files, activeCategory]);

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

  // Universal download trigger - works on both web and Android WebView
  const triggerDownload = (url: string, fileName = 'file') => {
    const isNative = !!(window as any).Capacitor?.isNativePlatform?.();
    if (isNative) {
      // On Android: show in-app status overlay instead of opening system browser
      setDownloadStatus({ show: true, fileName, status: 'loading' });
      fetch(url)
        .then(res => {
          if (!res.ok) throw new Error('Download failed');
          return res.blob();
        })
        .then(blob => {
          // Create blob URL and trigger save without opening browser
          const blobUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = blobUrl;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(blobUrl); }, 500);
          setDownloadStatus({ show: true, fileName, status: 'success' });
          setTimeout(() => setDownloadStatus(s => ({ ...s, show: false })), 3000);
        })
        .catch(() => {
          setDownloadStatus({ show: true, fileName, status: 'error' });
          setTimeout(() => setDownloadStatus(s => ({ ...s, show: false })), 3000);
        });
    } else {
      // On web: standard anchor download
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => document.body.removeChild(a), 500);
    }
  };

  const getToken = () =>
    localStorage.getItem('token_user') || localStorage.getItem('token') || '';

  const getApiBase = () =>
    process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

  const handleDownload = async (file: DriveFile, format?: string) => {
    if (isConvertible(file) && !format && !isFolder(file)) {
      setDownloadingFile(file);
      setShowDownloadModal(true);
      return;
    }

    if (format) {
      const ext = format === 'pdf' ? '.pdf' : '.docx';
      const url = `${getApiBase()}/files/${file.id}/download?token=${getToken()}&format=${format}`;
      triggerDownload(url, file.name.replace(/\.[^.]+$/, '') + ext);
      setShowDownloadModal(false);
      return;
    }

    // Folder download → ZIP
    if (isFolder(file)) {
      const isNative = !!(window as any).Capacitor?.isNativePlatform?.();
      const zipFileName = file.name + '.zip';
      const name = encodeURIComponent(zipFileName);
      const url = `${getApiBase()}/files/bulk-download?fileIds=${file.id}&token=${getToken()}&fileName=${name}`;
      if (isNative) {
        triggerDownload(url, zipFileName);
      } else {
        addToast('Preparing folder ZIP...');
        setDownloadProgress(-1);
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
          link.setAttribute('download', zipFileName);
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

    // Single file download
    const isNative = !!(window as any).Capacitor?.isNativePlatform?.();
    const url = `${getApiBase()}/files/${file.id}/download?token=${getToken()}`;
    if (isNative) {
      triggerDownload(url, file.name);
    } else {
      addToast('Starting download...');
      setDownloadProgress(-1);
      try {
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
      } catch (e) {
        addToast('Download failed', 'error');
        setDownloadProgress(null);
      }
    }
    setShowDownloadModal(false);
  };

  const handleBulkDownload = () => {
    if (selected.size === 0) return;
    setZipName(`driveflow-${new Date().toISOString().slice(0,10)}`);
    setZipNameModal(true);
    setTimeout(() => zipNameRef.current?.select(), 100);
  };

  const confirmBulkDownload = async () => {
    setZipNameModal(false);
    const finalName = zipName.trim() || 'driveflow-downloads';
    addToast('Preparing ZIP download...');
    setDownloadProgress(-1);
    try {
      const ids = Array.from(selected).join(',');
      const name = encodeURIComponent(finalName + '.zip');
      const url = `${getApiBase()}/files/bulk-download?fileIds=${ids}&token=${getToken()}&fileName=${name}`;
      
      const isNative = !!(window as any).Capacitor?.isNativePlatform?.();
      if (isNative) {
        triggerDownload(url, finalName + '.zip');
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
        link.setAttribute('download', finalName + '.zip');
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(blobUrl);
        setDownloadProgress(null);
      }
      setSelected(new Set());
      addToast(`Download started: "${finalName}.zip"`);
    } catch (e) {
      console.error(e);
      addToast('Error downloading files', 'error');
      setDownloadProgress(null);
    }
  };

  const addToast = (msg: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const handleItemTouchStart = (id: string, e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartPos.current = { x: touch.clientX, y: touch.clientY };
    longPressTimerRef.current = setTimeout(() => {
      longPressTimerRef.current = null;
      setSelected(prev => {
        const n = new Set(prev);
        n.has(id) ? n.delete(id) : n.add(id);
        return n;
      });
      if (navigator.vibrate) navigator.vibrate(60);
    }, 500);
  };

  const handleItemTouchMove = (e: React.TouchEvent) => {
    if (!longPressTimerRef.current || !touchStartPos.current) return;
    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - touchStartPos.current.x);
    const dy = Math.abs(touch.clientY - touchStartPos.current.y);
    // If user scrolled more than 8px, cancel long press
    if (dx > 8 || dy > 8) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
      touchStartPos.current = null;
    }
  };

  const handleItemTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    touchStartPos.current = null;
  };

  const handleMove = async (targetId: string, idsToMove?: string[]) => {
    const ids = idsToMove || movingIds;
    if (ids.length === 0) return;
    try {
      await api.put('/files/move', { fileIds: ids, targetParentId: targetId });
      setMovingIds([]);
      addToast('File moved successfully');
      await loadFiles(currentFolder.id);
    } catch (e) { 
      console.error(e);
      addToast('Error moving file', 'error');
    }
  };

  const handleItemClick = (file: DriveFile) => {
    if (selected.size > 0) {
      toggleSelect(file.id);
    } else {
      if (isFolder(file)) navigate(file);
      else setPreviewFile(file);
    }
  };

  // Android back gesture — priority 10
  useAndroidBack(() => {
    if (selected.size > 0)      { setSelected(new Set()); return true; }
    if (previewFile)            { setPreviewFile(null); return true; }
    if (showDownloadModal)      { setShowDownloadModal(false); return true; }
    if (showMoveModal)          { setShowMoveModal(false); return true; }
    if (zipNameModal)           { setZipNameModal(false); return true; }
    if (path.length > 1) {
      const newPath = path.slice(0, -1);
      setPath(newPath);
      loadFiles(newPath[newPath.length - 1].id);
      return true;
    }
    return false;
  }, 10, [selected, previewFile, showDownloadModal, showMoveModal, zipNameModal, path]);

  return (

    <motion.div 
      className="space-y-4"
      onPanEnd={(_, info) => {
        if (info.offset.x > 100 && Math.abs(info.offset.y) < 50 && path.length > 1) {
          breadcrumbNav(path.length - 2);
        }
      }}
    >
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
            <h2 className="text-2xl font-bold text-white">My Files</h2>
            <div className="flex items-center gap-1 mt-1 overflow-x-auto no-scrollbar max-w-[70vw] sm:max-w-sm">
              {searchQuery ? (
                <span className="text-sm text-purple-400 font-medium flex items-center gap-2 whitespace-nowrap">
                  <Search className="w-4 h-4" /> Search results for "{searchQuery}"
                </span>
              ) : (
                path.map((p, i) => (
                  <span key={i} className="flex items-center gap-1 shrink-0">
                    {i > 0 && <ChevronRight className="w-3 h-3 text-gray-500 shrink-0" />}
                    <button onClick={() => breadcrumbNav(i)}
                      className={`text-sm transition-colors whitespace-nowrap ${i === path.length - 1 ? 'text-white font-medium' : 'text-gray-400 hover:text-white'}`}>
                      {i === 0 ? <Home className="w-4 h-4" /> : (p.name.length > 20 ? p.name.substring(0, 17) + '...' : p.name)}
                    </button>
                  </span>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right: storage bar + view toggle */}
        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
          {stats && (
            <div className="w-40 sm:w-48 bg-white/5 p-2 px-3 rounded-2xl border border-white/10">
              <div className="flex justify-between text-[9px] text-gray-400 mb-1 font-medium uppercase tracking-wider">
                <span>Storage</span>
                <span>{fmt(stats.used)} / {fmt(stats.limit)}</span>
              </div>
              <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                <motion.div initial={{ width: 0 }} animate={{ width: `${Math.max(Number(stats.used) > 0 ? 1 : 0, (Number(stats.used) / (Number(stats.limit) || 10 * 1024 * 1024 * 1024)) * 100)}%` }}
                  className="h-full bg-gradient-to-r from-purple-500 to-pink-500" />
              </div>
            </div>
          )}

          <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
            <button onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
              <MoreVertical className="w-4 h-4 rotate-90" />
            </button>
            <button onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
              <Square className="w-4 h-4" />
            </button>
          </div>
        </div>
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
            className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all outline-none"
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
                  ? 'bg-purple-500 text-white border-purple-400' 
                  : 'bg-white/5 text-gray-400 border-white/5 hover:bg-white/10 hover:border-white/10'}`}>
              {cat.icon} {cat.label}
            </button>
          ))}
        </div>
      </div>

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
                <tr className="border-b border-white/10 text-gray-400 text-xs uppercase tracking-wider">
                  <th className="px-6 py-4 font-semibold">Name</th>
                  <th className="px-6 py-4 font-semibold">Size</th>
                  <th className="px-6 py-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredFiles.map((file, i) => (
                  <motion.tr key={file.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}
                    className={`border-b border-white/5 hover:bg-white/5 transition-colors group ${selected.has(file.id) ? 'bg-purple-500/10' : ''}`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <button onClick={(e) => { e.stopPropagation(); toggleSelect(file.id); }} className="mr-2">
                          {selected.has(file.id) 
                            ? <Check className="w-4 h-4 text-purple-400" /> 
                            : <div className="w-4 h-4 border border-white/20 rounded group-hover:border-white/40" />
                          }
                        </button>
                        <button onClick={() => handleItemClick(file)}
                          onTouchStart={(e) => handleItemTouchStart(file.id, e)}
                          onTouchMove={handleItemTouchMove}
                          onTouchEnd={handleItemTouchEnd}
                          onContextMenu={(e) => { e.preventDefault(); toggleSelect(file.id); }}
                          className="flex items-center gap-3 text-white hover:text-purple-300 transition-colors text-left flex-1">
                          <FileIcon file={file} />
                          <span className="text-sm font-medium truncate max-w-[200px]">{file.name}</span>
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-sm font-medium">{fmt(file.size, isFolder(file))}</td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={(e) => { e.stopPropagation(); handleDownload(file); }}
                        className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
                        <Download className="w-5 h-5" />
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
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
                onClick={() => handleItemClick(file)}
                onTouchStart={(e) => handleItemTouchStart(file.id, e)}
                onTouchMove={handleItemTouchMove}
                onTouchEnd={handleItemTouchEnd}
                onContextMenu={(e) => { e.preventDefault(); toggleSelect(file.id); }}
                className={`relative p-4 rounded-3xl border transition-all cursor-pointer group flex flex-col items-center gap-3
                  ${selected.has(file.id) 
                    ? 'bg-purple-500/10 border-purple-500/40 shadow-sm' 
                    : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/20'}`}>
                
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
                  <p className="text-gray-500 text-[10px] font-medium">{fmt(file.size, isFolder(file))}</p>
                </div>

              </motion.div>
            ))}
          </div>
        )}
      </div>

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
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center shrink-0">
                    <FileIcon file={previewFile} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-white font-bold truncate text-sm sm:text-base">{previewFile.name}</h3>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest">{previewFile.mimeType}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 sm:gap-2 shrink-0 ml-2">
                  {(previewFile.mimeType === 'application/pdf' || isConvertible(previewFile)) && (
                    <button onClick={() => window.open(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/files/${previewFile.id}/download?token=${getToken()}&inline=true${isConvertible(previewFile) ? '&format=pdf' : ''}`, '_blank')}
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
                    src={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/files/${previewFile.id}/download?token=${getToken()}`}
                    alt={previewFile.name} 
                    className="max-h-full max-w-full object-contain shadow-2xl relative z-10" />
                ) : isVideo(previewFile) ? (
                  <video 
                    controls 
                    autoPlay 
                    className="max-h-full w-full relative z-10 shadow-2xl" 
                    src={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/files/${previewFile.id}/download?token=${getToken()}`} />
                ) : (previewFile.mimeType === 'application/pdf' || isConvertible(previewFile)) ? (
                  <iframe
                    src={`https://docs.google.com/gview?url=${encodeURIComponent(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/files/${previewFile.id}/download?token=${getToken()}&inline=true${isConvertible(previewFile) ? '&format=pdf' : ''}`)}&embedded=true`}
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
      {/* Download Options Modal */}
      <AnimatePresence>
        {showDownloadModal && downloadingFile && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
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

      {/* Floating Action Bar */}
      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[90] glass-card px-6 py-4 rounded-full shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/20 flex items-center gap-6">
            <span className="text-white font-medium text-sm whitespace-nowrap">
              <span className="text-purple-400 font-bold">{selected.size}</span> selected
            </span>
            <div className="w-px h-6 bg-white/20" />
            <button onClick={handleBulkDownload} className="flex items-center gap-2 text-white hover:text-purple-400 transition-colors whitespace-nowrap">
              <Download className="w-5 h-5" />
              <span className="text-sm font-medium">Download All</span>
            </button>
            <button onClick={() => setSelected(new Set())} className="flex items-center gap-2 text-gray-400 hover:text-red-400 transition-colors ml-2" title="Clear selection">
              <X className="w-5 h-5" />
            </button>
          </motion.div>
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
                  <circle cx="48" cy="48" r="40" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
                  <motion.circle
                    cx="48" cy="48" r="40"
                    fill="none"
                    stroke="url(#dlGradUser)"
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
                    <linearGradient id="dlGradUser" x1="0%" y1="0%" x2="100%" y2="0%">
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
                {downloadProgress === -1 ? 'Zipping your files, please wait' : 'Downloading your files...'}
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

      {/* ZIP Name Modal */}
      <AnimatePresence>
        {zipNameModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-xl px-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="w-full max-w-sm glass-card rounded-3xl p-6 border border-white/10 shadow-2xl"
            >
              <div className="w-12 h-12 rounded-2xl bg-purple-500/20 flex items-center justify-center mb-4 mx-auto">
                <Download className="w-6 h-6 text-purple-400" />
              </div>
              <h3 className="text-white font-bold text-lg text-center mb-1">Name your ZIP file</h3>
              <p className="text-gray-400 text-sm text-center mb-5">
                {selected.size} item{selected.size !== 1 ? 's' : ''} selected
              </p>
              <div className="relative mb-5">
                <input
                  ref={zipNameRef}
                  type="text"
                  value={zipName}
                  onChange={e => setZipName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && confirmBulkDownload()}
                  placeholder="Enter ZIP file name..."
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all pr-16"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm">.zip</span>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setZipNameModal(false)}
                  className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 rounded-2xl font-medium transition-all active:scale-95"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmBulkDownload}
                  className="flex-1 px-4 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-2xl font-bold transition-all active:scale-95"
                >
                  Download
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Download Status Overlay - Android only */}
      <AnimatePresence>
        {downloadStatus.show && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-xl p-6"
            onClick={() => downloadStatus.status !== 'loading' && setDownloadStatus(s => ({ ...s, show: false }))}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 20, stiffness: 300 }}
              className="glass-card w-full max-w-xs rounded-[32px] p-8 flex flex-col items-center gap-5 shadow-[0_0_80px_rgba(0,0,0,0.6)] border border-white/10"
              onClick={e => e.stopPropagation()}
            >
              {/* Icon */}
              <div className="relative">
                {downloadStatus.status === 'loading' && (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    className="w-20 h-20 rounded-full border-4 border-purple-500/20 border-t-purple-500"
                  />
                )}
                {downloadStatus.status === 'success' && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', damping: 15, stiffness: 300 }}
                    className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500/30 to-green-500/20 border-2 border-emerald-500/50 flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.3)]"
                  >
                    <motion.svg
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.4, delay: 0.1 }}
                      className="w-10 h-10 text-emerald-400"
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}
                    >
                      <motion.path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </motion.svg>
                  </motion.div>
                )}
                {downloadStatus.status === 'error' && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', damping: 15, stiffness: 300 }}
                    className="w-20 h-20 rounded-full bg-red-500/20 border-2 border-red-500/40 flex items-center justify-center shadow-[0_0_30px_rgba(239,68,68,0.2)]"
                  >
                    <X className="w-10 h-10 text-red-400" />
                  </motion.div>
                )}
              </div>

              {/* Text */}
              <div className="text-center">
                <p className="text-white font-bold text-lg mb-1">
                  {downloadStatus.status === 'loading' && 'Downloading...'}
                  {downloadStatus.status === 'success' && 'Download Complete!'}
                  {downloadStatus.status === 'error' && 'Download Failed'}
                </p>
                <p className="text-gray-400 text-sm truncate max-w-[200px]">
                  {downloadStatus.fileName}
                </p>
                {downloadStatus.status === 'loading' && (
                  <p className="text-purple-400 text-xs mt-2 animate-pulse">Please wait...</p>
                )}
                {downloadStatus.status === 'success' && (
                  <p className="text-emerald-400 text-xs mt-2">Saved to your Downloads folder</p>
                )}
                {downloadStatus.status === 'error' && (
                  <p className="text-red-400 text-xs mt-2">Please try again</p>
                )}
              </div>

              {/* Close button - only when done */}
              {downloadStatus.status !== 'loading' && (
                <motion.button
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => setDownloadStatus(s => ({ ...s, show: false }))}
                  className="px-8 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-full text-sm font-medium transition-all active:scale-95"
                >
                  Close
                </motion.button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </motion.div>
  );
}
