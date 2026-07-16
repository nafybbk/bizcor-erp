import { useEffect, useMemo, useRef, useState } from "react";
import { Images, FolderOpen, Users, Upload, Loader2, Check, X, Share2, ChevronLeft } from "lucide-react";
import { galleryApi } from "@/lib/galleryApi";
import { api } from "@/lib/api";
import PartySelect from "@/components/PartySelect";

interface GalleryImage {
  id: number;
  url: string;
  thumbnailUrl: string;
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

async function sha256Hex(base64: string): Promise<string> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
}

// Tick icon matching the WhatsApp-style trail: sent-only (single), delivered
// (double), viewed (blue) — same signal the supplier uses to see if a shared
// photo actually reached/was opened by the customer.
function Ticks({ deliveredAt, viewedAt }: { deliveredAt: string | null; viewedAt: string | null }) {
  if (viewedAt) return <span className="text-sky-500 text-xs" title="Dekhi gayi">✓✓</span>;
  if (deliveredAt) return <span className="text-gray-400 text-xs" title="Pahunch gayi">✓✓</span>;
  return <span className="text-gray-400 text-xs" title="Bheji gayi">✓</span>;
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
  const [activeFolder, setActiveFolder] = useState<PartyFolder | null>(null);
  const [folderImages, setFolderImages] = useState<FolderImage[]>([]);
  const [folderLoading, setFolderLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const isDesktop = localStorage.getItem("erp_app_mode") === "desktop";

  const loadImages = () => {
    setLoading(true);
    galleryApi.get<GalleryImage[]>("/gallery/images").then(setImages).catch(() => setImages([])).finally(() => setLoading(false));
  };

  const loadFolders = () => {
    setFoldersLoading(true);
    galleryApi.get<PartyFolder[]>("/gallery/parties").then(setFolders).catch(() => setFolders([])).finally(() => setFoldersLoading(false));
  };

  useEffect(() => {
    loadImages();
    api.get<{ data: Party[] }>("/parties?type=customer&limit=1000").then(r => setParties(r.data || [])).catch(() => setParties([]));
  }, []);

  useEffect(() => {
    if (view === "folders") loadFolders();
  }, [view]);

  const openFolder = (folder: PartyFolder) => {
    setActiveFolder(folder);
    setFolderLoading(true);
    galleryApi.get<FolderImage[]>(`/gallery/parties/${folder.partyId}/images`)
      .then(setFolderImages).catch(() => setFolderImages([])).finally(() => setFolderLoading(false));
  };

  // Uploads one file's bytes: hash locally, ask the server if it already
  // has this content (dedup), only actually upload if it doesn't.
  const uploadOne = async (base64: string, filename: string, mime: string) => {
    const hash = await sha256Hex(base64);
    const check = await galleryApi.post<{ exists: boolean }>("/gallery/check-hash", { hash });
    if (check.exists) return;
    const byteChars = atob(base64);
    const bytes = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
    const blob = new Blob([bytes], { type: mime });
    await galleryApi.uploadImage(blob, filename);
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
          await uploadOne(read.base64, f.name, mime);
        }
      } catch { /* skip this one, continue with the rest */ }
      setUploadProgress({ done: i + 1, total: files.length });
    }
    setUploading(false);
    setUploadProgress(null);
    loadImages();
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
        await uploadOne(base64, file.name, file.type || "image/jpeg");
      } catch { /* skip, continue */ }
      setUploadProgress({ done: i + 1, total: files.length });
    }
    setUploading(false);
    setUploadProgress(null);
    loadImages();
  };

  const toggleSelect = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
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
          </h1>
          <p className="text-violet-100 text-sm mt-1">Apni product photos share karein — customers ko unki apni gallery mein dikhengi</p>
        </div>

        <div className="relative flex gap-2 px-8 pb-4">
          <button
            onClick={() => setView("common")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${view === "common" ? "bg-white text-violet-700" : "bg-white/15 text-white hover:bg-white/25"}`}
          >
            <FolderOpen className="w-4 h-4" /> Common Gallery
          </button>
          <button
            onClick={() => setView("folders")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${view === "folders" ? "bg-white text-violet-700" : "bg-white/15 text-white hover:bg-white/25"}`}
          >
            <Users className="w-4 h-4" /> Customer Folders
          </button>
        </div>
      </div>

      <div className="p-8">
        {view === "common" ? (
          <>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                {isDesktop ? (
                  <button onClick={handlePickFolder} disabled={uploading}
                    className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium disabled:opacity-60">
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    Folder se Photos Add Karein
                  </button>
                ) : (
                  <>
                    <input ref={fileInputRef} type="file" accept="image/*" multiple hidden
                      onChange={e => handleBrowserFilePick(e.target.files)} />
                    <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                      className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium disabled:opacity-60">
                      {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      Photos Add Karein
                    </button>
                  </>
                )}
                {uploadProgress && (
                  <span className="text-sm text-gray-500">{uploadProgress.done}/{uploadProgress.total} upload ho rahi hain…</span>
                )}
              </div>
              {selected.size > 0 && (
                <button onClick={() => setShareOpen(true)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium">
                  <Share2 className="w-4 h-4" /> {selected.size} Photo{selected.size > 1 ? "s" : ""} Share Karein
                </button>
              )}
            </div>

            {loading ? (
              <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-violet-500" /></div>
            ) : images.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <Images className="w-10 h-10 mx-auto mb-3 opacity-40" />
                Abhi koi photo nahi hai — upar se folder select karein
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                {images.map(img => (
                  <button key={img.id} onClick={() => toggleSelect(img.id)}
                    className={`relative rounded-xl overflow-hidden aspect-square border-2 transition-colors ${selected.has(img.id) ? "border-violet-600" : "border-transparent hover:border-gray-300"}`}>
                    <img src={img.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                    {selected.has(img.id) && (
                      <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-violet-600 rounded-full flex items-center justify-center">
                        <Check className="w-3.5 h-3.5 text-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </>
        ) : activeFolder ? (
          <div>
            <button onClick={() => setActiveFolder(null)} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
              <ChevronLeft className="w-4 h-4" /> Sab Folders
            </button>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">{activeFolder.partyName}</h2>
            {folderLoading ? (
              <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-violet-500" /></div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                {folderImages.map(img => (
                  <div key={img.shareId} className="relative rounded-xl overflow-hidden aspect-square bg-gray-100">
                    <img src={img.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                    <div className="absolute bottom-1.5 right-1.5 bg-black/50 rounded px-1.5 py-0.5">
                      <Ticks deliveredAt={img.deliveredAt} viewedAt={img.viewedAt} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : foldersLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-violet-500" /></div>
        ) : folders.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
            Abhi kisi customer ko kuch share nahi kiya gaya
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {folders.map(f => (
              <button key={f.partyId} onClick={() => openFolder(f)}
                className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-200 hover:border-violet-300 hover:shadow-sm transition-all text-left">
                <div className="w-11 h-11 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 font-semibold">
                  {f.partyName?.[0]?.toUpperCase() || "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-800 truncate">{f.partyName}</div>
                  <div className="text-xs text-gray-400">{f.imageCount} photo{f.imageCount > 1 ? "s" : ""}</div>
                </div>
                {f.unseenCount > 0 && (
                  <span className="text-xs bg-violet-600 text-white rounded-full px-2 py-0.5 font-medium">{f.unseenCount}</span>
                )}
              </button>
            ))}
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
    </div>
  );
}
