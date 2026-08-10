import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api";
import {
  Menu, X, Home, Calendar, User, LogOut, BookOpen,
  Bell, ChevronDown, Award, Zap
} from "lucide-react";

export default function Navbar() {
  const { user, userProfile, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropOpen, setDropOpen] = useState(false);
  const [announcementsOpen, setAnnouncementsOpen] = useState(false);
  const [announcements, setAnnouncements] = useState([]);
  const [seenAnnouncementIds, setSeenAnnouncementIds] = useState(() => {
    try {
      const saved = localStorage.getItem('seenAnnouncements');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  const [displayAnnouncements, setDisplayAnnouncements] = useState([]);

  const unreadAnnouncements = announcements.filter(a => !seenAnnouncementIds.includes(a.id));

  // --- Auto-hide navbar logic ---
  const [visible, setVisible] = useState(true);
  const [isHovering, setIsHovering] = useState(false);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentY = window.scrollY;

      // Always show at the very top of the page
      if (currentY < 40) {
        setVisible(true);
      } else if (currentY > lastScrollY.current) {
        // Scrolling down -> hide
        setVisible(false);
      } else if (currentY < lastScrollY.current) {
        // Scrolling up -> show
        setVisible(true);
      }

      lastScrollY.current = currentY;
    };

    const handleMouseMove = (e) => {
      // If cursor is near the very top of the viewport, reveal the navbar
      if (e.clientY < 80) {
        setVisible(true);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  // Close mobile menu/dropdowns if the navbar hides
  useEffect(() => {
    if (!visible && !isHovering) {
      setMenuOpen(false);
      setDropOpen(false);
      setAnnouncementsOpen(false);
    }
  }, [visible, isHovering]);

  const shouldShow = visible || isHovering || menuOpen;
  // --- end auto-hide logic ---

  const handleLogout = async () => {
    await logout();
    navigate("/");
    setMenuOpen(false);
  };

  useEffect(() => {
    if (!user) return;

    const fetchAnnouncements = async () => {
      try {
        const { data } = await api.get('/announcements');
        setAnnouncements(data);
      } catch (error) {
        console.error("Error fetching announcements:", error);
      }
    };

    fetchAnnouncements();
  }, [user]);

  const markAsSeen = () => {
    if (unreadAnnouncements.length === 0) return;
    const newSeenIds = [...new Set([...seenAnnouncementIds, ...unreadAnnouncements.map(a => a.id)])];
    setSeenAnnouncementIds(newSeenIds);
    localStorage.setItem('seenAnnouncements', JSON.stringify(newSeenIds));
  };

  const navLinks = [
    { to: "/", label: "Home", icon: Home },
    { to: "/courts", label: "Courts", icon: Calendar },
    { to: "/book", label: "Book Now", icon: Zap, highlight: true },
    { to: "/announcements", label: "Announcements", icon: Bell },
    { to: "/membership", label: "Membership", icon: Award },
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <nav
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      className={`fixed top-0 left-0 right-0 z-50 glass border-b border-white/5 transition-transform duration-300 ${shouldShow ? "translate-y-0" : "-translate-y-full"
        }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <img
              src="/PickleBros_Logo.png"
              alt="PickleBros Court"
              className="h-14 w-auto object-contain"
            />
          </Link>

          {/* Desktop Links */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map(({ to, label, highlight }) => (
              <Link
                key={to}
                to={to}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${highlight
                  ? "bg-green-500 text-slate-950 hover:bg-green-400 shadow-lg shadow-green-500/25 ml-2"
                  : isActive(to)
                    ? "text-green-400 bg-green-500/10"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
              >
                {label}
              </Link>
            ))}
          </div>

          {/* Right Side */}
          <div className="flex items-center gap-3">
            {user ? (
              <>
                <div className="relative hidden sm:block">
                  <button
                    onClick={() => {
                      const opening = !announcementsOpen;
                      if (opening) {
                        setDisplayAnnouncements(unreadAnnouncements.slice(0, 5));
                        markAsSeen();
                      }
                      setAnnouncementsOpen(opening);
                      setDropOpen(false);
                    }}
                    className="relative p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors flex items-center justify-center"
                  >
                    <Bell size={18} />
                    {unreadAnnouncements.length > 0 && !announcementsOpen && (
                      <span className="absolute top-1 right-1 w-2 h-2 bg-green-500 rounded-full"></span>
                    )}
                  </button>

                  {announcementsOpen && (
                    <div className="absolute right-0 top-12 w-80 card shadow-2xl py-2 z-50">
                      <div className="px-4 py-2 border-b border-slate-800 mb-1 flex justify-between items-center">
                        <p className="text-white text-sm font-medium">Announcements</p>
                        <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">
                          {displayAnnouncements.length}
                        </span>
                      </div>
                      <div className="max-h-80 overflow-y-auto">
                        {displayAnnouncements.length > 0 ? (
                          displayAnnouncements.map((ann) => (
                            <div key={ann.id} className="px-4 py-3 border-b border-slate-800/50 hover:bg-slate-800/50 transition-colors">
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <h4 className={`text-sm font-medium ${ann.type === 'warning' ? 'text-yellow-400' : 'text-green-400'}`}>
                                  {ann.title}
                                </h4>
                                <span className="text-[10px] text-slate-500 whitespace-nowrap">
                                  {ann.createdAt ? new Date(ann.createdAt).toLocaleDateString() : 'Just now'}
                                </span>
                              </div>
                              <p className="text-xs text-slate-300 mb-1">
                                {ann.message}
                              </p>
                            </div>
                          ))
                        ) : (
                          <div className="px-4 py-4 text-center text-slate-400 text-sm">
                            No announcements
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <div className="relative">
                  <button
                    onClick={() => {
                      setDropOpen(!dropOpen);
                      setAnnouncementsOpen(false);
                    }}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-slate-800 transition-colors"
                  >
                    <div className="w-8 h-8 bg-green-500/20 border border-green-500/30 rounded-lg flex items-center justify-center">
                      <span className="text-green-400 font-semibold text-sm">
                        {(userProfile?.fullName || user.email || "U")[0].toUpperCase()}
                      </span>
                    </div>
                    <span className="text-slate-300 text-sm font-medium hidden sm:block max-w-[100px] truncate">
                      {userProfile?.fullName?.split(" ")[0] || "User"}
                    </span>
                    <ChevronDown size={14} className="text-slate-500 hidden sm:block" />
                  </button>
                  {dropOpen && (
                    <div className="absolute right-0 top-12 w-52 card shadow-2xl py-2 z-50">
                      <div className="px-4 py-2 border-b border-slate-800 mb-1">
                        <p className="text-white text-sm font-medium truncate">{userProfile?.fullName}</p>
                        <p className="text-slate-500 text-xs truncate">{user.email}</p>
                      </div>
                      <Link
                        to="/announcements"
                        onClick={() => setDropOpen(false)}
                        className="flex items-center gap-3 w-full px-4 py-2.5 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors text-sm"
                      >
                        <Bell size={15} /> Announcements
                        {unreadAnnouncements.length > 0 && (
                          <span className="ml-auto text-[10px] bg-green-500/10 text-green-300 px-2 py-0.5 rounded-full">
                            {unreadAnnouncements.length}
                          </span>
                        )}
                      </Link>
                      {[
                        { to: "/profile", label: "My Profile", icon: User },
                        { to: "/bookings", label: "My Bookings", icon: BookOpen },
                      ].map(({ to, label, icon: Icon }) => (
                        <Link
                          key={to}
                          to={to}
                          onClick={() => setDropOpen(false)}
                          className="flex items-center gap-3 px-4 py-2.5 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors text-sm"
                        >
                          <Icon size={15} /> {label}
                        </Link>
                      ))}
                      <div className="border-t border-slate-800 mt-1 pt-1">
                        <button
                          onClick={handleLogout}
                          className="flex items-center gap-3 px-4 py-2.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors text-sm w-full"
                        >
                          <LogOut size={15} /> Sign Out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center gap-1 sm:gap-2">
                <Link to="/login" className="text-slate-400 hover:text-white text-sm font-medium px-2 sm:px-4 py-2 transition-colors">
                  Sign In
                </Link>
                <Link to="/register" className="btn-primary text-sm py-2 px-3 sm:px-4">
                  Get Started
                </Link>
              </div>
            )}

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => {
                const opening = !menuOpen;
                if (opening) {
                  setDisplayAnnouncements(unreadAnnouncements.slice(0, 5));
                  markAsSeen();
                }
                setMenuOpen(opening);
              }}
              className="md:hidden p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {menuOpen && (
          <div className="md:hidden py-4 border-t border-slate-800">
            {navLinks.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                onClick={() => setMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl mb-1 text-sm font-medium transition-colors ${isActive(to) ? "text-green-400 bg-green-500/10" : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
              >
                <Icon size={16} /> {label}
              </Link>
            ))}
            {user && (
              <>
                <Link to="/profile" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-xl mb-1 text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800">
                  <User size={16} /> My Profile
                </Link>
                <Link to="/bookings" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-xl mb-1 text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800">
                  <BookOpen size={16} /> My Bookings
                </Link>

                {/* Mobile Announcements */}
                <div className="border-t border-slate-800/50 mt-2 pt-2">
                  <div className="px-4 py-2 flex items-center justify-between text-slate-400">
                    <span className="text-sm font-medium flex items-center gap-2">
                      <Bell size={16} /> Announcements
                    </span>
                    {displayAnnouncements.length > 0 && (
                      <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">
                        {displayAnnouncements.length}
                      </span>
                    )}
                  </div>
                  <div className="max-h-60 overflow-y-auto mt-1 mb-2 space-y-1">
                    {displayAnnouncements.length > 0 ? (
                      displayAnnouncements.map((ann) => (
                        <div key={ann.id} className="px-4 py-2 mx-2 rounded-xl bg-slate-800/30 border border-slate-800/50">
                          <div className="flex justify-between items-start mb-1">
                            <h4 className={`text-sm font-medium ${ann.type === 'warning' ? 'text-yellow-400' : 'text-green-400'}`}>
                              {ann.title}
                            </h4>
                            <span className="text-[10px] text-slate-500">
                              {ann.createdAt ? new Date(ann.createdAt).toLocaleDateString() : 'Just now'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-300">{ann.message}</p>
                        </div>
                      ))
                    ) : (
                      <div className="px-4 py-2 text-xs text-slate-500 text-center">
                        No announcements
                      </div>
                    )}
                  </div>
                </div>

                <div className="border-t border-slate-800 mt-2 pt-2">
                  <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/10 w-full">
                    <LogOut size={16} /> Sign Out
                  </button>
                </div>
              </>
            )}
            {!user && (
              <div className="border-t border-slate-800 mt-2 pt-4 pb-2 px-4 flex flex-col gap-3">
                <Link to="/login" onClick={() => setMenuOpen(false)} className="flex items-center justify-center w-full py-3 rounded-xl border border-slate-700 text-slate-300 font-medium text-sm hover:bg-slate-800 transition-colors">
                  Sign In
                </Link>
                <Link to="/register" onClick={() => setMenuOpen(false)} className="flex items-center justify-center w-full py-3 rounded-xl bg-green-500 text-slate-950 font-medium text-sm hover:bg-green-400 transition-colors">
                  Get Started
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}