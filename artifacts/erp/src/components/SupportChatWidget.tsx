import { useEffect, useRef, useState } from "react";
import {
  MessageCircle, X, Send, Loader2, ChevronDown, Paperclip,
  Download, File, FileText, FileImage, FileVideo, FileAudio, XCircle, GripHorizontal
} from "lucide-react";
import { api } from "@/lib/api";

const SESSION_KEY = "erp_support_chat_session";
const META_KEY   = "erp_support_chat_meta";

const MIN_W = 260; const MAX_W = 600;
const MIN_H = 300; const MAX_H = 700;
const DEF_W = 320; const DEF_H = 460;

function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function")
    return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16);
  });
}
function getSessionId(): string {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) { id = generateId(); localStorage.setItem(SESSION_KEY, id); }
  return id;
}
function humanSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
function isImage(m: string | null) { return m?.startsWith("image/") ?? false; }
function isVideo(m: string | null) { return m?.startsWith("video/") ?? false; }
function isAudio(m: string | null) { return m?.startsWith("audio/") ?? false; }
function FileIcon({ mime }: { mime: string | null }) {
  if (isImage(mime)) return <FileImage className="w-4 h-4" />;
  if (isVideo(mime)) return <FileVideo className="w-4 h-4" />;
  if (isAudio(mime)) return <FileAudio className="w-4 h-4" />;
  if (mime === "application/pdf") return <FileText className="w-4 h-4" />;
  return <File className="w-4 h-4" />;
}

type Message = {
  id: number; sessionId: string; senderType: "user" | "admin";
  name: string | null; phone: string | null; email: string | null;
  message: string | null; filePath: string | null; fileName: string | null;
  fileMimeType: string | null; fileSize: number | null;
  status: string; createdAt: string;
};
type Meta = { name: string; phone: string; email: string };

