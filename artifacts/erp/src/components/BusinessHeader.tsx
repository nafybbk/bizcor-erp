// Reusable business header for all printable reports
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface Props {
  title: string;
  subtitle?: string;
  period?: string;
}

export default function BusinessHeader({ title, subtitle, period }: Props) {
  const [biz, setBiz] = useState<any>(null);

  useEffect(() => {
    const cached = localStorage.getItem("erp_biz_profile");
    if (cached) { try { setBiz(JSON.parse(cached)); } catch { } }
    api.get<any>("/businesses/current").then(b => {
      setBiz(b);
      localStorage.setItem("erp_biz_profile", JSON.stringify(b));
    }).catch(() => {});
  }, []);

  if (!biz) return null;

  const address = [biz.address, biz.city, biz.state, biz.pincode].filter(Boolean).join(", ");

  return (
    <div className="border-b-2 border-gray-800 pb-4 mb-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          {biz.logo && (
            <img src={biz.logo} alt="Logo" className="w-16 h-16 object-contain flex-shrink-0" />
          )}
          <div>
            <h1 className="text-xl font-extrabold text-gray-900">{biz.name}</h1>
            {address && <div className="text-xs text-gray-500 mt-0.5">{address}</div>}
            <div className="flex flex-wrap gap-x-3 mt-0.5 text-xs text-gray-500">
              {biz.phone && <span>Ph: {biz.phone}</span>}
              {biz.email && <span>{biz.email}</span>}
            </div>
            {biz.gstin && (
              <div className="text-xs font-semibold text-gray-700 mt-0.5">GSTIN: <span className="font-mono">{biz.gstin}</span></div>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-gray-900">{title}</div>
          {subtitle && <div className="text-sm text-gray-500">{subtitle}</div>}
          {period && <div className="text-sm font-medium text-blue-700 mt-1">{period}</div>}
        </div>
      </div>
    </div>
  );
}
