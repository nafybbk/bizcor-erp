import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { Loader2, MessageCircle, Send, User, Phone, Mail, Clock, CheckCircle2, MessageSquare } from "lucide-react";

type Message = {
  id: number;
  sessionId: string;
  senderType: "user" | "admin";
  name: string | null;
  phone: string | null;
  email: string | null;
  message: string;
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

export default function AdminSupportMessages() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Session | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replying, setReplying] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (selected) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
    }
  }, [selected?.messages.length]);

  const handleSelect = async (session: Session) => {
    setSelected(session);
    setReplyText("");
    if (session.status === "new") {
      try {
        await api.patch(`/super-admin/support-messages/${session.sessionId}/read`, {});
        setSessions(ss => ss.map(s => s.sessionId === session.sessionId ? { ...s, status: "read" } : s));
      } catch { /* ignore */ }
    }
  };

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !replyText.trim()) return;
    setReplying(true);
    try {
      await api.post(`/super-admin/support-messages/${selected.sessionId}/reply`, { message: replyText.trim() });
      setReplyText("");
      await fetchSessions();
    } catch { /* ignore */ }
    finally { setReplying(false); }
  };

  const newCount = sessions.filter(s => s.status === "new").length;

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
    </div>
  );

  return (
    <div className="max-w-5xl">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <MessageCircle className="w-6 h-6 text-blue-600" />
            Support Messages
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {sessions.length} conversations
            {newCount > 0 && <span className="ml-2 px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs font-semibold">{newCount} new</span>}
          </p>
        </div>
        <button onClick={fetchSessions} className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600">
          Refresh
        </button>
      </div>

      {sessions.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <div className="font-medium">Abhi koi message nahi hai</div>
          <div className="text-sm mt-1">Login page pe "?" button se users contact kar sakte hain</div>
        </div>
      ) : (
        <div className="flex gap-4" style={{ height: "calc(100vh - 220px)", minHeight: 400 }}>
          <div className="w-72 flex-shrink-0 bg-white border border-gray-200 rounded-xl overflow-y-auto">
            {sessions.map(s => (
              <button
                key={s.sessionId}
                onClick={() => handleSelect(s)}
                className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${selected?.sessionId === s.sessionId ? "bg-blue-50 border-l-2 border-l-blue-500" : ""}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-gray-500" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-sm text-gray-900 truncate">{s.name || "Anonymous"}</div>
                      <div className="text-xs text-gray-500 truncate">{s.latestMessage}</div>
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

          <div className="flex-1 bg-white border border-gray-200 rounded-xl flex flex-col overflow-hidden">
            {!selected ? (
              <div className="flex-1 flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <MessageCircle className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <div className="text-sm">Koi conversation select karo</div>
                </div>
              </div>
            ) : (
              <>
                <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center">
                      <User className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <div className="font-semibold text-sm text-gray-900">{selected.name || "Anonymous"}</div>
                      <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                        {selected.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{selected.phone}</span>}
                        {selected.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{selected.email}</span>}
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{timeAgo(selected.createdAt)}</span>
                      </div>
                    </div>
                    <div className="ml-auto">{statusBadge(selected.status)}</div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                  {selected.messages.map(msg => (
                    <div key={msg.id} className={`flex ${msg.senderType === "user" ? "justify-start" : "justify-end"}`}>
                      <div className={`max-w-[75%] rounded-xl px-3 py-2 text-sm ${
                        msg.senderType === "user"
                          ? "bg-gray-100 text-gray-800 rounded-bl-sm"
                          : "bg-blue-600 text-white rounded-br-sm"
                      }`}>
                        {msg.senderType === "admin" && (
                          <div className="text-[10px] text-blue-200 mb-0.5 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> You (Support)
                          </div>
                        )}
                        <div>{msg.message}</div>
                        <div className={`text-[10px] mt-0.5 ${msg.senderType === "user" ? "text-gray-400" : "text-blue-200"}`}>
                          {new Date(msg.createdAt).toLocaleString("en-IN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" })}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={bottomRef} />
                </div>

                <form onSubmit={handleReply} className="p-3 border-t border-gray-100 flex gap-2">
                  <input
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Reply likhiye..."
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleReply(e as any); } }}
                  />
                  <button type="submit" disabled={replying || !replyText.trim()}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium flex items-center gap-1.5 disabled:opacity-50 transition-colors">
                    {replying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Send
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
