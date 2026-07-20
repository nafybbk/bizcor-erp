import { useEffect, useMemo, useRef, useState } from "react";
import { Images, FolderOpen, Users, Upload, Loader2, Check, X, Share2, Grid2x2, Grid3x3, LayoutGrid, Search, Trash2, ArrowDownWideNarrow, ArrowUpNarrowWide, Pencil, Crown } from "lucide-react";
import { galleryApi } from "@/lib/galleryApi";
import { api } from "@/lib/api";
import { loadStagingItems, saveStagingItems } from "@/lib/galleryStaging";
import PartySelect from "@/components/PartySelect";
import VirtualPhotoGrid from "@/components/VirtualPhotoGrid";
import ExplorerContextMenu, { type MenuEntry } from "@/components/ExplorerContextMenu";

type CardSize = "sm" | "md" | "lg";
type SortOrder = "newest" | "oldest";
// Folder panes keep the simple 3-step density toggle — half-width panes (two
// side by side) so smaller steps still fit a few columns.
const CARD_PX_FOLDER: Record<CardSize, number> = { sm: 68, md: 96, lg: 140 };

// Common Gallery gets the full Windows-Explorer-style view system instead:
// 4 icon sizes + List + Details, driven entirely by a right-click menu.
type IconSize = "xl" | "lg" | "md" | "sm";
type ViewMode = "icons" | "list" | "details";
type SortBy = "date" | "name";
type SortDir = "asc" | "desc";
const CARD_PX_ICON: Record<IconSize, number> = { xl: 280, lg: 200, md: 140, sm: 96 };
const LIST_ROW_HEIGHT = 40;
const DETAILS_ROW_HEIGHT = 36;

function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

interface GalleryImage {
  id: number;
  url: string;
  thumbnailUrl: string;
  name: string | null;
  originalSize: number | null;
  uploadedSize: number | null;
  uploadedAt: string;
}

interface PartyFolder {
  partyId: number;
  partyName: string;
  imageCount: number;
  lastSharedAt: string;
  unseenCount: number;
}

interface FolderImage {
  shareId: number;
  imageId: number;
  url: string;
  thumbnailUrl: string;
  sharedAt: string;
  deliveredAt: string | null;
  viewedAt: string | null;
}

interface Party { id: number; name: string; }

// A locally-picked image sitting in the left "staging" panel — not on
// Cloudinary yet, so it can still be renamed or dropped before Upload is
// clicked. Identified by a client-only tempId (no server id exists yet).
interface PendingItem {
  tempId: string;
  name: string;
  base64: string;
  mime: string;
  previewUrl: string;
}

async function sha256Hex(base64: string): Promise<string> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
}

// Resizes to a max 1920px side + re-encodes as JPEG at the chosen quality,
// before hashing/upload — cuts both upload bandwidth and Cloudinary storage.
// Always outputs JPEG (product photos never need alpha transparency).
async function compressImage(base64: string, mime: string, quality: number, maxDim = 1920): Promise<{ base64: string; mime: string }> {
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Image load failed"));
    img.src = `data:${mime};base64,${base64}`;
  });
  let width = img.naturalWidth;
  let height = img.naturalHeight;
  if (Math.max(width, height) > maxDim) {
    const scale = maxDim / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
  const outDataUrl = canvas.toDataURL("image/jpeg", quality / 100);
  return { base64: outDataUrl.split(",")[1] || "", mime: "image/jpeg" };
}

// Tick icon matching the WhatsApp-style trail: sent-only (single), delivered
// (double), viewed (blue) — same signal the supplier uses to see if a shared
// photo actually reached/was opened by the customer.
function Ticks({ deliveredAt, viewedAt }: { deliveredAt: string | null; viewedAt: string | null }) {
  if (viewedAt) return <span className="text-sky-500 text-xs" title="Dekhi gayi">✓✓</span>;
  if (deliveredAt) return <span className="text-gray-400 text-xs" title="Pahunch gayi">✓✓</span>;
  return <span className="text-gray-400 text-xs" title="Bheji gayi">✓</span>;
}

// Windows-Explorer-style density switch — small/medium/large thumbnails.
function CardSizeToggle({ value, onChange }: { value: CardSize; onChange: (v: CardSize) => void }) {
  const options: { key: CardSize; icon: typeof Grid2x2; title: string }[] = [
    { key: "sm", icon: LayoutGrid, title: "Chote cards" },
    { key: "md", icon: Grid3x3, title: "Medium cards" },
    { key: "lg", icon: Grid2x2, title: "Bade cards" },
  ];
  return (
    <div className="flex items-center gap-1 pl-2 border-l border-gray-200">
      {options.map(({ key, icon: Icon, title }) => (
        <button key={key} onClick={() => onChange(key)} title={title}
          className={`p-1.5 rounded-md transition-colors ${value === key ? "bg-violet-100 text-violet-700" : "text-gray-400 hover:bg-gray-100"}`}>
          <Icon className="w-4 h-4" />
        </button>
      ))}
    </div>
  );
}

// Toggles newest-first vs oldest-first — matters once a business has
// hundreds/thousands of photos and needs to narrow in on recent uploads
// (or old ones) before rubber-band selecting a batch.
function SortToggle({ value, onChange }: { value: SortOrder; onChange: (v: SortOrder) => void }) {
  return (
    <button
      onClick={() => onChange(value === "newest" ? "oldest" : "newest")}
      title={value === "newest" ? "Sabse nayi pehle" : "Sabse purani pehle"}
      className="flex items-center gap-1 p-1.5 rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
    >
      {value === "newest" ? <ArrowDownWideNarrow className="w-4 h-4" /> : <ArrowUpNarrowWide className="w-4 h-4" />}
    </button>
  );
}

