import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import {
  Loader2, MessageCircle, Send, User, Phone, Mail, Clock,
  CheckCircle2, MessageSquare, ArrowLeft, File, FileImage, FileVideo, FileAudio, FileText, Download
} from "lucide-react";

type Message = {
  id: number;
  sessionId: string;
  senderType: "user" | "admin";
  name: string | null;
  phone: string | null;
  email: string | null;
  message: string | null;
  filePath: string | null;
  fileName: string | null;
  fileMimeType: string | null;
  fileSize: number | null;
  status: string;
  createdAt: string;
};

type Session = {
  sessionId: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  latestMessage: string;
  status: string;
  createdAt: string;
  replyCount: number;
  messages: Message[];
};

function statusBadge(status: string) {
  if (status === "replied") return <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">Replied</span>;
  if (status === "read") return <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">Read</span>;
  return <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">New</span>;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function humanSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function MsgFilePreview({ msg }: { msg: Message }) {
  const [downloading, setDownloading] = useState(false);
  const [imgError, setImgError] = useState(false);
  if (!msg.filePath || !msg.fileName) return null;

  const fileUrl = msg.fileName.startsWith("http") ? msg.fileName : null;
  if (!fileUrl) return null;

  const displayName = msg.filePath.split("/").pop()?.replace(/^\d+_/, "") ?? "file";
  const mime = msg.fileMimeType ?? "";
  const isImg = mime.startsWith("image/");
  const isVid = mime.startsWith("video/");
  const isAud = mime.startsWith("audio/");
  const isPdf = mime === "application/pdf";

  const FileIcon = isImg ? FileImage : isVid ? FileVideo : isAud ? FileAudio : isPdf ? FileText : File;

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

  const isUser = msg.senderType === "user";

  if (isImg && !imgError) {
    return (
      <div className="mt-1">
        <img src={fileUrl} alt={displayName}
          className="max-w-[180px] max-h-[140px] rounded-lg object-cover cursor-pointer hover:opacity-90"
          onError={() => setImgError(true)} onClick={handleDownload} />
        <button onClick={handleDownload} disabled={downloading}
          className={`flex items-center gap-1 text-[10px] mt-0.5 opacity-60 hover:opacity-100 ${isUser ? "text-gray-400" : "text-blue-200"}`}>
          {downloading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
          {displayName}
        </button>
      </div>
    );
  }

  return (
    <button onClick={handleDownload} disabled={downloading}
      className={`flex items-center gap-2 mt-1 px-2 py-1.5 rounded-lg text-left w-full transition-colors ${
        isUser ? "bg-gray-200 hover:bg-gray-300 text-gray-800" : "bg-blue-500 hover:bg-blue-400 text-white"
      }`}>
      <span className="flex-shrink-0">
        {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileIcon className="w-4 h-4" />}
      </span>
      <div className="min-w-0">
        <div className="truncate text-xs font-medium">{displayName}</div>
        <div className="text-[10px] opacity-60">{humanSize(msg.fileSize)} · {downloading ? "Saving..." : "Download"}</div>
      </div>
    </button>
  );
}

// ─── Session List ──────────────────────────────────────────────────────────────
function SessionList({ sessions, selected, onSelect, onRefresh }: {
  sessions: Session[];
  selected: Session | null;
  onSelect: (s: Session) => void;
  onRefresh: () => void;
}) {
  const newCount = sessions.filter(s => s.status === "new").length;
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <div>
          <span className="font-semibold text-sm text-gray-800">{sessions.length} conversations</span>
          {newCount > 0 && (
            <span className="ml-2 px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs font-semibold">{newCount} new</span>
          )}
        </div>
        <button onClick={onRefresh} className="text-xs text-blue-600 hover:text-blue-700 font-medium">Refresh</button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {sessions.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <div className="text-sm font-medium">Abhi koi message nahi</div>
          </div>
        ) : sessions.map(s => (
          <button key={s.sessionId} onClick={() => onSelect(s)}
            className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
              selected?.sessionId === s.sessionId ? "bg-blue-50 border-l-4 border-l-blue-500" : ""
            }`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-gray-500" />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-sm text-gray-900 truncate">{s.name || "Anonymous"}</div>
                  <div className="text-xs text-gray-500 truncate max-w-[160px]">{s.latestMessage || "File"}</div>
                </div>
              </div>
              <div className="flex-shrink-0 text-right">
                {statusBadge(s.status)}
                <div className="text-[10px] text-gray-400 mt-1">{timeAgo(s.createdAt)}</div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Chat Detail ───────────────────────────────────────────────────────────────
function ChatDetail({ session, onBack, onReply }: {
  session: Session;
  onBack: () => void;
  onReply: (sessionId: string, msg: string) => Promise<void>;
}) {
  const [replyText, setReplyText] = useState("");
  const [replying, setReplying] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
  }, [session.messages.length]);

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) return;
    setReplying(true);
    await onReply(session.sessionId, replyText.trim());
    setReplyText("");
    setReplying(false);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-3">
        <button onClick={onBack} className="md:hidden text-gray-500 hover:text-gray-700 flex-shrink-0">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
          <User className="w-4 h-4 text-blue-600" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-sm text-gray-900">{session.name || "Anonymous"}</div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 mt-0.5">
            {session.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{session.phone}</span>}
            {session.email && <span className="flex items-center gap-1 truncate max-w-[140px]"><Mail className="w-3 h-3" />{session.email}</span>}
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{timeAgo(session.createdAt)}</span>
          </div>
        </div>
        <div className="flex-shrink-0">{statusBadge(session.status)}</div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {session.messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.senderType === "user" ? "justify-start" : "justify-end"}`}>
            <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
              msg.senderType === "user"
                ? "bg-gray-100 text-gray-800 rounded-bl-sm"
                : "bg-blue-600 text-white rounded-br-sm"
            }`}>
              {msg.senderType === "admin" && (
                <div className="text-[10px] text-blue-200 mb-0.5 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> You (Support)
                </div>
              )}
              {msg.message && <div>{msg.message}</div>}
              <MsgFilePreview msg={msg} />
              <div className={`text-[10px] mt-0.5 ${msg.senderType === "user" ? "text-gray-400" : "text-blue-200"}`}>
                {new Date(msg.createdAt).toLocaleString("en-IN", {
                  hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short"
                })}
              </div>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Reply */}
      <form onSubmit={handleReply} className="p-3 border-t border-gray-100 flex gap-2">
        <input
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Reply likhiye..."
          value={replyText}
          onChange={e => setReplyText(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleReply(e as unknown as React.FormEvent); } }}
        />
        <button type="submit" disabled={replying || !replyText.trim()}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium flex items-center gap-1.5 disabled:opacity-50 transition-colors">
          {replying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          <span className="hidden sm:inline">Send</span>
        </button>
      </form>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function AdminSupportMessages() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Session | null>(null);
  // On mobile, show chat view when a session is selected
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");

  const fetchSessions = async () => {
    try {
      const data = await api.get<Session[]>("/super-admin/support-messages");
      setSessions(data);
      if (selected) {
        const updated = data.find(s => s.sessionId === selected.sessionId);
        if (updated) setSelected(updated);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchSessions(); }, []);

  const handleSelect = async (session: Session) => {
    setSelected(session);
    setMobileView("chat");
    if (session.status === "new") {
      try {
        await api.patch(`/super-admin/support-messages/${session.sessionId}/read`, {});
        setSessions(ss => ss.map(s => s.sessionId === session.sessionId ? { ...s, status: "read" } : s));
      } catch { /* ignore */ }
    }
  };

  const handleReply = async (sessionId: string, msg: string) => {
    try {
      await api.post(`/super-admin/support-messages/${sessionId}/reply`, { message: msg });
      await fetchSessions();
    } catch { /* ignore */ }
  };

  const handleBack = () => setMobileView("list");

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
    </div>
  );

  return (
    <div className="max-w-5xl">
      {/* Page header */}
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-blue-600" />
          Support Messages
        </h1>
        <button onClick={fetchSessions}
          className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600">
          Refresh
        </button>
      </div>

      {/* Two-column on md+, single-column with stack on mobile */}
      <div
        className="bg-white border border-gray-200 rounded-xl overflow-hidden"
        style={{ height: "calc(100vh - 200px)", minHeight: 400 }}
      >
        <div className="flex h-full">

          {/* Left: session list — hidden on mobile when chat is open */}
          <div className={`
            w-full md:w-72 md:flex-shrink-0 border-r border-gray-100 h-full
            ${mobileView === "chat" ? "hidden md:block" : "block"}
          `}>
            <SessionList
              sessions={sessions}
              selected={selected}
              onSelect={handleSelect}
              onRefresh={fetchSessions}
            />
          </div>

          {/* Right: chat detail — hidden on mobile when list is shown */}
          <div className={`
            flex-1 h-full
            ${mobileView === "list" ? "hidden md:flex md:flex-col" : "flex flex-col"}
          `}>
            {!selected ? (
              <div className="flex-1 flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <MessageCircle className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <div className="text-sm">Koi conversation select karo</div>
                </div>
              </div>
            ) : (
              <ChatDetail
                session={selected}
                onBack={handleBack}
                onReply={handleReply}
              />
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
