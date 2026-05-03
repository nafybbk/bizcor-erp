export interface DeviceLocation {
  name: string;
  latitude?: number;
  longitude?: number;
  setAt: string;
}

const KEY = "erp_device_location";

export function getDeviceLocation(): DeviceLocation | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function setDeviceLocation(loc: DeviceLocation): void {
  localStorage.setItem(KEY, JSON.stringify(loc));
  window.dispatchEvent(new CustomEvent("device-location-change"));
}

export function clearDeviceLocation(): void {
  localStorage.removeItem(KEY);
  window.dispatchEvent(new CustomEvent("device-location-change"));
}

export async function detectGpsLocation(): Promise<DeviceLocation> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("GPS is apke browser mein support nahi hai"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude, longitude } = pos.coords;
        let name = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
        try {
          const r = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
            { headers: { "Accept-Language": "en" } }
          );
          const data = await r.json();
          const a = data.address || {};
          const parts = [a.suburb || a.neighbourhood, a.city || a.town || a.village, a.state_district, a.state]
            .filter(Boolean);
          if (parts.length > 0) name = parts.slice(0, 2).join(", ");
        } catch { }
        resolve({ name, latitude, longitude, setAt: new Date().toISOString() });
      },
      err => reject(new Error(err.message === "User denied Geolocation" ? "GPS access deny kiya — manually type karo" : err.message)),
      { timeout: 10000, enableHighAccuracy: false }
    );
  });
}