export default function Gallery() {
  const [view, setView] = useState<"common" | "folders">("common");
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [shareOpen, setShareOpen] = useState(false);
  const [parties, setParties] = useState<Party[]>([]);
  const [sharePartyIds, setSharePartyIds] = useState<Party[]>([]);
  const [partySearch, setPartySearch] = useState("");
  const [sharing, setSharing] = useState(false);

  const [folders, setFolders] = useState<PartyFolder[]>([]);
  const [foldersLoading, setFoldersLoading] = useState(false);
  const [folderSearch, setFolderSearch] = useState("");
  const [activeFolder, setActiveFolder] = useState<PartyFolder | null>(null);
  const [folderImages, setFolderImages] = useState<FolderImage[]>([]);
  const [folderLoading, setFolderLoading] = useState(false);
  const [folderSelected, setFolderSelected] = useState<Set<number>>(new Set());
  const [folderSharing, setFolderSharing] = useState(false);

  const [removeSelected, setRemoveSelected] = useState<Set<number>>(new Set());
  const [removing, setRemoving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const isDesktop = localStorage.getItem("erp_app_mode") === "desktop";
  const [quality, setQuality] = useState<number>(() => {
    const saved = Number(localStorage.getItem("gallery_compress_quality"));
    return saved >= 60 && saved <= 100 ? saved : 80;
  });
  useEffect(() => { localStorage.setItem("gallery_compress_quality", String(quality)); }, [quality]);

  const [cardSize, setCardSize] = useState<CardSize>(() => {
    const saved = localStorage.getItem("gallery_card_size");
    return saved === "sm" || saved === "md" || saved === "lg" ? saved : "md";
  });
  useEffect(() => { localStorage.setItem("gallery_card_size", cardSize); }, [cardSize]);

  const [sortOrder, setSortOrder] = useState<SortOrder>(() => {
    const saved = localStorage.getItem("gallery_sort_order");
    return saved === "oldest" ? "oldest" : "newest";
  });
  useEffect(() => { localStorage.setItem("gallery_sort_order", sortOrder); }, [sortOrder]);

  // Common Gallery's Explorer-style view system (separate from the folder
  // panes' simple toggle above) — all driven by the right-click menu.
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem("gallery_view_mode");
    return saved === "list" || saved === "details" ? saved : "icons";
  });
  useEffect(() => { localStorage.setItem("gallery_view_mode", viewMode); }, [viewMode]);

  const [iconSize, setIconSize] = useState<IconSize>(() => {
    const saved = localStorage.getItem("gallery_icon_size");
    return saved === "xl" || saved === "lg" || saved === "sm" ? saved : "md";
  });
  useEffect(() => { localStorage.setItem("gallery_icon_size", iconSize); }, [iconSize]);

  const [commonSortBy, setCommonSortBy] = useState<SortBy>(() => {
    const saved = localStorage.getItem("gallery_sort_by");
    return saved === "name" ? "name" : "date";
  });
  useEffect(() => { localStorage.setItem("gallery_sort_by", commonSortBy); }, [commonSortBy]);

  const [commonSortDir, setCommonSortDir] = useState<SortDir>(() => {
    const saved = localStorage.getItem("gallery_sort_dir");
    return saved === "asc" ? "asc" : "desc";
  });
  useEffect(() => { localStorage.setItem("gallery_sort_dir", commonSortDir); }, [commonSortDir]);

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; targetImageId: number | null } | null>(null);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Left "staging" panel — images picked but not yet uploaded to Cloudinary.
  // Lets a user rename/drop photos before they become live in Common Gallery.
  // Persisted to IndexedDB (see galleryStaging.ts) so an app/system restart
  // doesn't silently wipe photos the user hasn't uploaded yet.
  const [pending, setPending] = useState<PendingItem[]>([]);
  const [pendingLoaded, setPendingLoaded] = useState(false);
  const [pendingSelected, setPendingSelected] = useState<Set<string>>(new Set());
  const [pendingRenamingId, setPendingRenamingId] = useState<string | null>(null);
  const [pendingRenameValue, setPendingRenameValue] = useState("");
  const [uploadingPending, setUploadingPending] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    loadStagingItems<PendingItem>().then(items => { setPending(items); setPendingLoaded(true); });
  }, []);
  useEffect(() => {
    if (pendingLoaded) saveStagingItems(pending);
  }, [pending, pendingLoaded]);

  // Draggable divider between the staging (left) and uploaded (right) panels.
  const [leftPct, setLeftPct] = useState(38);
  const splitRef = useRef<HTMLDivElement>(null);
  const dragDivider = (e: React.MouseEvent) => {
    e.preventDefault();
    const container = splitRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const onMove = (ev: MouseEvent) => {
      const pct = ((ev.clientX - rect.left) / rect.width) * 100;
      setLeftPct(Math.min(65, Math.max(22, pct)));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const loadImages = () => {
    setLoading(true);
    galleryApi.get<GalleryImage[]>("/gallery/images").then(setImages).catch(() => setImages([])).finally(() => setLoading(false));
  };

  const loadFolders = () => {
    setFoldersLoading(true);
    galleryApi.get<PartyFolder[]>("/gallery/parties").then(setFolders).catch(() => setFolders([])).finally(() => setFoldersLoading(false));
  };

  // Free-tier limits (tech panel controlled) — caps the compression quality
  // slider and tells the staging panel when the per-business image cap is hit.
  const [freeLimits, setFreeLimits] = useState({ maxImages: 200, maxQuality: 40, maxKb: 200 });
  const [imageCount, setImageCount] = useState(0);
  const loadModuleStatus = () => {
    galleryApi.get<{ freeLimits: typeof freeLimits; imageCount: number }>("/gallery/module-status")
      .then(r => {
        if (r.freeLimits) setFreeLimits(r.freeLimits);
        setImageCount(r.imageCount || 0);
        setQuality(q => Math.min(q, r.freeLimits?.maxQuality ?? q));
      })
      .catch(() => {});
  };

  const loadParties = () => {
    galleryApi.get<Party[]>("/gallery/customer-parties").then(r => setParties(r || [])).catch(() => setParties([]));
  };

  useEffect(() => {
    loadImages();
    loadFolders();
    loadModuleStatus();
    loadParties();
    // Desktop/LAN businesses keep their real party master locally — the cloud
    // only has whatever the mini-app's PIN-based sync happened to push
    // (a much smaller set). Mirror the full local customer list into the
    // cloud once per page load so the share picker isn't missing names.
    if (isDesktop) {
      api.get<{ data: Party[] }>("/parties?type=customer&limit=1000")
        .then(r => galleryApi.post("/gallery/sync-parties", { parties: r.data || [] }))
        .then(() => loadParties())
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (view === "folders") loadFolders();
  }, [view]);

  const openFolder = (folder: PartyFolder) => {
    setActiveFolder(folder);
    setFolderSelected(new Set());
    setRemoveSelected(new Set());
    setFolderLoading(true);
    galleryApi.get<FolderImage[]>(`/gallery/parties/${folder.partyId}/images`)
      .then(setFolderImages).catch(() => setFolderImages([])).finally(() => setFolderLoading(false));
  };

  const filteredFolders = useMemo(
    () => folders.filter(f => f.partyName?.toLowerCase().includes(folderSearch.trim().toLowerCase())),
    [folders, folderSearch]
  );

  // Common Gallery images not yet shared with the open folder's party — the
  // only ones worth showing while picking what to send next, so a supplier
  // browsing thousands of photos never has to remember what's already gone.
  const availableImages = useMemo(() => {
    const avail = images.filter(img => !folderImages.some(fi => fi.imageId === img.id));
    return sortOrder === "oldest" ? avail.reverse() : avail;
  }, [images, folderImages, sortOrder]);

  // Folder panes keep the simple newest/oldest toggle — pre-sorted
  // newest-first from the server, reverse client-side for "oldest first".
  const displayFolderImages = useMemo(() => (sortOrder === "oldest" ? [...folderImages].reverse() : folderImages), [folderImages, sortOrder]);

  // Common Gallery's Explorer-style Sort by (Name/Date) x (Ascending/Descending).
  const displayImages = useMemo(() => {
    const arr = [...images];
    if (commonSortBy === "name") {
      arr.sort((a, b) => (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" }));
      if (commonSortDir === "desc") arr.reverse();
    } else if (commonSortDir === "asc") {
      arr.reverse(); // server order is already newest-first (date desc)
    }
    return arr;
  }, [images, commonSortBy, commonSortDir]);

  const shareToFolder = async () => {
    if (!folderSelected.size || !activeFolder) return;
    setFolderSharing(true);
    try {
      await galleryApi.post("/gallery/share", {
        imageIds: Array.from(folderSelected),
        partyIds: [activeFolder.partyId],
      });
      setFolderSelected(new Set());
      openFolder(activeFolder);
    } finally {
      setFolderSharing(false);
    }
  };

  // Removes the selected shares — those photos move back to the "available"
  // pane for this customer (does not touch the images themselves).
  const removeSelectedShares = async () => {
    if (!removeSelected.size || !activeFolder) return;
    setRemoving(true);
    try {
      await Promise.all(Array.from(removeSelected).map(shareId => galleryApi.delete(`/gallery/shares/${shareId}`)));
      setRemoveSelected(new Set());
      openFolder(activeFolder);
    } finally {
      setRemoving(false);
    }
  };

  // Uploads one file's bytes: hash locally, ask the server if it already
  // has this content (dedup), only actually upload if it doesn't.
  // Compresses towards the free-tier's quality + size caps — starts at the
  // (already-capped) slider quality, then steps quality/dimensions down
  // further if the result still exceeds maxKb (server enforces the same
  // cap independently, so this is about avoiding a wasted round-trip).
  const uploadOne = async (base64: string, filename: string, mime: string) => {
    const originalSize = atob(base64).length;
    let q = Math.min(quality, freeLimits.maxQuality);
    let maxDim = 1920;
    let compressed = await compressImage(base64, mime, q, maxDim);
    const targetBytes = freeLimits.maxKb * 1024;
    let attempts = 0;
    while (atob(compressed.base64).length > targetBytes && attempts < 5) {
      q = Math.max(10, q - 10);
      maxDim = Math.max(500, Math.round(maxDim * 0.85));
      compressed = await compressImage(base64, mime, q, maxDim);
      attempts++;
    }
    const hash = await sha256Hex(compressed.base64);
    const check = await galleryApi.post<{ exists: boolean }>("/gallery/check-hash", { hash });
    if (check.exists) return;
    const byteChars = atob(compressed.base64);
    const bytes = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
    const blob = new Blob([bytes], { type: compressed.mime });
    await galleryApi.uploadImage(blob, filename.replace(/\.\w+$/, ".jpg"), originalSize);
  };

  // Adds one picked file to the left staging panel — nothing touches the
  // network here; the file only leaves this machine once Upload is clicked.
  const addPending = (base64: string, name: string, mime: string) => {
    const tempId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    setPending(prev => [...prev, { tempId, name, base64, mime, previewUrl: `data:${mime};base64,${base64}` }]);
  };

  const handlePickFolder = async () => {
    const bridge = (window as any).bizcorDesktop;
    if (!bridge?.gallery) return;
    const folder = await bridge.gallery.chooseFolder();
    if (folder.canceled) return;
    const files = await bridge.gallery.listImages(folder.path);
    if (files.error || !Array.isArray(files) || !files.length) return;

    setUploading(true);
    setUploadProgress({ done: 0, total: files.length });
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      try {
        const read = await bridge.gallery.readImage(f.path);
        if (read.base64) {
          const ext = f.name.split(".").pop()?.toLowerCase();
          const mime = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
          addPending(read.base64, f.name, mime);
        }
      } catch { /* skip this one, continue with the rest */ }
      setUploadProgress({ done: i + 1, total: files.length });
    }
    setUploading(false);
    setUploadProgress(null);
  };

  const handleBrowserFilePick = async (fileList: FileList | null) => {
    if (!fileList || !fileList.length) return;
    const files = Array.from(fileList);
    setUploading(true);
    setUploadProgress({ done: 0, total: files.length });
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        addPending(base64, file.name, file.type || "image/jpeg");
      } catch { /* skip, continue */ }
      setUploadProgress({ done: i + 1, total: files.length });
    }
    setUploading(false);
    setUploadProgress(null);
  };

  // Uploads the selected staged photos to Cloudinary; successful ones leave
  // the staging panel and appear in the uploaded (right) panel.
  const uploadSelectedPending = async () => {
    const ids = Array.from(pendingSelected);
    if (!ids.length) return;
    setUploadingPending(true);
    setUploadProgress({ done: 0, total: ids.length });
    const uploaded: string[] = [];
    for (let i = 0; i < ids.length; i++) {
      const item = pending.find(p => p.tempId === ids[i]);
      if (item) {
        try { await uploadOne(item.base64, item.name, item.mime); uploaded.push(item.tempId); }
        catch { /* leave it in staging so the user can retry */ }
      }
      setUploadProgress({ done: i + 1, total: ids.length });
    }
    setPending(prev => prev.filter(p => !uploaded.includes(p.tempId)));
    setPendingSelected(new Set());
    setUploadingPending(false);
    setUploadProgress(null);
    loadImages();
    loadModuleStatus();
  };

  const startPendingRename = (tempId: string) => {
    const item = pending.find(p => p.tempId === tempId);
    setPendingRenamingId(tempId);
    setPendingRenameValue(item?.name || "");
  };

  const commitPendingRename = () => {
    const id = pendingRenamingId;
    const value = pendingRenameValue.trim();
    setPendingRenamingId(null);
    if (id == null || !value) return;
    setPending(prev => prev.map(p => (p.tempId === id ? { ...p, name: value } : p)));
  };

  const removePending = (tempId: string) => {
    setPending(prev => prev.filter(p => p.tempId !== tempId));
    setPendingSelected(prev => { const next = new Set(prev); next.delete(tempId); return next; });
  };

  const doShare = async () => {
    if (!selected.size || !sharePartyIds.length) return;
    setSharing(true);
    try {
      await galleryApi.post("/gallery/share", {
        imageIds: Array.from(selected),
        partyIds: sharePartyIds.map(p => p.id),
      });
      setShareOpen(false);
      setSelected(new Set());
      setSharePartyIds([]);
    } finally {
      setSharing(false);
    }
  };

  // Right-clicking an unselected image selects just that one first — matches
  // Explorer; right-clicking empty space (targetImageId null) leaves the
  // current selection untouched and offers only View/Sort, no item actions.
  const openContextMenu = (e: React.MouseEvent, imageId: number | null) => {
    e.preventDefault();
    if (imageId != null && !selected.has(imageId)) setSelected(new Set([imageId]));
    setContextMenu({ x: e.clientX, y: e.clientY, targetImageId: imageId });
  };

  const startRename = (imageId: number) => {
    const img = images.find(i => i.id === imageId);
    setRenamingId(imageId);
    setRenameValue(img?.name || "");
  };

  const commitRename = async () => {
    const id = renamingId;
    const value = renameValue.trim();
    setRenamingId(null);
    if (id == null || !value) return;
    try {
      const updated = await galleryApi.patch<GalleryImage>(`/gallery/images/${id}`, { name: value });
      setImages(prev => prev.map(img => (img.id === id ? { ...img, name: updated.name } : img)));
    } catch { /* keep old name client-side on failure */ }
  };

  const doDelete = async () => {
    if (!selected.size) return;
    setDeleting(true);
    try {
      await galleryApi.post("/gallery/images/delete", { imageIds: Array.from(selected) });
      setSelected(new Set());
      setDeleteConfirmOpen(false);
      loadImages();
      loadModuleStatus();
    } finally {
      setDeleting(false);
    }
  };

  const contextMenuEntries: MenuEntry[] = contextMenu ? [
    {
      key: "view", label: "View", submenu: [
        { key: "xl", label: "Extra Large Icons", checked: viewMode === "icons" && iconSize === "xl", onClick: () => { setViewMode("icons"); setIconSize("xl"); } },
        { key: "lg", label: "Large Icons", checked: viewMode === "icons" && iconSize === "lg", onClick: () => { setViewMode("icons"); setIconSize("lg"); } },
        { key: "md", label: "Medium Icons", checked: viewMode === "icons" && iconSize === "md", onClick: () => { setViewMode("icons"); setIconSize("md"); } },
        { key: "sm", label: "Small Icons", checked: viewMode === "icons" && iconSize === "sm", onClick: () => { setViewMode("icons"); setIconSize("sm"); } },
        { key: "sep-view", separator: true },
        { key: "list", label: "List", checked: viewMode === "list", onClick: () => setViewMode("list") },
        { key: "details", label: "Details", checked: viewMode === "details", onClick: () => setViewMode("details") },
      ],
    },
    {
      key: "sort", label: "Sort by", submenu: [
        { key: "sort-name", label: "Name", checked: commonSortBy === "name", onClick: () => setCommonSortBy("name") },
        { key: "sort-date", label: "Uploaded Date", checked: commonSortBy === "date", onClick: () => setCommonSortBy("date") },
        { key: "sep-sort", separator: true },
        { key: "sort-asc", label: "Ascending", checked: commonSortDir === "asc", onClick: () => setCommonSortDir("asc") },
        { key: "sort-desc", label: "Descending", checked: commonSortDir === "desc", onClick: () => setCommonSortDir("desc") },
      ],
    },
    ...(contextMenu.targetImageId != null ? [
      { key: "sep-actions", separator: true } as MenuEntry,
      { key: "rename", label: "Rename", disabled: selected.size !== 1, onClick: () => startRename(Array.from(selected)[0]) },
      { key: "delete", label: `Delete${selected.size > 1 ? ` (${selected.size})` : ""}`, danger: true, onClick: () => setDeleteConfirmOpen(true) },
    ] : []),
  ] : [];

  // Shared name label — same rename-in-place behaviour across icon/list/details.
  const renderName = (img: GalleryImage, className: string) =>
    renamingId === img.id ? (
      <input
        autoFocus
        value={renameValue}
        onChange={e => setRenameValue(e.target.value)}
        onClick={e => e.stopPropagation()}
        onMouseDown={e => e.stopPropagation()}
        onBlur={commitRename}
        onKeyDown={e => {
          if (e.key === "Enter") { e.preventDefault(); commitRename(); }
          if (e.key === "Escape") { e.preventDefault(); setRenamingId(null); }
        }}
        className="min-w-0 flex-1 text-xs px-1 py-0.5 border border-violet-400 rounded outline-none text-gray-800"
      />
    ) : (
      <span className={className}>{img.name || `Photo ${img.id}`}</span>
    );

  const scatterThumbs = useMemo(() => images.slice(0, 12).map(i => i.thumbnailUrl), [images]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header — scattered thumbnails at low opacity behind the BizCor Gallery title */}
      <div className="relative overflow-hidden bg-gradient-to-r from-violet-700 via-fuchsia-600 to-indigo-700">
        <div className="absolute inset-0 flex flex-wrap gap-1 opacity-[0.15] pointer-events-none">
          {scatterThumbs.map((url, i) => (
            <img key={i} src={url} alt="" className="w-24 h-24 object-cover" style={{ transform: `rotate(${(i % 5) * 6 - 12}deg)` }} />
          ))}
        </div>
        <div className="relative px-8 py-8">
          <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <Images className="w-8 h-8" /> BizCor Gallery
            <span
              title="Premium Feature — filhaal sabke liye FREE hai. *T&C Applied"
              className="flex items-center gap-1 bg-amber-400 text-amber-900 text-xs font-bold px-2 py-0.5 rounded-full"
            >
              <Crown className="w-3.5 h-3.5" /> Premium — FREE
            </span>
          </h1>
          <p className="text-violet-100 text-sm mt-1">Apni product photos share karein — customers ko unki apni gallery mein dikhengi</p>
          <p className="text-violet-200/80 text-xs mt-1">*T&C Applied — image-share par free-tier limit lagu hai</p>
        </div>

        <div className="relative flex gap-2 px-8 pb-4">
          <button
            onClick={() => setView("common")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${view === "common" ? "bg-white text-violet-700" : "bg-white/15 text-white hover:bg-white/25"}`}
          >
            <FolderOpen className="w-4 h-4" /> Common Gallery
            {images.length > 0 && (
              <span className={`text-xs rounded-full px-1.5 py-0.5 ${view === "common" ? "bg-violet-100 text-violet-700" : "bg-white/20 text-white"}`}>
                {images.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setView("folders")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${view === "folders" ? "bg-white text-violet-700" : "bg-white/15 text-white hover:bg-white/25"}`}
          >
            <Users className="w-4 h-4" /> Customer Folders
            {folders.length > 0 && (
              <span className={`text-xs rounded-full px-1.5 py-0.5 ${view === "folders" ? "bg-violet-100 text-violet-700" : "bg-white/20 text-white"}`}>
                {folders.length}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="p-8">
        {view === "common" ? (
          <div ref={splitRef} className="flex" style={{ height: "calc(100vh - 280px)" }}>
            {/* ─── Left: staging panel — add/review/rename before upload ─── */}
            <div style={{ width: `${leftPct}%` }} className="flex flex-col min-w-0 pr-4">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-semibold text-gray-700">Add Image / Folder</h3>
                <button onClick={uploadSelectedPending} disabled={!pendingSelected.size || uploadingPending || imageCount >= freeLimits.maxImages}
                  className="flex items-center gap-2 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold disabled:opacity-40">
                  {uploadingPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  UPLOAD{pendingSelected.size > 0 ? ` (${pendingSelected.size})` : ""}
                </button>
              </div>
              <div className="text-xs text-gray-400 mb-2">
                {imageCount}/{freeLimits.maxImages} images used (Free tier — *T&C Applied)
                {imageCount >= freeLimits.maxImages && <span className="text-red-500 font-medium"> — limit poori ho gayi hai</span>}
              </div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                {isDesktop && (
                  <button onClick={handlePickFolder} disabled={uploading || imageCount >= freeLimits.maxImages}
                    className="flex items-center gap-2 px-3 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs font-medium disabled:opacity-60">
                    {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    Folder Add Karein
                  </button>
                )}
                <input ref={fileInputRef} type="file" accept="image/*" multiple hidden
                  onChange={e => handleBrowserFilePick(e.target.files)} />
                <button onClick={() => fileInputRef.current?.click()} disabled={uploading || imageCount >= freeLimits.maxImages}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium disabled:opacity-60 ${isDesktop ? "bg-white border border-violet-300 text-violet-700 hover:bg-violet-50" : "bg-violet-600 hover:bg-violet-700 text-white"}`}>
                  {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  Photo Add Karein
                </button>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
                {uploadProgress && (
                  <span>{uploadProgress.done}/{uploadProgress.total} {uploadingPending ? "upload ho rahi hain" : "add ho rahi hain"}…</span>
                )}
                <div className="flex items-center gap-1.5 ml-auto">
                  <span>Quality (free tier max {freeLimits.maxQuality}%)</span>
                  <input type="range" min={10} max={freeLimits.maxQuality} step={5} value={quality}
                    onChange={e => setQuality(Number(e.target.value))}
                    className="w-20 accent-violet-600" title={`${quality}%`} />
                  <span className="w-8">{quality}%</span>
                </div>
              </div>
              {pending.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-center text-gray-400 text-sm px-6 border-2 border-dashed border-gray-200 rounded-xl">
                  Yahan photos add karein — rename/review karein, phir UPLOAD dabayein
                </div>
              ) : (
                <VirtualPhotoGrid
                  items={pending}
                  getKey={p => p.tempId}
                  cardPx={140}
                  extraRowHeight={20}
                  height="calc(100vh - 400px)"
                  selectable
                  selected={pendingSelected}
                  onSelectionChange={setPendingSelected}
                  renderCard={(item, isSelected) => (
                    <div className="flex flex-col gap-1 h-full select-none cursor-pointer group">
                      <div
                        onDoubleClick={() => setPreviewUrl(item.previewUrl)}
                        className={`relative flex-1 rounded-xl overflow-hidden aspect-square border-2 transition-colors ${isSelected ? "border-violet-600" : "border-transparent hover:border-gray-300"}`}>
                        <img src={item.previewUrl} alt="" draggable={false} className="w-full h-full object-cover" />
                        {isSelected && (
                          <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-violet-600 rounded-full flex items-center justify-center">
                            <Check className="w-3.5 h-3.5 text-white" />
                          </div>
                        )}
                        <button
                          onMouseDown={e => e.stopPropagation()}
                          onClick={e => { e.stopPropagation(); startPendingRename(item.tempId); }}
                          className="absolute top-1.5 left-1.5 w-5 h-5 bg-black/50 hover:bg-violet-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Rename">
                          <Pencil className="w-3 h-3 text-white" />
                        </button>
                        <button
                          onMouseDown={e => e.stopPropagation()}
                          onClick={e => { e.stopPropagation(); removePending(item.tempId); }}
                          className="absolute bottom-1.5 left-1.5 w-5 h-5 bg-black/50 hover:bg-red-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Common Gallery se hata dein">
                          <X className="w-3 h-3 text-white" />
                        </button>
                      </div>
                      {pendingRenamingId === item.tempId ? (
                        <input
                          autoFocus
                          value={pendingRenameValue}
                          onChange={e => setPendingRenameValue(e.target.value)}
                          onClick={e => e.stopPropagation()}
                          onMouseDown={e => e.stopPropagation()}
                          onBlur={commitPendingRename}
                          onKeyDown={e => {
                            if (e.key === "Enter") { e.preventDefault(); commitPendingRename(); }
                            if (e.key === "Escape") { e.preventDefault(); setPendingRenamingId(null); }
                          }}
                          className="min-w-0 text-xs px-1 py-0.5 border border-violet-400 rounded outline-none text-gray-800"
                        />
                      ) : (
                        <span className="text-xs text-gray-600 text-center truncate px-1">{item.name}</span>
                      )}
                    </div>
                  )}
                />
              )}
            </div>

            {/* ─── Draggable divider ─── */}
            <div
              onMouseDown={dragDivider}
              className="w-1.5 flex-shrink-0 cursor-col-resize bg-gray-200 hover:bg-violet-400 rounded-full mx-0.5 transition-colors"
              title="Drag to resize"
            />

            {/* ─── Right: uploaded Common Gallery ─── */}
            <div className="flex flex-col min-w-0 flex-1 pl-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-gray-400">Right-click for view/sort options</span>
                {selected.size > 0 && (
                  <div className="flex items-center gap-2">
                    <button onClick={() => setDeleteConfirmOpen(true)}
                      className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium">
                      <Trash2 className="w-4 h-4" /> Delete
                    </button>
                    <button onClick={() => setShareOpen(true)}
                      className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium">
                      <Share2 className="w-4 h-4" /> {selected.size} Photo{selected.size > 1 ? "s" : ""} Share Karein
                    </button>
                  </div>
                )}
              </div>

              {loading ? (
                <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-violet-500" /></div>
              ) : images.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  <Images className="w-10 h-10 mx-auto mb-3 opacity-40" />
                  Abhi koi photo upload nahi hui — left side se add karein
                </div>
              ) : (
                <div onContextMenu={e => openContextMenu(e, null)}>
                  {viewMode === "details" && (
                    <div className="flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-gray-500 border-b border-gray-200">
                      <span className="w-7 flex-shrink-0" />
                      <span className="flex-1 min-w-0">Name</span>
                      <span className="w-40 flex-shrink-0">Uploaded</span>
                      <span className="w-24 flex-shrink-0 text-right">Original Size</span>
                      <span className="w-24 flex-shrink-0 text-right">Uploaded Size</span>
                    </div>
                  )}
                  {viewMode === "icons" ? (
                    <VirtualPhotoGrid
                      items={displayImages}
                      getKey={img => img.id}
                      cardPx={CARD_PX_ICON[iconSize]}
                      extraRowHeight={20}
                      height="calc(100vh - 340px)"
                      selectable
                      selected={selected}
                      onSelectionChange={setSelected}
                      renderCard={(img, isSelected) => (
                        <div
                          onContextMenu={e => openContextMenu(e, img.id)}
                          className="flex flex-col gap-1 h-full select-none cursor-pointer"
                        >
                          <div
                            onDoubleClick={() => setPreviewUrl(img.url)}
                            className={`relative flex-1 rounded-xl overflow-hidden aspect-square border-2 transition-colors ${isSelected ? "border-violet-600" : "border-transparent hover:border-gray-300"}`}>
                            <img src={img.thumbnailUrl} alt="" loading="lazy" draggable={false} className="w-full h-full object-cover" />
                            {isSelected && (
                              <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-violet-600 rounded-full flex items-center justify-center">
                                <Check className="w-3.5 h-3.5 text-white" />
                              </div>
                            )}
                          </div>
                          {renderName(img, "text-xs text-gray-600 text-center truncate px-1")}
                        </div>
                      )}
                    />
                  ) : viewMode === "list" ? (
                    <VirtualPhotoGrid
                      items={displayImages}
                      getKey={img => img.id}
                      cardPx={LIST_ROW_HEIGHT}
                      gap={2}
                      forceColumns={1}
                      height="calc(100vh - 340px)"
                      selectable
                      selected={selected}
                      onSelectionChange={setSelected}
                      renderCard={(img, isSelected) => (
                        <div
                          onContextMenu={e => openContextMenu(e, img.id)}
                          className={`flex items-center gap-2.5 px-2 h-full rounded-lg select-none cursor-pointer ${isSelected ? "bg-violet-100" : "hover:bg-gray-50"}`}
                        >
                          <img src={img.thumbnailUrl} alt="" loading="lazy" draggable={false} className="w-7 h-7 rounded object-cover flex-shrink-0" />
                          {renderName(img, "flex-1 min-w-0 truncate text-sm text-gray-700")}
                        </div>
                      )}
                    />
                  ) : (
                    <VirtualPhotoGrid
                      items={displayImages}
                      getKey={img => img.id}
                      cardPx={DETAILS_ROW_HEIGHT}
                      gap={2}
                      forceColumns={1}
                      height="calc(100vh - 375px)"
                      selectable
                      selected={selected}
                      onSelectionChange={setSelected}
                      renderCard={(img, isSelected) => (
                        <div
                          onContextMenu={e => openContextMenu(e, img.id)}
                          className={`flex items-center gap-2.5 px-2 h-full text-sm select-none cursor-pointer ${isSelected ? "bg-violet-100" : "hover:bg-gray-50"}`}
                        >
                          <img src={img.thumbnailUrl} alt="" loading="lazy" draggable={false} className="w-7 h-7 rounded object-cover flex-shrink-0" />
                          {renderName(img, "flex-1 min-w-0 truncate text-gray-700")}
                          <span className="w-40 flex-shrink-0 text-xs text-gray-500">{formatDate(img.uploadedAt)}</span>
                          <span className="w-24 flex-shrink-0 text-right text-xs text-gray-500">{formatBytes(img.originalSize)}</span>
                          <span className="w-24 flex-shrink-0 text-right text-xs text-gray-500">{formatBytes(img.uploadedSize)}</span>
                        </div>
                      )}
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        ) : foldersLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-violet-500" /></div>
        ) : folders.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
            Abhi kisi customer ko kuch share nahi kiya gaya
          </div>
        ) : (
          <div className="flex gap-4" style={{ height: "calc(100vh - 230px)" }}>
            {/* Left: customer list — always visible, scrollable, searchable */}
            <div className="w-64 flex-shrink-0 bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden">
              <div className="p-2.5 border-b border-gray-200">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    value={folderSearch}
                    onChange={e => setFolderSearch(e.target.value)}
                    placeholder="Customer dhoondein..."
                    className="w-full pl-8 pr-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-violet-400"
                  />
                </div>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto">
                {filteredFolders.map(f => (
                  <button key={f.partyId} onClick={() => openFolder(f)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left border-b border-gray-100 transition-colors ${activeFolder?.partyId === f.partyId ? "bg-violet-50" : "hover:bg-gray-50"}`}>
                    <div className="w-8 h-8 flex-shrink-0 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 font-semibold text-xs">
                      {f.partyName?.[0]?.toUpperCase() || "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-800 truncate">{f.partyName}</div>
                      <div className="text-xs text-gray-400">{f.imageCount} photo{f.imageCount > 1 ? "s" : ""}</div>
                    </div>
                    {f.unseenCount > 0 && (
                      <span className="text-[10px] bg-violet-600 text-white rounded-full px-1.5 py-0.5 font-medium">{f.unseenCount}</span>
                    )}
                  </button>
                ))}
                {filteredFolders.length === 0 && (
                  <div className="text-center py-8 text-gray-400 text-xs px-3">Koi customer nahi mila</div>
                )}
              </div>
            </div>

            {!activeFolder ? (
              <div className="flex-1 flex items-center justify-center bg-white rounded-xl border border-gray-200 text-gray-400 text-sm">
                Ek customer select karein
              </div>
            ) : folderLoading ? (
              <div className="flex-1 flex items-center justify-center bg-white rounded-xl border border-gray-200">
                <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
              </div>
            ) : (
              <>
                {/* Middle: available to share */}
                <div className="flex-1 min-w-0 bg-white rounded-xl border border-gray-200 p-4 flex flex-col">
                  <div className="flex items-center justify-between mb-3 flex-shrink-0">
                    <h3 className="text-sm font-semibold text-gray-600">Bhejne ke liye available ({availableImages.length})</h3>
                    <div className="flex items-center gap-2">
                      {folderSelected.size > 0 && (
                        <>
                          <button onClick={() => setFolderSelected(new Set())} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                          <button onClick={shareToFolder} disabled={folderSharing}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium disabled:opacity-60">
                            {folderSharing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            {folderSelected.size} Share Karein
                          </button>
                        </>
                      )}
                      <SortToggle value={sortOrder} onChange={setSortOrder} />
                      <CardSizeToggle value={cardSize} onChange={setCardSize} />
                    </div>
                  </div>
                  {availableImages.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Sab photos already share ho chuki hain</div>
                  ) : (
                    <div className="flex-1 min-h-0">
                      <VirtualPhotoGrid
                        items={availableImages}
                        getKey={img => img.id}
                        cardPx={CARD_PX_FOLDER[cardSize]}
                        gap={8}
                        height="100%"
                        selectable
                        selected={folderSelected}
                        onSelectionChange={setFolderSelected}
                        renderCard={(img, isSelected) => (
                          <div
                            onDoubleClick={() => setPreviewUrl(img.url)}
                            className={`relative w-full h-full rounded-lg overflow-hidden aspect-square border-2 transition-colors select-none cursor-pointer ${isSelected ? "border-violet-600" : "border-transparent hover:border-gray-300"}`}>
                            <img src={img.thumbnailUrl} alt="" loading="lazy" draggable={false} className="w-full h-full object-cover" />
                            {isSelected && (
                              <div className="absolute top-1 right-1 w-4 h-4 bg-violet-600 rounded-full flex items-center justify-center">
                                <Check className="w-3 h-3 text-white" />
                              </div>
                            )}
                          </div>
                        )}
                      />
                    </div>
                  )}
                </div>

                {/* Right: already shared */}
                <div className="flex-1 min-w-0 bg-white rounded-xl border border-gray-200 p-4 flex flex-col">
                  <div className="flex items-center justify-between mb-3 flex-shrink-0">
                    <h3 className="text-sm font-semibold text-gray-600">Already Share Ki Gayi ({folderImages.length})</h3>
                    {removeSelected.size > 0 && (
                      <div className="flex items-center gap-2">
                        <button onClick={() => setRemoveSelected(new Set())} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                        <button onClick={removeSelectedShares} disabled={removing}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-medium disabled:opacity-60">
                          {removing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          {removeSelected.size} Hatayein
                        </button>
                      </div>
                    )}
                  </div>
                  {folderImages.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Abhi kuch share nahi kiya</div>
                  ) : (
                    <div className="flex-1 min-h-0">
                      <VirtualPhotoGrid
                        items={displayFolderImages}
                        getKey={img => img.shareId}
                        cardPx={CARD_PX_FOLDER[cardSize]}
                        gap={8}
                        height="100%"
                        selectable
                        selected={removeSelected}
                        onSelectionChange={setRemoveSelected}
                        renderCard={(img, isSelected) => (
                          <div
                            onDoubleClick={() => setPreviewUrl(img.url)}
                            className={`relative w-full h-full rounded-lg overflow-hidden aspect-square border-2 transition-colors select-none cursor-pointer bg-gray-100 ${isSelected ? "border-red-500" : "border-transparent"}`}>
                            <img src={img.thumbnailUrl} alt="" loading="lazy" draggable={false} className="w-full h-full object-cover" />
                            <div className="absolute bottom-1 right-1 bg-black/50 rounded px-1 py-0.5">
                              <Ticks deliveredAt={img.deliveredAt} viewedAt={img.viewedAt} />
                            </div>
                            {isSelected && (
                              <div className="absolute top-1 right-1 w-4 h-4 bg-red-600 rounded-full flex items-center justify-center">
                                <Check className="w-3 h-3 text-white" />
                              </div>
                            )}
                          </div>
                        )}
                      />
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Share modal */}
      {shareOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={e => e.target === e.currentTarget && setShareOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold">{selected.size} photo{selected.size > 1 ? "s" : ""} share karein</h2>
              <button onClick={() => setShareOpen(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="p-6 space-y-4">
              <PartySelect
                parties={parties.filter(p => !sharePartyIds.some(sp => sp.id === p.id))}
                value={partySearch}
                onSelect={(p) => { setSharePartyIds(prev => [...prev, p as Party]); setPartySearch(""); }}
                placeholder="Customer dhoondein..."
              />
              {sharePartyIds.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {sharePartyIds.map(p => (
                    <span key={p.id} className="flex items-center gap-1.5 bg-violet-50 text-violet-700 text-sm px-2.5 py-1 rounded-full">
                      {p.name}
                      <button onClick={() => setSharePartyIds(prev => prev.filter(x => x.id !== p.id))}><X className="w-3 h-3" /></button>
                    </span>
                  ))}
                </div>
              )}
              <button onClick={doShare} disabled={sharing || !sharePartyIds.length}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium disabled:opacity-60">
                {sharing && <Loader2 className="w-4 h-4 animate-spin" />}
                Share Karein
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Explorer-style right-click menu — View/Sort always, Rename/Delete only when an image was targeted */}
      {contextMenu && (
        <ExplorerContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          entries={contextMenuEntries}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Delete confirm modal */}
      {deleteConfirmOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={e => e.target === e.currentTarget && setDeleteConfirmOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-2">{selected.size} photo{selected.size > 1 ? "s" : ""} delete karein?</h2>
            <p className="text-sm text-gray-500 mb-5">Yeh Common Gallery se hamesha ke liye hat jayengi, aur customers ko shared copies bhi ab nahi dikhengi.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteConfirmOpen(false)} className="flex-1 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100">Cancel</button>
              <button onClick={doDelete} disabled={deleting}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium disabled:opacity-60">
                {deleting && <Loader2 className="w-4 h-4 animate-spin" />} Delete Karein
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full-resolution preview — double-click any thumbnail to open */}
      {previewUrl && (
        <div
          className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-6"
          onClick={() => setPreviewUrl(null)}
        >
          <button
            onClick={() => setPreviewUrl(null)}
            className="absolute top-4 right-4 w-9 h-9 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white"
          >
            <X className="w-5 h-5" />
          </button>
          <img src={previewUrl} alt="" className="max-w-full max-h-full object-contain rounded-lg" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
