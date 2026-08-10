import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Zap, MapPin, Clock, Users, Star, ChevronRight, Shield, Smartphone } from "lucide-react";
import { fetchCourts } from "../lib/courtsFirestore";
import { withRandomCourtImages } from "../lib/courtPlaceholderImages";

const features = [
  { icon: Zap,        title: "Instant Booking",  desc: "Book a court in under 60 seconds with real-time availability." },
  { icon: Shield,     title: "Secure Payments",  desc: "GCash integration with instant confirmation and receipts." },
  { icon: Clock,      title: "Flexible Slots",   desc: "Choose any duration from 1 to 4 hours across all courts." },
  { icon: Smartphone, title: "Mobile First",     desc: "Optimized for on-the-go booking from any device." },
];

function formatAvgCourtRating(courts) {
  if (!courts.length) return "—";
  const rated = courts.filter((c) => c.rating > 0);
  if (!rated.length) return "—";
  const avg = rated.reduce((s, c) => s + c.rating, 0) / rated.length;
  return `${avg.toFixed(1)}★`;
}

export default function Home() {
  const { user } = useAuth();
  const [courts, setCourts]             = useState([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [courtsError, setCourtsError]   = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setStatsLoading(true);
      setCourtsError(null);
      try {
        const courtsList = await fetchCourts();
        if (cancelled) return;
        setCourts(courtsList);
      } catch (err) {
        if (cancelled) return;
        setCourtsError(err?.message || "Failed to load courts");
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const previewCourts = useMemo(() => {
    const withImg = courts.map((court) => ({
      ...court,
      displayImageUrl: court.img || withRandomCourtImages([court])[0].displayImageUrl,
    }));
    return [...withImg].sort((a, b) => b.rating - a.rating).slice(0, 3);
  }, [courts]);

  const courtCountDisplay = statsLoading ? "…" : String(courts.length);
  const ratingDisplay     = useMemo(
    () => (statsLoading ? "…" : formatAvgCourtRating(courts)),
    [courts, statsLoading],
  );

  return (
    <div className="min-h-screen court-pattern">

      {/* ── Hero ── */}
      <section className="relative min-h-[100svh] flex flex-col justify-center pt-20 pb-16 px-4 overflow-hidden">

        {/* Background image */}
        <div className="absolute inset-0 overflow-hidden">
          <img
            src="/PickleBros_Logo.png"
            alt=""
            className="w-full h-full object-cover object-[center_15%] sm:object-center rounded-[2rem] sm:rounded-[3rem] shadow-[0_0_80px_rgba(34,197,94,0.16)] scale-105"
            fetchPriority="high"
          />
          {/* dark overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950/50 via-slate-950/60 to-slate-950" />
        </div>

        <div className="relative max-w-6xl mx-auto w-full">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-full px-4 py-1.5 mb-6">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-green-400 text-sm font-medium">Now Open — Book Courts Instantly</span>
            </div>

            <h1 className="font-display text-5xl sm:text-7xl lg:text-8xl tracking-widest text-white mb-4 leading-none">
              <span className="block">PICKLEBROS</span>
              <span className="block gradient-text">COURT</span>
            </h1>

            <p className="text-slate-300 text-base sm:text-lg lg:text-xl mb-8 max-w-2xl mx-auto leading-relaxed px-2">
              The premier pickleball facility in the region. Book courts, join matches,
              rent equipment, and level up your game.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center px-4 sm:px-0">
              <Link
                to="/book"
                className="btn-primary text-base px-8 py-4 flex items-center justify-center gap-2 glow-green"
              >
                <Zap size={18} /> Book a Court
              </Link>
              <Link
                to="/courts"
                className="btn-secondary text-base px-8 py-4 flex items-center justify-center gap-2"
              >
                View Courts <ChevronRight size={18} />
              </Link>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 sm:gap-4 mt-12 sm:mt-16 max-w-2xl mx-auto px-2 sm:px-0">
           {[
              { val: courtCountDisplay, label: "Courts"   },
              { val: ratingDisplay,     label: "Rating"   },
              { val: "24/7",            label: "Support"  },
            ].map((s) => (
              <div key={s.label} className="card p-3 sm:p-4 text-center">
                <div className="font-display text-2xl sm:text-3xl gradient-text tracking-wider">{s.val}</div>
                <div className="text-slate-500 text-xs sm:text-sm mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="py-16 sm:py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="font-display text-3xl sm:text-4xl tracking-wider text-center text-white mb-2">
            WHY <span className="gradient-text">PICKLEBROS COURT</span>
          </h2>
          <p className="text-slate-500 text-center mb-10 sm:mb-12">Everything you need for the perfect game</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {features.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="card p-6 hover:border-green-500/30 transition-colors group">
                <div className="w-12 h-12 bg-green-500/10 rounded-xl flex items-center justify-center mb-4 group-hover:bg-green-500/20 transition-colors">
                  <Icon size={22} className="text-green-400" />
                </div>
                <h3 className="text-white font-semibold mb-2">{title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Courts Preview ── */}
      <section className="py-16 sm:py-20 px-4 bg-slate-900/40">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-end justify-between mb-8 sm:mb-10">
            <div>
              <h2 className="font-display text-3xl sm:text-4xl tracking-wider text-white">OUR COURTS</h2>
              <p className="text-slate-500 mt-1 text-sm sm:text-base">World-class facilities for every level</p>
            </div>
            <Link to="/courts" className="text-green-400 hover:text-green-300 text-sm font-medium flex items-center gap-1 shrink-0">
              View All <ChevronRight size={16} />
            </Link>
          </div>

          {statsLoading && <p className="text-center text-slate-500 py-8">Loading courts…</p>}
          {courtsError  && <p className="text-center text-red-400 py-8">{courtsError}</p>}
          {!statsLoading && !courtsError && previewCourts.length === 0 && (
            <p className="text-center text-slate-500 py-8">
              No courts yet. Add documents to the courts collection in Firestore.
            </p>
          )}

          {!statsLoading && !courtsError && previewCourts.length > 0 && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {previewCourts.map((court) => (
                <div
                  key={court.id}
                  className="card overflow-hidden group hover:border-green-500/30 transition-all duration-300 hover:-translate-y-1"
                >
                  <div className="relative h-44 sm:h-48 overflow-hidden bg-slate-900">
                    <img
                      src={court.displayImageUrl}
                      alt={court.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute top-3 left-3">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${court.type === "Indoor" ? "bg-blue-500/80 text-white" : "bg-orange-500/80 text-white"}`}>
                        {court.type}
                      </span>
                    </div>
                    <div className="absolute top-3 right-3">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${court.isActive ? "bg-green-500/80 text-white" : "bg-red-500/80 text-white"}`}>
                        {court.isActive ? "Available" : "Deactivated"}
                      </span>
                    </div>
                  </div>
                  <div className="p-4 sm:p-5">
                    <h3 className="text-white font-semibold text-base sm:text-lg mb-1">{court.name}</h3>
                    <div className="flex items-center gap-1 text-slate-500 text-sm mb-3">
                      <MapPin size={13} /> {court.location}
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-green-400 font-semibold text-lg">₱{court.pricePerHour}</span>
                        <span className="text-slate-500 text-sm">/hour</span>
                      </div>
                      <div className="flex items-center gap-1 text-yellow-400 text-sm">
                        <Star size={14} fill="currentColor" /> {court.rating}
                        <span className="text-slate-500">({court.reviews})</span>
                      </div>
                    </div>
                    {court.isActive ? (
                      <Link
                        to={`/book?court=${court.id}`}
                        className="mt-4 w-full btn-primary text-sm py-2.5 flex items-center justify-center gap-2"
                      >
                        <Zap size={14} /> Book This Court
                      </Link>
                    ) : (
                      <div className="mt-4 w-full py-2.5 rounded-xl text-sm text-center bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed">
                        Deactivated
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── CTA ──
      <section className="py-16 sm:py-20 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <div className="card p-8 sm:p-10 border-green-500/20 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent" />
            <div className="relative">
              <Users size={40} className="text-green-400 mx-auto mb-4" />
              <h2 className="font-display text-3xl sm:text-4xl tracking-wider text-white mb-3">
                JOIN A PUBLIC MATCH
              </h2>
              <p className="text-slate-400 mb-6 max-w-lg mx-auto text-sm sm:text-base">
                Don't have a partner? Browse open matches and join players in your skill level.
                New games posted daily!
              </p>
              <Link
                to={user ? "/matches" : "/register"}
                className="btn-primary px-8 py-3 inline-flex items-center gap-2"
              >
                {user ? "Find Matches" : "Sign Up & Play"} <ChevronRight size={18} />
              </Link>
            </div>
          </div>
        </div>
      </section> */}

      {/* ── Footer ── */}
      <footer className="border-t border-slate-800 py-8 px-4 text-center text-slate-600 text-sm">
        <p>© 2026 PickleBros Court. All rights reserved.</p>
      </footer>
    </div>
  );
}