import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Mail, Lock, Eye, EyeOff, Zap, Key } from "lucide-react";
import toast from "react-hot-toast";

export default function Login() {
  const { login, resetPassword, verifyOtp, submitNewPassword } = useAuth();
  const navigate = useNavigate();
  
  const [mode, setMode] = useState("login"); // login, forgot, otp, reset
  const [form, setForm] = useState({ email: "", password: "", otp: "", newPassword: "" });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [otpToken, setOtpToken] = useState(null);
  const [resetToken, setResetToken] = useState(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(form.email, form.password);
      toast.success("Welcome back!");
      navigate("/");
    } catch (err) {
      toast.error(err.code === "auth/invalid-credential" ? "Invalid email or password" : "Login failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    if (!form.email) return toast.error("Enter your email first");
    setLoading(true);
    try {
      const data = await resetPassword(form.email);
      setOtpToken(data.token);
      toast.success("OTP sent to your phone!");
      setMode("otp");
    } catch (err) {
      toast.error(err.response?.data?.error || "Could not send OTP.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!form.otp) return toast.error("Enter the OTP");
    setLoading(true);
    try {
      const data = await verifyOtp(form.email, form.otp, otpToken);
      setResetToken(data.resetToken);
      toast.success("OTP verified!");
      setMode("reset");
    } catch (err) {
      toast.error(err.response?.data?.error || "Invalid OTP.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!form.newPassword) return toast.error("Enter a new password");
    setLoading(true);
    try {
      await submitNewPassword(form.email, form.newPassword, resetToken);
      toast.success("Password updated! Please log in.");
      setMode("login");
      setForm({ ...form, password: "", otp: "", newPassword: "" });
    } catch (err) {
      toast.error(err.response?.data?.error || "Could not reset password.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    if (mode === "login") return handleLogin(e);
    if (mode === "forgot") return handleRequestOtp(e);
    if (mode === "otp") return handleVerifyOtp(e);
    if (mode === "reset") return handleResetPassword(e);
  };

  const getTitle = () => {
    if (mode === "login") return "WELCOME BACK";
    if (mode === "forgot") return "RESET PASSWORD";
    if (mode === "otp") return "ENTER OTP";
    if (mode === "reset") return "NEW PASSWORD";
  };

  const getSubtitle = () => {
    if (mode === "login") return "Sign in to your PickleZone account";
    if (mode === "forgot") return "We'll send an OTP to your phone";
    if (mode === "otp") return "Check your phone for the 6-digit code";
    if (mode === "reset") return "Enter your new password below";
  };

  const getButtonText = () => {
    if (mode === "login") return loading ? "Signing In..." : "Sign In";
    if (mode === "forgot") return loading ? "Sending..." : "Send Reset Code";
    if (mode === "otp") return loading ? "Verifying..." : "Verify OTP";
    if (mode === "reset") return loading ? "Updating..." : "Update Password";
  };

  return (
    <div className="min-h-screen hero-bg flex items-center justify-center px-4 pt-16">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-green-500 rounded-2xl flex items-center justify-center mx-auto mb-4 glow-green">
            <span className="text-slate-950 font-bold text-2xl">P</span>
          </div>
          <h1 className="font-display text-3xl tracking-wider text-white">
            {getTitle()}
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {getSubtitle()}
          </p>
        </div>

        <div className="card p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            
            {(mode === "login" || mode === "forgot") && (
              <div>
                <label className="label">Email Address</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="email"
                    required
                    className="input-field pl-10"
                    placeholder="you@example.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
              </div>
            )}

            {mode === "login" && (
              <div>
                <label className="label">Password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type={showPass ? "text" : "password"}
                    required
                    className="input-field pl-10 pr-10"
                    placeholder="Enter your password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            )}

            {mode === "otp" && (
              <div>
                <label className="label">6-Digit OTP</label>
                <div className="relative">
                  <Key size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    required
                    maxLength={6}
                    className="input-field pl-10 tracking-widest font-mono"
                    placeholder="123456"
                    value={form.otp}
                    onChange={(e) => setForm({ ...form, otp: e.target.value.replace(/\D/g, "") })}
                  />
                </div>
              </div>
            )}

            {mode === "reset" && (
              <div>
                <label className="label">New Password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type={showPass ? "text" : "password"}
                    required
                    className="input-field pl-10 pr-10"
                    placeholder="Enter new password"
                    value={form.newPassword}
                    onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 py-3.5"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                  </svg>
                  {getButtonText()}
                </span>
              ) : (
                <>
                  <Zap size={16} />
                  {getButtonText()}
                </>
              )}
            </button>
          </form>

          <div className="mt-5 text-center space-y-2">
            <button
              type="button"
              onClick={() => setMode(mode === "login" ? "forgot" : "login")}
              className="text-green-400 hover:text-green-300 text-sm transition-colors"
            >
              {mode !== "login" ? "← Back to Sign In" : "Forgot your password?"}
            </button>
            {mode === "login" && (
              <p className="text-slate-500 text-sm">
                Don't have an account?{" "}
                <Link to="/register" className="text-green-400 hover:text-green-300 font-medium">
                  Create one free
                </Link>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}