import { useState } from "react";
import { useLocation } from "wouter";
import { Plus, X, FileText, ShoppingCart, CreditCard, Receipt, RotateCcw, FileX } from "lucide-react";

const ACTIONS = [
  { label: "Sales Invoice",  href: "/sales/invoices/new",       icon: <FileText className="w-4 h-4" />,   color: "bg-blue-500 hover:bg-blue-600" },
  { label: "Credit Note",    href: "/sales/credit-notes/new",   icon: <RotateCcw className="w-4 h-4" />,  color: "bg-purple-500 hover:bg-purple-600" },
  { label: "Purchase Bill",  href: "/purchases/bills/new",      icon: <ShoppingCart className="w-4 h-4" />, color: "bg-orange-500 hover:bg-orange-600" },
  { label: "Debit Note",     href: "/purchases/debit-notes/new",icon: <FileX className="w-4 h-4" />,      color: "bg-red-400 hover:bg-red-500" },
  { label: "Receipt",        href: "/payments/receipts/new",    icon: <Receipt className="w-4 h-4" />,    color: "bg-green-500 hover:bg-green-600" },
  { label: "Payment",        href: "/payments/payments/new",    icon: <CreditCard className="w-4 h-4" />, color: "bg-rose-500 hover:bg-rose-600" },
];

export default function FloatingActionButton() {
  const [open, setOpen] = useState(false);
  const [, navigate] = useLocation();

  const go = (href: string) => {
    navigate(href);
    setOpen(false);
  };

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
      )}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col-reverse items-end gap-2 print:hidden">
        {open && ACTIONS.map((a, i) => (
          <div key={i} className="flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-150">
            <span className="bg-slate-900 text-white text-xs font-medium px-2.5 py-1 rounded-lg shadow-lg whitespace-nowrap">
              {a.label}
            </span>
            <button
              onClick={() => go(a.href)}
              className={`w-10 h-10 rounded-full ${a.color} text-white flex items-center justify-center shadow-lg transition-all hover:scale-110`}
            >
              {a.icon}
            </button>
          </div>
        ))}
        <button
          tabIndex={-1}
          onClick={() => setOpen(o => !o)}
          className={`w-10 h-10 rounded-full shadow-2xl flex items-center justify-center text-white transition-all duration-200 ${
            open ? "bg-slate-700 rotate-45" : "bg-blue-600 hover:bg-blue-700 hover:scale-105"
          }`}
        >
          {open ? <X className="w-4 h-4" /> : <Plus className="w-5 h-5" />}
        </button>
      </div>
    </>
  );
}
