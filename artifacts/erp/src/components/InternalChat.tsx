import { useCallback, useEffect, useRef, useState } from "react";
import { MessageSquare, X, Send, Loader2, Paperclip, Download, Trash2, ChevronDown } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type ChatMsg = {
  id: number;
  businessId: number;
  fromUserId: number;
  fromUserName: string;
  message: string | null;
  fileData: string | null;
  fileName: string | null;
  fileMimeType: string | null;
  fileSize: number | null;
  createdAt: string;
};

const POLL_MS = 3000;
const MAX_FILE_MB = 2;

function formatTime(d: string) {
  return new Date(d).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

function isImage(mime: string | null) {
  return mime?.startsWith("image/") ?? false;
}

function FilePreview({ msg }: { msg: ChatMsg }) {
  if (!msg.fileData) return null;
  if (isImage(msg.fileMimeType)) {
    return (
      <a href={msg.fileData} download={msg.fileName ?? "image"} target="_blank" rel="noopener noreferrer">
        <img
          src={msg.fileData}
          alt={msg.fileName ?? "image"}
          className="max-w-[180px] max-h-[180px] rounded-lg object-cover border border-white/20 mt-1 cursor-pointer hover:opacity-90 transition-opacity"
        />
      </a>
    );
  }
  const sizeKB = msg.fileSize ? `${(msg.fileSize / 1024).toFixed(0)} KB` : "";
  return (
    <a
      href={msg.fileData}
      download={msg.fileName ?? "file"}
      className="flex items-center gap-2 mt-1 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-sm max-w-[200px]"
    >
      <Download className="w-4 h-4 flex-shrink-0" />
      <div className="min-w-0">
        <div className="truncate font-medium">{msg.fileName ?? "file"}</div>
        {sizeKB && <div className="text-[10px] opacity-70">{sizeKB}</div>}
      </div>
    </a>
  );
}

export default function InternalChat() {
  const { user, isSuperAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [unread, setUnread] = useState(0);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const lastIdRef = useRef(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Don't show for super admins
  if (isSuperAdmin()) return null;

  const scrollToBottom = useCallback((smooth = true) => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" }), 60);
  }, []);

  const loadRecent = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await api.get<ChatMsg[]>("/chat/messages/recent");
      setMessages(rows);
      if (rows.length > 0) lastIdRef.current = rows[rows.length - 1].id;
      scrollToBottom(false);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [scrollToBottom]);

  const pollNew = useCallback(async () => {
    try {
      const rows = await api.get<ChatMsg[]>(`/chat/messages?since=${lastIdRef.current}`);
      if (rows.length > 0) {
        lastIdRef.current = rows[rows.length - 1].id;
        setMessages(prev => [...prev, ...rows]);
        if (!open) setUnread(u => u + rows.length);
        else scrollToBottom();
      }
    } catch { /* ignore */ }
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

  const sendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      const row = await api.post<ChatMsg>("/chat/messages", { message: text.trim() });
      setMessages(prev => [...prev, row]);
      lastIdRef.current = row.id;
      setText("");
      scrollToBottom();
    } catch { /* ignore */ }
    finally { setSending(false); }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      alert(`File bahut badi hai — max ${MAX_FILE_MB}MB allowed`);
      return;
    }
    setSending(true);
    try {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const fileData = ev.target?.result as string;
        try {
          const row = await api.post<ChatMsg>("/chat/messages", {
            fileData,
            fileName: file.name,
            fileMimeType: file.type,
            fileSize: file.size,
          });
          setMessages(prev => [...prev, row]);
          lastIdRef.current = row.id;
          scrollToBottom();
        } catch { /* ignore */ }
        finally { setSending(false); }
      };
      reader.readAsDataURL(file);
    } catch { setSending(false); }
    e.target.value = "";
  };

  const deleteMsg = async (id: number) => {
    try {
      await api.delete(`/chat/messages/${id}`);
      setMessages(prev => prev.filter(m => m.id !== id));
    } catch { /* ignore */ }
  };

  // Group messages by date
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
      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-5 right-5 z-40 flex items-center justify-center bg-emerald-600 hover:bg-emerald-700 text-white rounded-full shadow-lg transition-all hover:scale-105 active:scale-95"
        style={{ width: 52, height: 52 }}
        aria-label="Staff Chat"
        title="Staff Chat"
      >
        {open
          ? <ChevronDown className="w-5 h-5" />
          : <>
              <MessageSquare className="w-5 h-5" />
              {unread > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-[10px] font-bold flex items-center justify-center">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </>
        }
      </button>

      {/* Chat Drawer */}
      {open && (
        <div
          className="fixed bottom-20 right-5 z-40 flex flex-col bg-slate-900 rounded-2xl shadow-2xl border border-slate-700 overflow-hidden"
          style={{ width: 340, height: 480 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-slate-800 border-b border-slate-700 flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              <span className="text-white font-semibold text-sm">Staff Chat</span>
              <span className="text-slate-400 text-xs">— sirf aapki team</span>
            </div>
            <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-1 min-h-0">
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
                      className={`flex mb-0.5 group ${isMe ? "justify-end" : "justify-start"}`}
                      onMouseEnter={() => setHoveredId(msg.id)}
                      onMouseLeave={() => setHoveredId(null)}
                    >
                      <div className={`max-w-[78%] ${isMe ? "items-end" : "items-start"} flex flex-col`}>
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
                          <div className={`text-[10px] mt-1 ${isMe ? "text-emerald-200" : "text-slate-400"}`}>
                            {formatTime(msg.createdAt)}
                          </div>

                          {isMe && hoveredId === msg.id && (
                            <button
                              onClick={() => deleteMsg(msg.id)}
                              className="absolute -top-2 -left-2 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-colors"
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

          {/* Input */}
          <div className="border-t border-slate-700 p-3 bg-slate-800 flex-shrink-0">
            <form onSubmit={sendMessage} className="flex items-end gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={sending}
                className="text-slate-400 hover:text-emerald-400 transition-colors flex-shrink-0 pb-1 disabled:opacity-50"
                title="File attach karo"
              >
                <Paperclip className="w-5 h-5" />
              </button>
              <textarea
                ref={textareaRef}
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
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
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip"
        className="hidden"
        onChange={handleFileChange}
      />
    </>
  );
}
