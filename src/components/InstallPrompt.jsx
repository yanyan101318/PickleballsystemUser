import { useEffect, useState } from "react";
import { Smartphone, X } from "lucide-react";

export default function InstallPrompt() {
  const [prompt, setPrompt] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") setPrompt(null);
  };

  const handleDismiss = () => {
    setDismissed(true);
    setPrompt(null);
  };

  if (!prompt || dismissed) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 bg-slate-800 border border-green-500/30 rounded-2xl p-4 flex items-center gap-3 shadow-xl">
      <div className="w-10 h-10 bg-green-500/10 rounded-xl flex items-center justify-center shrink-0">
        <Smartphone size={20} className="text-green-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white font-semibold text-sm">Install PickleBros App</p>
        <p className="text-slate-400 text-xs mt-0.5">Book courts faster from your home screen</p>
      </div>
      <button
        onClick={handleInstall}
        className="bg-green-500 hover:bg-green-400 text-white text-sm font-semibold px-4 py-2 rounded-xl shrink-0"
      >
        Install
      </button>
      <button onClick={handleDismiss} className="text-slate-500 hover:text-slate-300 shrink-0">
        <X size={18} />
      </button>
    </div>
  );
}