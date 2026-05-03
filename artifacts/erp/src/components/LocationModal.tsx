import { useState, useEffect } from "react";
import { MapPin, Navigation, X, Check, Trash2, Loader2 } from "lucide-react";
import {
  DeviceLocation,
  getDeviceLocation,
  setDeviceLocation,
  clearDeviceLocation,
  detectGpsLocation,
} from "@/lib/locationStore";

interface LocationModalProps {
  onClose: () => void;
}

export default function LocationModal({ onClose }: LocationModalProps) {
  const [current, setCurrent] = useState<DeviceLocation | null>(getDeviceLocation());
  const [name, setName] = useState(getDeviceLocation()?.name || "");
  const [detecting, setDetecting] = useState(false);
  const [detected, setDetected] = useState<{ lat: number; lng: number } | null>(
    getDeviceLocation()?.latitude != null
      ? { lat: getDeviceLocation()!.latitude!, lng: getDeviceLocation()!.longitude! }
      : null
  );
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const handleDetect = async () => {
    setDetecting(true);
    setError("");
    try {
      const loc = await detectGpsLocation();
      setName(loc.name);
      setDetected({ lat: loc.latitude!, lng: loc.longitude! });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDetecting(false);
    }
  };

  const handleSave = () => {
    if (!name.trim()) { setError("Location naam daalo"); return; }
    setDeviceLocation({
      name: name.trim(),
      latitude: detected?.lat,
      longitude: detected?.lng,
      setAt: new Date().toISOString(),
    });
    setSaved(true);
    setTimeout(onClose, 800);
  };

  const handleClear = () => {
    clearDeviceLocation();
    setCurrent(null);
    setName("");
    setDetected(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-blue-600" />
            <h2 className="font-semibold text-gray-900">Device Location Set Karo</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Info */}
          <p className="text-xs text-gray-500 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 leading-relaxed">
            Yeh location is device par save hogi. Offline kaam karne par har draft ke saath yeh attach ho jaayegi, taaki sync hone par pata chale data kahaan se aaya.
          </p>

          {/* GPS Detect Button */}
          <button
            onClick={handleDetect}
            disabled={detecting}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-dashed border-blue-300 text-blue-600 rounded-xl text-sm font-medium hover:bg-blue-50 transition-colors disabled:opacity-60"
          >
            {detecting
              ? <><Loader2 className="w-4 h-4 animate-spin" /> GPS se detect kar rahe hain...</>
              : <><Navigation className="w-4 h-4" /> GPS se Auto-Detect Karo</>}
          </button>

          {detected && (
            <div className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5 flex items-center gap-1.5">
              <Navigation className="w-3 h-3 flex-shrink-0" />
              {detected.lat.toFixed(5)}, {detected.lng.toFixed(5)}
            </div>
          )}

          {/* Manual name input */}
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Location ka Naam</label>
            <input
              type="text"
              value={name}
              onChange={e => { setName(e.target.value); setError(""); }}
              placeholder="e.g. Delhi Branch, Godown No. 2, Main Office"
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyDown={e => e.key === "Enter" && handleSave()}
            />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          {/* Current */}
          {current && (
            <div className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
              <span className="font-medium text-gray-600">Abhi set hai:</span> {current.name}
              {current.setAt && (
                <span className="text-gray-400 ml-1">
                  · {new Date(current.setAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 pb-5">
          {current && (
            <button
              onClick={handleClear}
              className="flex items-center gap-1.5 px-3 py-2 text-red-600 border border-red-200 rounded-xl text-sm hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" /> Hatao
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saved}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-70"
          >
            {saved
              ? <><Check className="w-4 h-4" /> Saved!</>
              : <><MapPin className="w-4 h-4" /> Save Karo</>}
          </button>
        </div>
      </div>
    </div>
  );
}
