import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send, Loader2, ChevronDown } from "lucide-react";
import { api } from "@/lib/api";

const SESSION_KEY = "erp_support_chat_session";
const META_KEY = "erp_support_chat_meta";

function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

function getSessionId(): string {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = generateId();
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

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

type Meta = { name: string; phone: string; email: string };

export default function SupportChatWidget({ supportEmail, supportPhone }: {
  supportEmail?: string;
  supportPhone?: string;
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [meta, setMeta] = useState<Meta>(() => {
    try { return JSON.parse(localStorage.getItem(META_KEY) || "{}"); } catch { return {}; }
  });
  const [form, setForm] = useState({ name: meta.name || "", phone: meta.phone || "", email: meta.email || "", message: "" });
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasHistory, setHasHistory] = useState(false);
  const [unread, setUnread] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const sessionId = getSessionId();

  const fetchMessages = async () => {
    setFetchLoading(true);
    try {
      const rows = await api.get<Message[]>(`/support-chat/messages/${sessionId}`);
      setMessages(rows);
      if (rows.length > 0) setHasHistory(true);
      const hasAdminReply = rows.some(r => r.senderType === "admin");
      if (hasAdminReply && !open) setUnread(true);
    } catch { /* silently ignore */ }
    finally { setFetchLoading(false); }
  };

  useEffect(() => {
    fetchMessages();
  }, []);

  useEffect(() => {
    if (open) {
      setUnread(false);
      fetchMessages();
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
    }
  }, [messages.length]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.message.trim()) return;
    setLoading(true);
    setError("");
    try {
      await api.post("/support-chat/messages", {
        sessionId,
        name: form.name.trim() || "Anonymous",
        phone: form.phone.trim(),
        email: form.email.trim(),
        message: form.message.trim(),
      });
      localStorage.setItem(META_KEY, JSON.stringify({ name: form.name, phone: form.phone, email: form.email }));
      setMeta({ name: form.name, phone: form.phone, email: form.email });
      setForm(f => ({ ...f, message: "" }));
      await fetchMessages();
    } catch {
      setError("Message send nahi hua, dobara try karo.");
    }
    setLoading(false);
  };

  const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";

  return (
    <>
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-5 right-5 z-50 w-13 h-13 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95"
        style={{ width: 52, height: 52 }}
        aria-label="Support Chat"
        title="Help / Support"
      >
        {open
          ? <ChevronDown className="w-5 h-5" />
          : <>
              <MessageCircle className="w-5 h-5" />
              {unread && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] flex items-center justify-center font-bold">!</span>
              )}
            </>
        }
      </button>

      {open && (
        <div className="fixed bottom-20 right-5 z-50 w-80 bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden"
          style={{ maxHeight: "calc(100vh - 110px)" }}>
          <div className="bg-blue-600 text-white px-4 py-3 flex items-center justify-between">
            <div>
              <div className="font-semibold text-sm">Support Chat</div>
              <div className="text-xs text-blue-100">Hum jald jawab denge</div>
            </div>
            <button onClick={() => setOpen(false)} className="text-blue-200 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0" style={{ maxHeight: 280 }}>
            {fetchLoading && messages.length === 0 && (
              <div className="flex justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
              </div>
            )}

            {!fetchLoading && messages.length === 0 && (
              <div className="text-center py-4 space-y-1">
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
              <div key={msg.id}
                className={`flex ${msg.senderType === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                  msg.senderType === "user"
                    ? "bg-blue-600 text-white rounded-br-sm"
                    : "bg-gray-100 text-gray-800 rounded-bl-sm"
                }`}>
                  {msg.senderType === "admin" && (
                    <div className="text-xs font-semibold text-blue-600 mb-0.5">Support Team</div>
                  )}
                  <div>{msg.message}</div>
                  <div className={`text-[10px] mt-0.5 ${msg.senderType === "user" ? "text-blue-200" : "text-gray-400"}`}>
                    {new Date(msg.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          <form onSubmit={handleSend} className="border-t border-gray-100 p-3 space-y-2 bg-gray-50">
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

            <div className="flex gap-2">
              <input
                className={`${inputCls} flex-1`}
                placeholder="Message likhiye..."
                value={form.message}
                onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(e as any); } }}
                required
              />
              <button type="submit" disabled={loading || !form.message.trim()}
                className="w-9 h-9 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center justify-center disabled:opacity-50 transition-colors shrink-0">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>

            {error && <div className="text-xs text-red-500">{error}</div>}
          </form>
        </div>
      )}
    </>
  );
}
