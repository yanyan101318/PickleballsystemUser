import { Link } from "react-router-dom";
import { Check, Zap, Award, Crown, Star } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const PLANS = [
  {
    id: "basic",
    name: "Basic",
    price: "Free",
    period: "forever",
    icon: Star,
    color: "slate",
    description: "Perfect for casual players just starting out.",
    perks: [
      "Access to all 4 courts",
      "Online booking system",
      "Email support",
      "Booking history",
      "Receipt download",
    ],
    notIncluded: ["Priority booking", "Discounts", "Free equipment", "Coach access"],
  },
  {
    id: "pro",
    name: "Pro",
    price: "₱299",
    period: "/month",
    icon: Zap,
    color: "green",
    popular: true,
    description: "For regular players who want more value.",
    perks: [
      "Everything in Basic",
      "10% off all bookings",
      "Priority time slot selection",
      "Equipment rental discount (20%)",
      "Cancellation protection",
      "WhatsApp support",
    ],
    notIncluded: ["Free equipment", "VIP coach access"],
  },
  {
    id: "premium",
    name: "Premium",
    price: "₱599",
    period: "/month",
    icon: Crown,
    color: "yellow",
    description: "The ultimate experience for serious players.",
    perks: [
      "Everything in Pro",
      "20% off all bookings",
      "Free paddle & ball rental",
      "1 free coach session/month",
      "VIP court access (reservation guaranteed)",
      "2 guest passes/month",
      "Dedicated account manager",
    ],
    notIncluded: [],
  },
];

export default function Membership() {
  const { user, userProfile } = useAuth();
  const currentPlan = userProfile?.membership || "basic";

  return (
    <div className="min-h-screen court-pattern pt-20 pb-12 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="text-center pt-6 mb-12">
          <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-full px-4 py-1.5 mb-4">
            <Award size={14} className="text-green-400" />
            <span className="text-green-400 text-sm font-medium">Membership Plans</span>
          </div>
          <h1 className="font-display text-5xl tracking-wider text-white">
            LEVEL UP YOUR <span className="gradient-text">GAME</span>
          </h1>
          <p className="text-slate-500 mt-2 max-w-xl mx-auto">
            Choose a plan that fits your playing frequency. Upgrade or downgrade anytime.
          </p>
        </div>

        <div className="grid sm:grid-cols-3 gap-6">
          {PLANS.map((plan) => {
            const Icon = plan.icon;
            const isActive = currentPlan === plan.id;
            const colorMap = {
              slate: { border: "border-slate-700", header: "bg-slate-800", btn: "bg-slate-700 text-white hover:bg-slate-600", icon: "bg-slate-700 text-slate-400" },
              green: { border: "border-green-500", header: "bg-green-500/10", btn: "bg-green-500 text-slate-950 hover:bg-green-400", icon: "bg-green-500/20 text-green-400" },
              yellow: { border: "border-yellow-500/50", header: "bg-yellow-500/5", btn: "bg-yellow-500 text-slate-950 hover:bg-yellow-400", icon: "bg-yellow-500/20 text-yellow-400" },
            };
            const colors = colorMap[plan.color];

            return (
              <div key={plan.id} className={`card ${colors.border} overflow-hidden relative ${plan.popular ? "shadow-lg shadow-green-500/20" : ""}`}>
                {plan.popular && (
                  <div className="absolute top-0 right-0 bg-green-500 text-slate-950 text-xs font-bold px-3 py-1 rounded-bl-xl">
                    MOST POPULAR
                  </div>
                )}
                <div className={`p-5 ${colors.header}`}>
                  <div className={`w-12 h-12 ${colors.icon} rounded-xl flex items-center justify-center mb-3`}>
                    <Icon size={22} />
                  </div>
                  <h3 className="text-white font-bold text-xl mb-1">{plan.name}</h3>
                  <div className="flex items-end gap-0.5 mb-1">
                    <span className="text-3xl font-bold text-white">{plan.price}</span>
                    <span className="text-slate-400 text-sm mb-1">{plan.period}</span>
                  </div>
                  <p className="text-slate-400 text-sm">{plan.description}</p>
                </div>

                <div className="p-5">
                  <ul className="space-y-2.5 mb-5">
                    {plan.perks.map((perk) => (
                      <li key={perk} className="flex items-center gap-2.5 text-sm text-slate-300">
                        <div className="w-5 h-5 bg-green-500/20 rounded-full flex items-center justify-center shrink-0">
                          <Check size={11} className="text-green-400" />
                        </div>
                        {perk}
                      </li>
                    ))}
                    {plan.notIncluded.map((perk) => (
                      <li key={perk} className="flex items-center gap-2.5 text-sm text-slate-600">
                        <div className="w-5 h-5 bg-slate-800 rounded-full flex items-center justify-center shrink-0">
                          <span className="text-slate-700 text-xs">✕</span>
                        </div>
                        {perk}
                      </li>
                    ))}
                  </ul>

                  {isActive ? (
                    <div className="w-full py-2.5 rounded-xl border border-green-500/30 bg-green-500/10 text-green-400 text-sm font-medium text-center">
                      ✓ Your Current Plan
                    </div>
                  ) : user ? (
                    <button className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all ${colors.btn}`}>
                      {plan.id === "basic" ? "Downgrade" : "Upgrade Now"}
                    </button>
                  ) : (
                    <Link to="/register" className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all text-center block ${colors.btn}`}>
                      Get Started
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-10 card p-6 border-slate-800">
          <h3 className="text-white font-semibold mb-3 text-center">Frequently Asked Questions</h3>
          <div className="grid sm:grid-cols-2 gap-5">
            {[
              { q: "Can I cancel anytime?", a: "Yes, you can cancel your membership at any time. Your benefits continue until the end of the billing period." },
              { q: "Are discounts applied automatically?", a: "Yes! When you book, your membership discount is applied automatically at checkout." },
              { q: "What if I want to upgrade mid-month?", a: "Upgrades take effect immediately and you're billed a prorated amount for the remainder of the month." },
              { q: "Are there group/corporate plans?", a: "Yes! Contact us for custom corporate or group membership packages for your organization." },
            ].map(({ q, a }) => (
              <div key={q}>
                <h4 className="text-white text-sm font-medium mb-1">{q}</h4>
                <p className="text-slate-500 text-sm">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}