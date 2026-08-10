import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Mail, Lock, User, Phone, Eye, EyeOff } from "lucide-react";
import toast from "react-hot-toast";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ fullName: "", email: "", phone: "", password: "", confirm: "" });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm) return toast.error("Passwords don't match!");
    if (form.password.length < 6) return toast.error("Password must be at least 6 characters.");
    setLoading(true);
    try {
      await register(form);
      toast.success("Account created! Welcome to PickleZone 🎉");
      navigate("/");
    } catch (err) {
      if (err.code === "auth/email-already-in-use") toast.error("Email already registered.");
      else toast.error("Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const fields = [
    { key: "fullName", label: "Full Name", type: "text", placeholder: "Juan dela Cruz", icon: User },
    { key: "email", label: "Email Address", type: "email", placeholder: "you@example.com", icon: Mail },
    { key: "phone", label: "Phone Number", type: "tel", placeholder: "09XX-XXX-XXXX", icon: Phone },
  ];

  return (
    <div className="min-h-screen hero-bg flex items-center justify-center px-4 pt-20 pb-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-green-500 rounded-2xl flex items-center justify-center mx-auto mb-4 glow-green">
            <span className="text-slate-950 font-bold text-2xl">P</span>
          </div>
          <h1 className="font-display text-3xl tracking-wider text-white">CREATE ACCOUNT</h1>
          <p className="text-slate-500 text-sm mt-1">Join PickleZone and start playing today</p>
        </div>

        <div className="card p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            {fields.map(({ key, label, type, placeholder, icon: Icon }) => (
              <div key={key}>
                <label className="label">{label}</label>
                <div className="relative">
                  <Icon size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type={type}
                    required={key !== "phone"}
                    className="input-field pl-10"
                    placeholder={placeholder}
                    value={form[key]}
                    onChange={set(key)}
                  />
                </div>
              </div>
            ))}

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type={showPass ? "text" : "password"}
                  required
                  className="input-field pl-10 pr-10"
                  placeholder="At least 6 characters"
                  value={form.password}
                  onChange={set("password")}
                />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label className="label">Confirm Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type={showPass ? "text" : "password"}
                  required
                  className="input-field pl-10"
                  placeholder="Repeat password"
                  value={form.confirm}
                  onChange={set("confirm")}
                />
              </div>
            </div>

            <p className="text-slate-500 text-xs">
              By creating an account, you agree to our{" "}
              <span className="text-green-400">Terms of Service</span> and{" "}
              <span className="text-green-400">Privacy Policy</span>.
            </p>

            <button type="submit" disabled={loading} className="btn-primary w-full py-3.5 flex items-center justify-center gap-2 mt-2">
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                  </svg>
                  Creating Account...
                </span>
              ) : "Create My Account"}
            </button>
          </form>

          <p className="text-center text-slate-500 text-sm mt-5">
            Already have an account?{" "}
            <Link to="/login" className="text-green-400 hover:text-green-300 font-medium">Sign In</Link>
          </p>
        </div>
      </div>
    </div>
  );
}