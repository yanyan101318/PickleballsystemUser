import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { User, Mail, Phone, Shield, Save, Award, Edit2 } from "lucide-react";
import toast from "react-hot-toast";

const MEMBERSHIPS = [
  { id: "basic", label: "Basic", price: "Free", perks: ["Court booking", "Email support", "Basic scheduling"], color: "slate" },
  { id: "pro", label: "Pro", price: "₱299/mo", perks: ["Priority booking", "10% discount", "Equipment rental perks", "Cancellation protection"], color: "green" },
  { id: "premium", label: "Premium", price: "₱599/mo", perks: ["VIP court access", "20% discount", "Free equipment rental", "Dedicated coach slot", "Guest passes"], color: "yellow" },
];

export default function Profile() {
  const { user, userProfile, updateUserProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    fullName: userProfile?.fullName || "",
    phone: userProfile?.phone || "",
    bio: userProfile?.bio || "",
    skillLevel: userProfile?.skillLevel || "beginner",
  });

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateUserProfile(form);
      toast.success("Profile updated!");
      setEditing(false);
    } catch {
      toast.error("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const currentMembership = userProfile?.membership || "basic";
  const memberCfg = MEMBERSHIPS.find((m) => m.id === currentMembership) || MEMBERSHIPS[0];

  return (
    <div className="min-h-screen court-pattern pt-20 pb-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="pt-6 mb-8">
          <h1 className="font-display text-4xl tracking-wider text-white">MY <span className="gradient-text">PROFILE</span></h1>
          <p className="text-slate-500 mt-1">Manage your account details</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Avatar & Quick Info */}
          <div className="card p-6 text-center">
            <div className="w-24 h-24 bg-green-500/20 border-2 border-green-500/40 rounded-2xl flex items-center justify-center mx-auto mb-4 glow-green">
              <span className="font-display text-4xl text-green-400 tracking-wider">
                {(userProfile?.fullName || user?.email || "U")[0].toUpperCase()}
              </span>
            </div>
            <h3 className="text-white font-semibold text-lg">{userProfile?.fullName || "Player"}</h3>
            <p className="text-slate-500 text-sm mt-0.5">{user?.email}</p>
            <div className={`inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-full text-xs font-medium ${
              currentMembership === "premium" ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/20" :
              currentMembership === "pro" ? "bg-green-500/20 text-green-400 border border-green-500/20" :
              "bg-slate-800 text-slate-400"
            }`}>
              <Award size={12} /> {memberCfg.label} Member
            </div>

            <div className="border-t border-slate-800 mt-5 pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Skill Level</span>
                <span className="text-white capitalize">{userProfile?.skillLevel || "Beginner"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Joined</span>
                <span className="text-white text-xs">{userProfile?.createdAt?.toDate?.()?.getFullYear() || "2025"}</span>
              </div>
            </div>
          </div>

          {/* Edit Form */}
          <div className="lg:col-span-2 card p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <User size={18} className="text-green-400" /> Personal Information
              </h3>
              {!editing ? (
                <button onClick={() => setEditing(true)} className="btn-ghost text-sm flex items-center gap-1.5">
                  <Edit2 size={14} /> Edit
                </button>
              ) : (
                <button onClick={() => setEditing(false)} className="btn-ghost text-sm text-slate-500">
                  Cancel
                </button>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <label className="label">Full Name</label>
                <div className="relative">
                  <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    disabled={!editing}
                    className={`input-field pl-10 ${!editing ? "opacity-60 cursor-not-allowed" : ""}`}
                    value={form.fullName}
                    onChange={set("fullName")}
                  />
                </div>
              </div>

              <div>
                <label className="label">Email Address</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="email"
                    disabled
                    className="input-field pl-10 opacity-60 cursor-not-allowed"
                    value={user?.email || ""}
                  />
                </div>
                <p className="text-slate-600 text-xs mt-1">Email cannot be changed.</p>
              </div>

              <div>
                <label className="label">Phone Number</label>
                <div className="relative">
                  <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="tel"
                    disabled={!editing}
                    className={`input-field pl-10 ${!editing ? "opacity-60 cursor-not-allowed" : ""}`}
                    placeholder="09XX-XXX-XXXX"
                    value={form.phone}
                    onChange={set("phone")}
                  />
                </div>
              </div>

              <div>
                <label className="label">Skill Level</label>
                <select
                  disabled={!editing}
                  className={`input-field ${!editing ? "opacity-60 cursor-not-allowed" : ""}`}
                  value={form.skillLevel}
                  onChange={set("skillLevel")}
                >
                  {["beginner", "intermediate", "advanced", "pro"].map((s) => (
                    <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Bio (Optional)</label>
                <textarea
                  rows={3}
                  disabled={!editing}
                  className={`input-field resize-none ${!editing ? "opacity-60 cursor-not-allowed" : ""}`}
                  placeholder="Tell others about your game..."
                  value={form.bio}
                  onChange={set("bio")}
                />
              </div>

              {editing && (
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="btn-primary w-full py-3 flex items-center justify-center gap-2"
                >
                  {saving ? "Saving..." : <><Save size={16} /> Save Changes</>}
                </button>
              )}
            </div>
          </div>

          {/* Membership Card */}
          <div className="lg:col-span-3 card p-6">
            <div className="flex items-center gap-2 mb-5">
              <Shield size={18} className="text-green-400" />
              <h3 className="text-white font-semibold">Membership Plans</h3>
            </div>
            <div className="grid sm:grid-cols-3 gap-4">
              {MEMBERSHIPS.map((plan) => {
                const isActive = currentMembership === plan.id;
                return (
                  <div key={plan.id} className={`rounded-xl p-5 border transition-all ${
                    isActive ? "border-green-500 bg-green-500/10" : "border-slate-700 bg-slate-800"
                  }`}>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-white font-semibold">{plan.label}</h4>
                      {isActive && <span className="badge-green text-xs">Current</span>}
                    </div>
                    <div className="text-2xl font-bold text-green-400 mb-3">{plan.price}</div>
                    <ul className="space-y-1.5 mb-4">
                      {plan.perks.map((perk) => (
                        <li key={perk} className="flex items-center gap-1.5 text-slate-400 text-xs">
                          <span className="w-1 h-1 bg-green-500 rounded-full" /> {perk}
                        </li>
                      ))}
                    </ul>
                    {!isActive && (
                      <button className="btn-primary w-full text-xs py-2">Upgrade</button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}