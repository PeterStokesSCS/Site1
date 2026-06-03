// Photo helpers — client-side compression, GPS capture, distance-from-site.

// Photo categories (shared across capture, badges and gallery filters).
export const PHOTO_CATEGORIES = [
  { key: "progress", label: "Progress", color: "#3b82f6", icon: "🏗" },
  { key: "safety",   label: "Safety",   color: "#ef4444", icon: "⚠" },
  { key: "defect",   label: "Defect",   color: "#f59e0b", icon: "🔧" },
  { key: "qa",       label: "QA",       color: "#22c55e", icon: "✓" },
  { key: "delivery", label: "Delivery", color: "#a855f7", icon: "📦" },
  { key: "general",  label: "General",  color: "#888888", icon: "📷" },
];

export function categoryMeta(key) {
  return PHOTO_CATEGORIES.find(c => c.key === key) || PHOTO_CATEGORIES[5];
}

// Compress an image file to a JPEG Blob (≤ maxSizeKB, ≤ maxDimension px).
export async function compressImage(file, maxSizeKB = 800, maxDimension = 1920) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not read image")); };
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDimension || height > maxDimension) {
        if (width > height) { height = Math.round((height / width) * maxDimension); width = maxDimension; }
        else { width = Math.round((width / height) * maxDimension); height = maxDimension; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(url);
        if (!blob) return reject(new Error("Compression failed"));
        if (blob.size / 1024 > maxSizeKB) {
          canvas.toBlob((b2) => resolve(b2 || blob), "image/jpeg", 0.5);
        } else {
          resolve(blob);
        }
      }, "image/jpeg", 0.75);
    };
    img.src = url;
  });
}

// Resolve the device GPS position, or null if unavailable/denied. Never throws.
export function getGps(timeout = 8000) {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout, maximumAge: 30000 }
    );
  });
}

// Haversine distance in metres, or null if any coord missing.
export function distanceFromSiteMetres(lat1, lng1, lat2, lng2) {
  if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) return null;
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Status label + colour for a captured photo's location vs the project site.
export function gpsStatusLabel({ gps, distanceM }) {
  if (!gps) return { label: "📍 Location unavailable", color: "#888" };
  if (distanceM == null) return { label: "📍 Location captured", color: "#0ea5e9" };
  if (distanceM < 100) return { label: "✅ On site", color: "#22c55e" };
  if (distanceM < 500) return { label: `⚠️ ${Math.round(distanceM)}m from site`, color: "#f59e0b" };
  return { label: `❌ ${(distanceM / 1000).toFixed(1)}km from site — flagged`, color: "#ef4444" };
}
