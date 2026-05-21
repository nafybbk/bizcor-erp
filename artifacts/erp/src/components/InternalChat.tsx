import { useCallback, useEffect, useRef, useState } from "react";
import { MessageSquare, X, Send, Loader2, Paperclip, Download, Trash2, File, GripHorizontal } from "lucide-react";
import { getToken } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type ChatMsg = {
  id: number;
  businessId: number;
  fromUserId: number;
  fromUserName: string;
  message: string | null;
  filePath: string | null;
  fileName: string | null;
  fileMimeType: string | null;
  fileSize: number | null;
  createdAt: string;
};

const POLL_MS = 3000;
const BASE = "/api";

async function chatFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, ...(opts?.headers || {}) },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

function formatTime(d: string) {
  return new Date(d).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}
function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}
function isImage(mime: string | null) {
  return mime?.startsWith("image/") ?? false;
}
function humanSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function fileUrl(filePath: string) {
  const token = getToken();
  return `${BASE}/chat/files/${encodeURIComponent(filePath)}?t=${token}`;
}

function FilePreview({ msg }: { msg: ChatMsg }) {
  if (!msg.filePath) return null;
  const url = fileUrl(msg.filePath);

  if (isImage(msg.fileMimeType)) {
    return (
      <a href={url} download={msg.fileName ?? "image"} target="_blank" rel="noopener noreferrer">
        <img
          src={url}
          alt={msg.fileName ?? "image"}
          className="max-w-[200px] max-h-[200px] rounded-lg object-cover border border-white/20 mt-1 cursor-pointer hover:opacity-90 transition-opacity"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
      </a>
    );
  }

  return (
    <a
      href={url}
      download={msg.fileName ?? "file"}
      className="flex items-center gap-2 mt-1 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors max-w-[220px]"
    >
      <File className="w-5 h-5 flex-shrink-0 opacity-80" />
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{msg.fileName ?? "file"}</div>
        <div className="text-[10px] opacity-60 flex items-center gap-1">
          {humanSize(msg.fileSize)}
          <Download className="w-3 h-3" />
        </div>
      </div>
    </a>
  );
}

