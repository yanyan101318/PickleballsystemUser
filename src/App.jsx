import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { lazy, Suspense, useEffect } from "react";
import { AuthProvider } from "./context/AuthContext";
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";
import InstallPrompt from "./components/InstallPrompt";
import ChatWidget from "./components/ChatWidget";

// Lazy load pages
const Home       = lazy(() => import("./pages/Home"));
const Login      = lazy(() => import("./pages/Login"));
const Register   = lazy(() => import("./pages/Register"));
const Courts     = lazy(() => import("./pages/Courts"));
const Book       = lazy(() => import("./pages/Book"));
const Bookings   = lazy(() => import("./pages/Bookings"));
const Profile    = lazy(() => import("./pages/Profile"));
const Matches        = lazy(() => import("./pages/Matches"));
const Membership     = lazy(() => import("./pages/Membership"));
const Announcements  = lazy(() => import("./pages/Announcements"));

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-white text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-400 mx-auto" />
        <p className="mt-4 text-slate-400">Loading...</p>
      </div>
    </div>
  );
}

function App() {
  useEffect(() => {
    if (navigator.serviceWorker) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        let cleared = false;
        for (let registration of registrations) {
          registration.unregister();
          cleared = true;
        }
        if (cleared) {
          caches.keys().then((names) => {
            for (let name of names) caches.delete(name);
          }).then(() => {
            console.log("Cleared PWA cache, reloading...");
            window.location.reload();
          });
        }
      });
    }
  }, []);

  return (
    <AuthProvider>
      <BrowserRouter>
        <Navbar />
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            <Route path="/"          element={<Home />} />
            <Route path="/login"     element={<Login />} />
            <Route path="/register"  element={<Register />} />
            <Route path="/courts"    element={<Courts />} />
            <Route path="/membership" element={<Membership />} />
            <Route path="/announcements" element={<Announcements />} />
            <Route path="/matches"   element={<Matches />} />
            <Route path="/book"      element={<ProtectedRoute><Book /></ProtectedRoute>} />
            <Route path="/bookings"  element={<ProtectedRoute><Bookings /></ProtectedRoute>} />
            <Route path="/profile"   element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          </Routes>
        </Suspense>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "#1e293b",
              color: "#f1f5f9",
              border: "1px solid #334155",
              borderRadius: "12px",
              fontSize: "14px",
            },
            success: { iconTheme: { primary: "#22c55e", secondary: "#020617" } },
            error:   { iconTheme: { primary: "#ef4444", secondary: "#fff" } },
          }}
        />
        <InstallPrompt />
        <ChatWidget />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;