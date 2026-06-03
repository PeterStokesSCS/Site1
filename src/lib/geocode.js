// Geocode a street address to { lat, lng } using OpenStreetMap Nominatim (free, no key).
// Returns null if not found or on error. Low-volume use only (1 req/sec policy).
export async function geocodeAddress(address) {
  if (!address || !address.trim()) return null;
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`,
      { headers: { Accept: "application/json" } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data[0]) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
    return null;
  } catch {
    return null;
  }
}