export default function InternalChat({ open, onToggle, onUnreadChange }: {
  open: boolean;
  onToggle: () => void;
  onUnreadChange?: (n: number) => void;
}) {
  const { user, isSuperAdmin, logout } = useAuth();
  const [sendError, setSendError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [unread, setUnread] = useState(0);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);
  const [chatSize, setChatSize] = useState({ w: 340, h: 480 });
  const resizeDragRef = useRef<{ startX: number; startY: number; startW: number; startH: number } | null>(null);
  const lastIdRef = useRef(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch(`${BASE}/healthz`).then(r => r.json()).then((d: any) => {
      setIsDesktop(d?.mode === "desktop");
    }).catch(() => {});
  }, []);

  // Notify parent of unread count changes
  useEffect(() => { onUnreadChange?.(unread); }, [unread]);

  // Resize drag handler
  const onResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    resizeDragRef.current = { startX: e.clientX, startY: e.clientY, startW: chatSize.w, startH: chatSize.h };
    const onMove = (me: MouseEvent) => {
      if (!resizeDragRef.current) return;
      const dw = me.clientX - resizeDragRef.current.startX;
      const dh = me.clientY - resizeDragRef.current.startY;
      setChatSize({
        w: Math.max(260, Math.min(700, resizeDragRef.current.startW + dw)),
        h: Math.max(280, Math.min(window.innerHeight - 80, resizeDragRef.current.startH + dh)),
      });
    };
    const onUp = () => {
      resizeDragRef.current = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  if (isSuperAdmin()) return null;

  const scrollToBottom = useCallback((smooth = true) => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" }), 60);
  }, []);

  const loadRecent = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await chatFetch<ChatMsg[]>("/chat/messages/recent");
      setMessages(rows);
      if (rows.length > 0) lastIdRef.current = rows[rows.length - 1].id;
      scrollToBottom(false);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [scrollToBottom]);

  const pollNew = useCallback(async () => {
    try {
      const rows = await chatFetch<ChatMsg[]>(`/chat/messages?since=${lastIdRef.current}`);
      if (rows.length > 0) {
        lastIdRef.current = rows[rows.length - 1].id;
        setMessages(prev => [...prev, ...rows]);
        if (!open) setUnread(u => u + rows.length);
        else scrollToBottom();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("401") || msg.toLowerCase().includes("unauthorized")) {
        handle401();
      }
    }
  }, [open, scrollToBottom]);

  useEffect(() => {
    if (!user?.businessId) return;
    loadRecent();
    pollRef.current = setInterval(pollNew, POLL_MS);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [user?.businessId]);

  useEffect(() => {
    if (open) {
      setUnread(0);
      scrollToBottom(false);
      setTimeout(() => textareaRef.current?.focus(), 150);
    }
  }, [open]);

  const handle401 = () => {
    setSendError("Session expire ho gayi — dobara login karein");
    if (pollRef.current) clearInterval(pollRef.current);
    setTimeout(() => { logout(); }, 2000);
  };

  const sendText = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    setSendError(null);
    try {
      const row = await chatFetch<ChatMsg>("/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text.trim() }),
      });
      setMessages(prev => [...prev, row]);
      lastIdRef.current = row.id;
      setText("");
      scrollToBottom();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("401") || msg.toLowerCase().includes("unauthorized") || msg.toLowerCase().includes("session")) {
        handle401();
      } else {
        setSendError("Message nahi gaya — dobara try karein");
        setTimeout(() => setSendError(null), 4000);
      }
    } finally { setSending(false); }
  };

  const sendFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSending(true);
    setUploadProgress(`Uploading ${file.name} (${humanSize(file.size)})...`);

    try {
      const token = getToken();
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${BASE}/chat/messages/file`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) throw new Error(await res.text());
      const row: ChatMsg = await res.json();
      setMessages(prev => [...prev, row]);
      lastIdRef.current = row.id;
      scrollToBottom();
    } catch { /* ignore */ }
    finally {
      setSending(false);
      setUploadProgress(null);
    }
    e.target.value = "";
  };

  const deleteMsg = async (id: number) => {
    try {
      await chatFetch(`/chat/messages/${id}`, { method: "DELETE" });
      setMessages(prev => prev.filter(m => m.id !== id));
    } catch { /* ignore */ }
  };

  // Group by date
  const grouped: { date: string; msgs: ChatMsg[] }[] = [];
  for (const msg of messages) {
    const d = formatDate(msg.createdAt);
    if (!grouped.length || grouped[grouped.length - 1].date !== d) {
      grouped.push({ date: d, msgs: [msg] });
    } else {
      grouped[grouped.length - 1].msgs.push(msg);
    }
  }

  return (
    <>
      {/* Chat Panel — opens below topbar on the right */}
      {open && (
        <div
          className="fixed z-50 flex flex-col bg-slate-900 shadow-2xl border border-slate-700 rounded-2xl overflow-hidden print:hidden select-none"
          style={{ top: 52, right: 8, width: chatSize.w, height: chatSize.h, maxWidth: "calc(100vw - 16px)", maxHeight: "calc(100vh - 60px)" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-slate-800 border-b border-slate-700 flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              <span className="text-white font-semibold text-sm">Staff Chat</span>
              <span className="text-slate-400 text-xs">— sirf aapki team</span>
            </div>
            <button onClick={onToggle} className="text-slate-400 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 min-h-0">
            {loading && (
              <div className="flex justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
              </div>
            )}
            {!loading && messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-slate-500 text-sm gap-2">
                <MessageSquare className="w-8 h-8 opacity-30" />
                <div>Abhi koi message nahi</div>
                <div className="text-xs text-slate-600">Team ke saath baat karo!</div>
              </div>
            )}

            {grouped.map(({ date, msgs }) => (
              <div key={date}>
                <div className="flex items-center gap-2 my-2">
                  <div className="flex-1 h-px bg-slate-700" />
                  <span className="text-[10px] text-slate-500 px-2">{date}</span>
                  <div className="flex-1 h-px bg-slate-700" />
                </div>
                {msgs.map((msg, i) => {
                  const isMe = msg.fromUserId === user?.id;
                  const prevMsg = i > 0 ? msgs[i - 1] : null;
                  const showName = !prevMsg || prevMsg.fromUserId !== msg.fromUserId;

                  return (
                    <div
                      key={msg.id}
                      className={`flex mb-1 group ${isMe ? "justify-end" : "justify-start"}`}
                      onMouseEnter={() => setHoveredId(msg.id)}
                      onMouseLeave={() => setHoveredId(null)}
                    >
                      <div className={`max-w-[80%] ${isMe ? "items-end" : "items-start"} flex flex-col`}>
                        {showName && !isMe && (
                          <span className="text-[10px] text-emerald-400 font-medium px-1 mb-0.5">{msg.fromUserName}</span>
                        )}
                        <div className={`relative rounded-2xl px-3 py-2 text-sm ${
                          isMe
                            ? "bg-emerald-600 text-white rounded-br-sm"
                            : "bg-slate-700 text-slate-100 rounded-bl-sm"
                        }`}>
                          {msg.message && <div className="whitespace-pre-wrap break-words">{msg.message}</div>}
                          <FilePreview msg={msg} />
                          <div className={`text-[10px] mt-0.5 ${isMe ? "text-emerald-200" : "text-slate-400"}`}>
                            {formatTime(msg.createdAt)}
                          </div>

                          {isMe && hoveredId === msg.id && (
                            <button
                              onClick={() => deleteMsg(msg.id)}
                              className="absolute -top-2 -left-2 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-colors shadow"
                              title="Delete"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Upload progress */}
          {uploadProgress && (
            <div className="px-4 py-1.5 bg-slate-700 flex items-center gap-2 text-xs text-slate-300 flex-shrink-0">
              <Loader2 className="w-3 h-3 animate-spin" />
              {uploadProgress}
            </div>
          )}

          {/* Input */}
          <div className="border-t border-slate-700 p-3 bg-slate-800 flex-shrink-0">
            <form onSubmit={sendText} className="flex items-end gap-2">
              {isDesktop && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={sending}
                  className="text-slate-400 hover:text-emerald-400 transition-colors flex-shrink-0 pb-1 disabled:opacity-50"
                  title="Koi bhi file attach karo — koi limit nahi"
                >
                  <Paperclip className="w-5 h-5" />
                </button>
              )}
              <textarea
                ref={textareaRef}
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendText();
                  }
                }}
                rows={1}
                placeholder="Message likhiye... (Enter = send)"
                className="flex-1 bg-slate-700 text-white placeholder-slate-400 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-emerald-500 max-h-24 overflow-y-auto"
                style={{ minHeight: 36 }}
              />
              <button
                type="submit"
                disabled={!text.trim() || sending}
                className="w-9 h-9 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl flex items-center justify-center disabled:opacity-40 transition-colors flex-shrink-0"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </form>
          {/* Send error banner */}
          {sendError && (
            <div className="px-3 py-2 bg-red-900/80 text-red-200 text-xs flex items-center gap-2 flex-shrink-0">
              <span>⚠️ {sendError}</span>
            </div>
          )}
          </div>

          {/* Resize handle — bottom-right drag corner */}
          <div
            onMouseDown={onResizeMouseDown}
            className="absolute bottom-0 right-0 w-6 h-6 flex items-end justify-end pb-1 pr-1 cursor-se-resize text-slate-500 hover:text-slate-300 z-10"
            title="Drag to resize"
          >
            <GripHorizontal className="w-3.5 h-3.5 rotate-45" />
          </div>
        </div>
      )}

      {/* Hidden file input — no accept filter, no size limit */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={sendFile}
      />
    </>
  );
}
