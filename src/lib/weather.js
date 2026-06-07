// Daily weather for a project site via Open-Meteo (free, no API key).
// Returns a short summary string + structured values, or null if unavailable.
const CODE = {
  0: "Clear", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
  45: "Fog", 48: "Fog", 51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle",
  56: "Freezing drizzle", 57: "Freezing drizzle", 61: "Light rain", 63: "Rain", 65: "Heavy rain",
  66: "Freezing rain", 67: "Freezing rain", 71: "Light snow", 73: "Snow", 75: "Heavy snow",
  77: "Snow grains", 80: "Showers", 81: "Showers", 82: "Heavy showers",
  85: "Snow showers", 86: "Snow showers", 95: "Thunderstorm", 96: "Thunderstorm", 99: "Thunderstorm",
};

export async function fetchWeather(lat, lng) {
  if (lat == null || lng == null) return null;
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code&timezone=Australia%2FMelbourne&forecast_days=1`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const d = (await res.json())?.daily;
    if (!d) return null;
    const label = CODE[d.weather_code?.[0]] || "—";
    const max = Math.round(d.temperature_2m_max?.[0]);
    const min = Math.round(d.temperature_2m_min?.[0]);
    const rain = d.precipitation_sum?.[0] ?? 0;
    return { label, max, min, rain, summary: `${label} · ${max}°/${min}°${rain > 0 ? ` · ${rain}mm` : ""}` };
  } catch {
    return null;
  }
}
