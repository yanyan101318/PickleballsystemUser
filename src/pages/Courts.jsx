import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MapPin, Star, Zap, Clock, Users, Wifi, Wind, Sun } from "lucide-react";
import { fetchCourts } from "../lib/courtsFirestore";
import { withRandomCourtImages } from "../lib/courtPlaceholderImages";

const amenityIcons = {
  "Air-conditioned": Wind,
  "Wi-Fi": Wifi,
  "Natural Light": Sun,
  "Pro Lighting": Zap,
  default: Zap,
};

// Helper: format openPlaySchedule into a readable string
function formatSchedule(schedule) {
  if (!schedule) return null;
  if (typeof schedule === "string") return schedule;
  // e.g. { days: "Mon–Fri", time: "6:00 AM – 10:00 AM" }
  if (schedule.days && schedule.time) return `${schedule.days} · ${schedule.time}`;
  // e.g. { start: "06:00", end: "10:00" }
  if (schedule.start && schedule.end) return `${schedule.start} – ${schedule.end}`;
  return JSON.stringify(schedule);
}

export default function Courts() {
  const [courts, setCourts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("All");
  const [sort, setSort] = useState("rating");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const list = await fetchCourts();
        if (cancelled) return;
        setCourts(Array.isArray(list) ? list : []);
      } catch (e) {
        if (!cancelled) setError(e?.message || "Failed to load courts");
        setCourts([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const courtsWithImages = useMemo(() => {
    if (!Array.isArray(courts)) return [];
    return courts.map((court) => ({
      ...court,
      displayImageUrl: court?.img || withRandomCourtImages([court])?.[0]?.displayImageUrl || "",
    }));
  }, [courts]);

  const filtered = useMemo(() => {
    if (!Array.isArray(courtsWithImages)) return [];
    return courtsWithImages
      .filter((c) => filter === "All" || c.type === filter)
      .sort((a, b) => (sort === "price" ? (a.pricePerHour || 0) - (b.pricePerHour || 0) : (b.rating || 0) - (a.rating || 0)));
  }, [courtsWithImages, filter, sort]);

  return (
    <div className="min-h-screen pt-20 px-4 pb-12 court-pattern">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10 pt-6">
          <h1 className="font-display text-5xl tracking-wider text-white">
            OUR <span className="gradient-text">COURTS</span>
          </h1>
          <p className="text-slate-500 mt-2">World-class facilities for every level of play</p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div className="flex gap-2">
            {['All', 'Indoor'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  filter === f ? "bg-green-500 text-slate-950" : "bg-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-slate-400 text-sm focus:outline-none focus:border-green-500"
          >
            <option value="rating">Sort by Rating</option>
            <option value="price">Sort by Price</option>
          </select>
        </div>

        {loading && <p className="text-center text-slate-500 py-12">Loading courts…</p>}
        {error && <p className="text-center text-red-400 py-12">{error}</p>}
        {!loading && !error && filtered.length === 0 && (
          <p className="text-center text-slate-500 py-12">
            No courts found. Add documents to the <code className="text-slate-400">courts</code> collection in Firestore.
          </p>
        )}

        {/* Courts Grid */}
        {!loading && !error && filtered.length > 0 && (
          <div className="grid sm:grid-cols-2 gap-6">
            {filtered.map((court) => {
              const isOpenPlay = court.isOpenPlay === true;
              const scheduleText = formatSchedule(court.openPlaySchedule);

              return (
                <div
                  key={court.id}
                  className="card overflow-hidden hover:border-green-500/30 transition-all duration-300 hover:-translate-y-1"
                >
                  {/* ── Image area ── */}
                  <div className="relative h-56 overflow-hidden bg-slate-900">
                    <img
                      src={court.displayImageUrl}
                      alt={court.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 to-transparent pointer-events-none" />

                    {/* Status badges (top-left) */}
                    <div className="absolute top-3 left-3 flex gap-2">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${court.type === "Indoor" ? "bg-blue-500/80 text-white" : "bg-orange-500/80 text-white"}`}>
                        {court.type}
                      </span>
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${court.isActive ? "bg-green-500/80 text-white" : "bg-red-500/80 text-white"}`}>
                        {court.isActive ? "Available" : "Unavailable"}
                      </span>
                    </div>

                    {/* ── OPEN PLAY watermark ── */}
                    {isOpenPlay && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
                        {/* Diagonal stamp text */}
                        <div
                          className="flex flex-col items-center"
                          style={{ transform: "rotate(-25deg)" }}
                        >
                          <span
                            className="font-display font-black tracking-widest text-green-400/30 uppercase leading-none"
                            style={{ fontSize: "clamp(2rem, 6vw, 3.5rem)", letterSpacing: "0.2em" }}
                          >
                            Open Play
                          </span>
                          {/* Court number line */}
                          <span
                            className="font-display font-black tracking-widest text-green-400/25 uppercase"
                            style={{ fontSize: "clamp(0.9rem, 2.5vw, 1.3rem)", letterSpacing: "0.3em" }}
                          >
                            Court {court.courtNumber ?? court.name}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* ── OPEN PLAY pill badge (top-right) ── */}
                    {isOpenPlay && (
                      <div className="absolute top-3 right-3">
                        <span className="flex items-center gap-1.5 bg-green-500 text-slate-950 text-xs font-bold px-3 py-1 rounded-full shadow-lg">
                          <Zap size={11} />
                          Open Play
                        </span>
                      </div>
                    )}

                    {/* Court name + location (bottom of image) */}
                    <div className="absolute bottom-3 left-4 right-4">
                      <h3 className="text-white font-semibold text-xl">{court.name}</h3>
                      <div className="flex items-center gap-1 text-slate-300 text-sm">
                        <MapPin size={12} /> {court.location}
                      </div>
                    </div>
                  </div>

                  {/* ── Card body ── */}
                  <div className="p-5">
                    <p className="text-slate-400 text-sm leading-relaxed mb-4">{court.description}</p>

                    {/* ── Open Play schedule banner ── */}
                    {isOpenPlay && scheduleText && (
                      <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-xl px-3 py-2 mb-4">
                        <Clock size={13} className="text-green-400 shrink-0" />
                        <span className="text-green-400 text-xs font-medium">
                          Open Play: {scheduleText}
                        </span>
                      </div>
                    )}

                    {/* Amenities */}
                    <div className="flex flex-wrap gap-2 mb-4">
                      {court.amenities.map((a) => {
                        const Icon = amenityIcons[a] || amenityIcons.default;
                        return (
                          <span key={a} className="flex items-center gap-1.5 bg-slate-800 text-slate-400 text-xs px-2.5 py-1 rounded-lg">
                            <Icon size={11} /> {a}
                          </span>
                        );
                      })}
                    </div>

                    {/* Info row */}
                    <div className="flex items-center gap-4 text-sm mb-4">
                      <span className="flex items-center gap-1 text-yellow-400">
                        <Star size={14} fill="currentColor" /> {court.rating}
                        <span className="text-slate-500">({court.reviews})</span>
                      </span>
                      <span className="flex items-center gap-1 text-slate-400">
                        <Users size={14} /> Up to {court.maxPlayers} players
                      </span>
                      <span className="flex items-center gap-1 text-slate-400">
                        <Clock size={14} /> Per hour
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-green-400 font-bold text-2xl">₱{court.pricePerHour}</span>
                        <span className="text-slate-500 text-sm">/hour</span>
                      </div>
                      <Link
                        to={`/book?court=${court.id}`}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                          court.isActive
                            ? "bg-green-500 hover:bg-green-400 text-slate-950 glow-green"
                            : "bg-slate-700 text-slate-500 cursor-not-allowed pointer-events-none"
                        }`}
                      >
                        <Zap size={14} /> {court.isActive ? "Book Now" : "Unavailable"}
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}