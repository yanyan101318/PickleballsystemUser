import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../api";
import {
  Users,
  Calendar,
  Trophy,
  Tag,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Layers,
} from "lucide-react";
import toast from "react-hot-toast";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatDateTime(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleString("en-PH", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

const TYPE_LABELS = {
  open_play:   "Open Play",
  competitive: "Competitive",
  casual:      "Casual",
  training:    "Training",
};

const STATUS_COLORS = {
  upcoming:  "bg-green-500/15 text-green-400",
  full:      "bg-red-500/15 text-red-400",
  cancelled: "bg-slate-700/80 text-slate-400",
  completed: "bg-slate-700/80 text-slate-500",
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function Matches() {
  const { user, userProfile } = useAuth();
  const [matches, setMatches]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  const fetchMatches = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/matches/open-plays');
      setMatches(data);
    } catch (e) {
      console.error(e);
      toast.error("Could not load matches");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatches();
  }, []);

  const joinMatch = async (match) => {
    if (!user) return toast.error("Please sign in to join");
    
    try {
      await api.post(`/matches/${match.id}/join`);
      toast.success("Joined the match successfully.");
      fetchMatches(); // refresh
    } catch (e) {
      console.error(e);
      toast.error(e.response?.data?.error || "Failed to join match");
    }
  };

  return (
    <div className="min-h-screen court-pattern pt-20 pb-8 px-3 sm:px-4">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="pt-4 mb-5">
          <h1 className="font-display text-2xl sm:text-3xl tracking-wider text-white">
            OPEN <span className="gradient-text">MATCHES</span>
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
            Upcoming games — join directly and reserve your spot
          </p>
        </div>

        {/* Match grid */}
        {loading ? (
          <div className="grid sm:grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="card p-4 shimmer h-40 rounded-xl" />
            ))}
          </div>
        ) : matches.length === 0 ? (
          <div className="card p-10 text-center">
            <Trophy size={32} className="text-slate-700 mx-auto mb-2 opacity-60" />
            <p className="text-slate-400 text-sm font-medium">No matches yet</p>
            <p className="text-slate-600 text-xs mt-1">
              Check back soon — the admin will post new games here.
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {matches.map((match) => {
              const participants = Array.isArray(match.participants) ? match.participants : [];
              const maxPlayers   = match.maxPlayers ?? null;
              const isFull       = maxPlayers !== null && participants.length >= maxPlayers;
              const hasJoined    = user && participants.some((p) => p.uid === user.uid);
              const spotsLeft    = maxPlayers !== null ? maxPlayers - participants.length : null;
              const expanded     = expandedId === match.id;
              const feePesos     = match.fee ?? 0;
              const feeDisplay   = `₱${feePesos.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

              return (
                <div
                  key={match.id}
                  className="card p-3 sm:p-4 hover:border-green-500/25 transition-colors rounded-xl flex flex-col gap-2"
                >
                  {/* Title + status */}
                  <div className="flex items-start gap-2">
                    <h3 className="text-white font-semibold text-sm sm:text-base leading-snug flex-1 min-w-0">
                      {match.title}
                    </h3>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 font-medium capitalize ${
                        STATUS_COLORS[match.status] || "bg-slate-700/80 text-slate-400"
                      }`}
                    >
                      {match.status}
                    </span>
                  </div>

                  {/* Meta */}
                  <div className="text-xs text-slate-500 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <Calendar size={12} className="text-green-500/80 shrink-0" />
                      <span className="text-slate-400">{formatDateTime(match.dateTime)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Trophy size={12} className="text-green-500/80 shrink-0" />
                      <span>{match.category}</span>
                      {match.type && (
                        <>
                          <span className="text-slate-700">·</span>
                          <Tag size={11} className="text-green-500/80 shrink-0" />
                          <span>{TYPE_LABELS[match.type] || match.type}</span>
                        </>
                      )}
                    </div>
                    {match.courts?.length > 0 && (
                      <div className="flex items-center gap-1.5">
                        <Layers size={12} className="text-green-500/80 shrink-0" />
                        <span>
                          {match.courts.length} court{match.courts.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5">
                      <Users size={12} className="text-green-500/80 shrink-0" />
                      <span>
                        {participants.length}
                        {maxPlayers !== null ? `/${maxPlayers}` : " joined"}
                        {spotsLeft !== null && !isFull && (
                          <span className="text-green-500/90"> ({spotsLeft} left)</span>
                        )}
                        {isFull && <span className="text-red-400/90"> (Full)</span>}
                      </span>
                    </div>
                  </div>

                  {/* Fee pill */}
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <span className="text-slate-400">Entry fee</span>
                    <span className="text-green-300/90 font-semibold">{feeDisplay}</span>
                  </div>

                  {/* Players collapsible */}
                  {participants.length > 0 && (
                    <>
                      <button
                        type="button"
                        onClick={() => setExpandedId(expanded ? null : match.id)}
                        className="w-full flex items-center justify-between py-1.5 px-2 rounded-lg bg-slate-800/60 text-slate-400 text-xs hover:bg-slate-800 transition-colors"
                      >
                        <span>Players ({participants.length})</span>
                        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                      {expanded && (
                        <ul className="space-y-1 text-xs border border-slate-800/80 rounded-lg p-2 bg-slate-900/30">
                          {participants.map((p, i) => (
                            <li key={p.uid ?? i} className="flex items-center gap-2 text-slate-400">
                              <div className="w-5 h-5 bg-green-500/15 border border-green-500/20 rounded-full flex items-center justify-center shrink-0">
                                <span className="text-green-400 text-[9px] font-bold">
                                  {p.displayName?.[0]?.toUpperCase() || "?"}
                                </span>
                              </div>
                              {p.displayName}
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  )}

                  {/* Join button */}
                  <button
                    onClick={() => {
                      if (!user) return toast.error("Sign in to join matches");
                      if (hasJoined || isFull) return;
                      joinMatch(match);
                    }}
                    disabled={isFull || hasJoined || !user}
                    className={`mt-auto w-full py-2 rounded-lg text-xs font-semibold transition-all ${
                      hasJoined
                        ? "bg-green-500/10 text-green-400 border border-green-500/20 cursor-default"
                        : isFull
                        ? "bg-slate-800/80 text-slate-600 cursor-not-allowed"
                        : !user
                        ? "bg-slate-800/80 text-slate-500 cursor-not-allowed"
                        : "bg-green-500 hover:bg-green-400 text-slate-950"
                    }`}
                  >
                    {hasJoined
                      ? "✓ Joined"
                      : isFull
                      ? "Full"
                      : !user
                      ? "Sign in to join"
                      : "Join Match"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
} 