function FilePreview({ msg }: { msg: Message }) {
  const [downloading, setDownloading] = useState(false);
  const [imgError, setImgError] = useState(false);
  if (!msg.filePath) return null;
  const fileUrl = msg.fileName?.startsWith("http") ? msg.fileName : null;
  if (!fileUrl) return null;
  const displayName = msg.filePath.split("/").pop()?.replace(/^\d+_/, "") ?? "file";
  const isMe = msg.senderType === "user";

  const handleDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const res = await fetch(fileUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = displayName;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch { /* silent */ }
    setDownloading(false);
  };

  if (isImage(msg.fileMimeType) && !imgError) {
    return (
      <div className="mt-1">
        <img src={fileUrl} alt={displayName}
          className="max-w-[160px] max-h-[120px] rounded-lg object-cover cursor-pointer hover:opacity-90"
          onError={() => setImgError(true)} onClick={handleDownload} />
        <button onClick={handleDownload} disabled={downloading}
          className={`flex items-center gap-1 text-[10px] mt-0.5 opacity-60 hover:opacity-100 ${isMe ? "text-blue-100" : "text-gray-500"}`}>
          {downloading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
          {displayName}
        </button>
      </div>
    );
  }
  return (
    <button onClick={handleDownload} disabled={downloading}
      className={`flex items-center gap-2 mt-1 px-2 py-1.5 rounded-lg text-left w-full transition-colors ${
        isMe ? "bg-blue-500 hover:bg-blue-400" : "bg-gray-200 hover:bg-gray-300"
      }`}>
      <span className="flex-shrink-0">
        {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileIcon mime={msg.fileMimeType} />}
      </span>
      <div className="min-w-0">
        <div className="truncate text-xs font-medium">{displayName}</div>
        <div className="text-[10px] opacity-60">{humanSize(msg.fileSize)} · {downloading ? "Saving..." : "Download"}</div>
      </div>
    </button>
  );
}

// ── Helper: get clientX/Y from mouse or touch ──────────────────────────────
function getXY(e: MouseEvent | TouchEvent): { x: number; y: number } {
  if ("touches" in e && e.touches.length > 0)
    return { x: e.touches[0].clientX, y: e.touches[0].clientY };
  if ("changedTouches" in e && e.changedTouches.length > 0)
    return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
  return { x: (e as MouseEvent).clientX, y: (e as MouseEvent).clientY };
}

export default function SupportChatWidget({ supportEmail, supportPhone }: {
  supportEmail?: string; supportPhone?: string;
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [meta] = useState<Meta>(() => {
    try { return JSON.parse(localStorage.getItem(META_KEY) || "{}"); } catch { return {}; }
  });
  const [form, setForm] = useState({ name: meta.name || "", phone: meta.phone || "", email: meta.email || "", message: "" });
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasHistory, setHasHistory] = useState(false);
  const [unread, setUnread] = useState(false);

  // Position & size state
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [size, setSize] = useState({ w: DEF_W, h: DEF_H });

  const dragRef  = useRef<{ sx: number; sy: number; px: number; py: number } | null>(null);
  const resizeRef = useRef<{ sx: number; sy: number; sw: number; sh: number } | null>(null);
  const uploadAbortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sessionId = getSessionId();

  const defaultPos = () => ({
    x: window.innerWidth  - size.w - 20,
    y: window.innerHeight - size.h - 80,
  });
  const panelPos = pos ?? defaultPos();

  // ── DRAG (header) — mouse + touch ────────────────────────────────────────
  const startDrag = (e: React.MouseEvent | React.TouchEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    const { x, y } = getXY(e.nativeEvent as MouseEvent | TouchEvent);
    dragRef.current = { sx: x, sy: y, px: panelPos.x, py: panelPos.y };

    const onMove = (ev: MouseEvent | TouchEvent) => {
      if (!dragRef.current) return;
      const { x: cx, y: cy } = getXY(ev);
      setPos({
        x: Math.max(0, Math.min(window.innerWidth  - size.w, dragRef.current.px + cx - dragRef.current.sx)),
        y: Math.max(0, Math.min(window.innerHeight - 80,     dragRef.current.py + cy - dragRef.current.sy)),
      });
    };
    const onUp = () => {
      dragRef.current = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("mouseup",   onUp);
      document.removeEventListener("touchend",  onUp);
    };
    document.addEventListener("mousemove", onMove, { passive: false });
    document.addEventListener("touchmove",  onMove, { passive: false });
    document.addEventListener("mouseup",   onUp);
    document.addEventListener("touchend",  onUp);
  };

  // ── RESIZE (bottom-right handle) — mouse + touch ─────────────────────────
  const startResize = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const { x, y } = getXY(e.nativeEvent as MouseEvent | TouchEvent);
    resizeRef.current = { sx: x, sy: y, sw: size.w, sh: size.h };

    const onMove = (ev: MouseEvent | TouchEvent) => {
      if (!resizeRef.current) return;
      const { x: cx, y: cy } = getXY(ev);
      setSize({
        w: Math.min(MAX_W, Math.max(MIN_W, resizeRef.current.sw + cx - resizeRef.current.sx)),
        h: Math.min(MAX_H, Math.max(MIN_H, resizeRef.current.sh + cy - resizeRef.current.sy)),
      });
    };
    const onUp = () => {
      resizeRef.current = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("touchmove",  onMove);
      document.removeEventListener("mouseup",   onUp);
      document.removeEventListener("touchend",  onUp);
    };
    document.addEventListener("mousemove", onMove, { passive: false });
    document.addEventListener("touchmove",  onMove, { passive: false });
    document.addEventListener("mouseup",   onUp);
    document.addEventListener("touchend",  onUp);
  };

  // ── Data ────────────────────────────────────────────────────────────────
  const fetchMessages = async () => {
    setFetchLoading(true);
    try {
      const rows = await api.get<Message[]>(`/support-chat/messages/${sessionId}`);
      setMessages(rows);
      if (rows.length > 0) setHasHistory(true);
      if (rows.some(r => r.senderType === "admin") && !open) setUnread(true);
    } catch { /* silent */ }
    finally { setFetchLoading(false); }
  };

  useEffect(() => { fetchMessages(); }, []);
  useEffect(() => {
    if (open) { setUnread(false); fetchMessages(); setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100); }
  }, [open]);
  useEffect(() => {
    if (open) setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
  }, [messages.length]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.message.trim()) return;
    setLoading(true); setError("");
    try {
      await api.post("/support-chat/messages", {
        sessionId, name: form.name.trim() || "Anonymous",
        phone: form.phone.trim(), email: form.email.trim(), message: form.message.trim(),
      });
      localStorage.setItem(META_KEY, JSON.stringify({ name: form.name, phone: form.phone, email: form.email }));
      setForm(f => ({ ...f, message: "" }));
      await fetchMessages();
    } catch { setError("Message send nahi hua, dobara try karo."); }
    setLoading(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true); setUploadProgress(`${file.name} upload ho raha hai...`);
    const abort = new AbortController();
    uploadAbortRef.current = abort;
    try {
      const fd = new FormData();
      fd.append("file", file); fd.append("sessionId", sessionId);
      fd.append("name", form.name || "Anonymous");
      fd.append("phone", form.phone || ""); fd.append("email", form.email || "");
      const res = await fetch("/api/support-chat/messages/file", { method: "POST", body: fd, signal: abort.signal });
      if (!res.ok) throw new Error("Upload failed");
      await fetchMessages();
    } catch (err: unknown) {
      if ((err as Error).name !== "AbortError") setError("File upload nahi hui");
    } finally {
      uploadAbortRef.current = null; setLoading(false); setUploadProgress(null);
    }
    e.target.value = "";
  };

  const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";
  const msgAreaH = size.h - 52 /* header */ - (hasHistory ? 0 : 100) /* meta inputs */ - 56 /* form */ - (uploadProgress ? 32 : 0);

  return (
    <>
      {/* Floating button */}
      <button onClick={() => setOpen(o => !o)}
        className="fixed z-50 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95"
        style={{ width: 52, height: 52, right: 20, bottom: 20 }}
        aria-label="Support Chat" title="Help / Support">
        {open ? <ChevronDown className="w-5 h-5" /> : <>
          <MessageCircle className="w-5 h-5" />
          {unread && <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] flex items-center justify-center font-bold">!</span>}
        </>}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed z-50 bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden"
          style={{ left: panelPos.x, top: panelPos.y, width: size.w, height: size.h }}>

          {/* Header — drag handle (mouse + touch) */}
          <div className="bg-blue-600 text-white px-4 py-3 flex items-center justify-between cursor-grab active:cursor-grabbing select-none flex-shrink-0"
            onMouseDown={startDrag} onTouchStart={startDrag}>
            <div>
              <div className="font-semibold text-sm">Support Chat</div>
              <div className="text-xs text-blue-100">Hum jald jawab denge</div>
            </div>
            <button onClick={() => setOpen(false)} className="text-blue-200 hover:text-white transition-colors cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="overflow-y-auto p-3 space-y-2 flex-1 min-h-0"
            style={{ maxHeight: Math.max(120, msgAreaH) }}>
            {fetchLoading && messages.length === 0 && (
              <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-blue-400" /></div>
            )}
            {!fetchLoading && messages.length === 0 && (
              <div className="text-center py-4">
                <div className="text-gray-500 text-sm">Koi sawaal hai? Hum madad karenge!</div>
                {(supportPhone || supportEmail) && (
                  <div className="text-xs text-gray-400 mt-2 space-y-0.5">
                    {supportPhone && <div>📞 {supportPhone}</div>}
                    {supportEmail && <div>✉️ {supportEmail}</div>}
                  </div>
                )}
              </div>
            )}
            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.senderType === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                  msg.senderType === "user" ? "bg-blue-600 text-white rounded-br-sm" : "bg-gray-100 text-gray-800 rounded-bl-sm"
                }`}>
                  {msg.senderType === "admin" && <div className="text-xs font-semibold text-blue-600 mb-0.5">Support Team</div>}
                  {msg.message && <div>{msg.message}</div>}
                  <FilePreview msg={msg} />
                  <div className={`text-[10px] mt-0.5 ${msg.senderType === "user" ? "text-blue-200" : "text-gray-400"}`}>
                    {new Date(msg.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Upload progress */}
          {uploadProgress && (
            <div className="px-3 py-1.5 bg-blue-50 flex items-center gap-2 text-xs text-blue-700 border-t border-blue-100 flex-shrink-0">
              <Loader2 className="w-3 h-3 animate-spin flex-shrink-0" />
              <span className="flex-1 truncate">{uploadProgress}</span>
              <button onClick={() => uploadAbortRef.current?.abort()}
                className="flex items-center gap-0.5 text-red-500 hover:text-red-600 flex-shrink-0 font-medium">
                <XCircle className="w-3.5 h-3.5" /> Cancel
              </button>
            </div>
          )}

          {/* Input form */}
          <form onSubmit={handleSend} className="border-t border-gray-100 p-3 space-y-2 bg-gray-50 flex-shrink-0">
            {!hasHistory && (
              <div className="grid grid-cols-2 gap-2">
                <input className={inputCls} placeholder="Aapka naam" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                <input className={inputCls} placeholder="Phone" value={form.phone} type="tel"
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                <input className={`${inputCls} col-span-2`} placeholder="Email (optional)" value={form.email} type="email"
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
            )}
            <div className="flex gap-2 items-center">
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={loading}
                className="text-gray-400 hover:text-blue-500 transition-colors flex-shrink-0 disabled:opacity-50" title="File attach karo">
                <Paperclip className="w-5 h-5" />
              </button>
              <input className={`${inputCls} flex-1`} placeholder="Message likhiye..."
                value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(e as unknown as React.FormEvent); } }} />
              <button type="submit" disabled={loading || !form.message.trim()}
                className="w-9 h-9 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center justify-center disabled:opacity-50 transition-colors shrink-0">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
            {error && <div className="text-xs text-red-500">{error}</div>}
          </form>

          {/* Resize handle — bottom-right corner (mouse + touch) */}
          <div
            className="absolute bottom-0 right-0 w-6 h-6 flex items-end justify-end cursor-se-resize touch-none z-10"
            onMouseDown={startResize} onTouchStart={startResize}
            title="Resize">
            <GripHorizontal className="w-4 h-4 text-gray-300 mb-0.5 mr-0.5 rotate-45" />
          </div>
        </div>
      )}

      <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} />
    </>
  );
}
