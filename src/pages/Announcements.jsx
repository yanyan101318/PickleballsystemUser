import { useEffect, useState } from "react";
import { Bell, CalendarDays, Sparkles, AlertTriangle, X } from "lucide-react";
import api from "../api";

function formatAnnouncementDate(value) {
  if (!value) return "Just now";
  const date = new Date(value);
  return date.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function Announcements() {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);

  useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        const { data } = await api.get('/announcements');
        setAnnouncements(data);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching announcements:", error);
        setLoading(false);
      }
    };
    fetchAnnouncements();
  }, []);

  return (
    <div className="min-h-screen court-pattern pt-24 pb-10 px-3 sm:px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center gap-2 text-green-400 mb-2">
            <Bell size={18} />
            <span className="text-sm font-semibold uppercase tracking-[0.2em]">Updates</span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl tracking-wider text-white">
            ANNOUNCEMENTS
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Stay updated with the latest court news, promos, and important notices.
          </p>
        </div>

        {loading ? (
          <div className="card p-6 rounded-xl">
            <div className="animate-pulse space-y-3">
              <div className="h-4 bg-slate-800 rounded w-2/3" />
              <div className="h-4 bg-slate-800 rounded w-full" />
              <div className="h-4 bg-slate-800 rounded w-5/6" />
            </div>
          </div>
        ) : announcements.length === 0 ? (
          <div className="card p-10 rounded-xl text-center">
            <Sparkles size={28} className="text-slate-600 mx-auto mb-3" />
            <p className="text-slate-300 font-medium">No announcements yet</p>
            <p className="text-slate-500 text-sm mt-1">
              Check back soon for updates from PickleBros Court.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {announcements.map((ann) => (
              <button
                key={ann.id}
                type="button"
                onClick={() => setSelectedAnnouncement(ann)}
                className="w-full text-left card p-4 sm:p-5 rounded-xl border border-slate-800/70 hover:border-green-500/30 transition-colors"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {ann.type === "warning" ? (
                        <AlertTriangle size={14} className="text-yellow-400" />
                      ) : (
                        <Sparkles size={14} className="text-green-400" />
                      )}
                      <h2 className={`text-sm sm:text-base font-semibold ${ann.type === "warning" ? "text-yellow-400" : "text-green-400"}`}>
                        {ann.title}
                      </h2>
                    </div>
                    <p className="text-slate-300 text-sm leading-relaxed line-clamp-3">{ann.message}</p>
                  </div>
                  <div className="flex items-center gap-2 text-slate-500 text-xs whitespace-nowrap">
                    <CalendarDays size={13} />
                    <span>{formatAnnouncementDate(ann.createdAt)}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedAnnouncement && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 px-3 py-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/95 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3 sm:px-5">
              <div className="flex items-center gap-2">
                {selectedAnnouncement.type === "warning" ? (
                  <AlertTriangle size={16} className="text-yellow-400" />
                ) : (
                  <Sparkles size={16} className="text-green-400" />
                )}
                <h3 className="text-white font-semibold text-sm sm:text-base">
                  {selectedAnnouncement.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAnnouncement(null)}
                className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="max-h-[calc(85vh-64px)] overflow-y-auto px-4 py-4 sm:px-5 sm:py-5">
              <div className="mb-4 flex items-center gap-2 text-slate-500 text-xs">
                <CalendarDays size={13} />
                <span>{formatAnnouncementDate(selectedAnnouncement.createdAt)}</span>
              </div>
              <div className="whitespace-pre-wrap text-sm leading-7 text-slate-300">
                {selectedAnnouncement.message}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
