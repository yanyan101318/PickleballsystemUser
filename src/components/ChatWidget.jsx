// src/components/ChatWidget.jsx
import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { MessageSquare, X, Send } from "lucide-react";
import api from "../api";

export default function ChatWidget() {
  const { user, userProfile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef(null);

  // 1. Fetch messages for the current user's chat channel
  const fetchMessages = async () => {
    if (!user?.uid) return;
    try {
      const { data } = await api.get('/chats/messages');
      setMessages(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 5000); // Polling for now
    return () => clearInterval(interval);
  }, [user?.uid]);

  // 2. Fetch unread count
  const fetchUnreadCount = async () => {
    if (!user?.uid) return;
    try {
      const { data } = await api.get('/chats/unread');
      setUnreadCount(data.unread);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 5000); // Polling for now
    return () => clearInterval(interval);
  }, [user?.uid]);

  // 3. Mark messages as read by customer when chat is opened
  useEffect(() => {
    if (!user?.uid) return;
    if (isOpen) {
      api.post('/chats/mark-read').catch(console.error);
      setUnreadCount(0);
      
      // Scroll to bottom
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  }, [isOpen, messages.length, user?.uid]);

  // 4. Send Message
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!user?.uid || !newMessage.trim()) return;
    const messageText = newMessage.trim();
    setNewMessage("");
    try {
      const senderName = userProfile?.fullName || user.displayName || "Customer";
      const { data } = await api.post('/chats/messages', {
        text: messageText,
        senderName
      });
      setMessages(prev => [...prev, data]);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } catch (err) {
      console.error("Failed to send message:", err);
    }
  };

  // If user is not logged in, we don't display the chat bubble (placed at the bottom to respect Rules of Hooks)
  if (!user) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[999] font-sans">
      {/* Floating Chat Bubble Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="w-14 h-14 rounded-full bg-green-500 hover:bg-green-400 text-slate-950 flex items-center justify-center shadow-lg transition-transform hover:scale-105 relative cursor-pointer"
          aria-label="Open support chat"
        >
          <MessageSquare size={24} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow animate-bounce">
              {unreadCount}
            </span>
          )}
        </button>
      )}

      {/* Slide-Up Chat Window */}
      {isOpen && (
        <div className="w-[360px] sm:w-[380px] h-[480px] bg-[#1e293b] border border-slate-700/50 rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 transform scale-100 origin-bottom-right">
          {/* Header */}
          <div className="bg-slate-900 border-b border-slate-700/40 p-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center text-green-400 font-bold text-sm">
                R
              </div>
              <div>
                <h4 className="font-bold text-white text-xs">PickleBros Support</h4>
                <p className="text-[9px] text-green-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  Online
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#0f172a]/20">
            {messages.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs">
                Send a message to start chatting with court staff!
              </div>
            ) : (
              messages.map((m) => {
                const isMe = m.senderId === user.uid;
                let time = "";
                if (m.createdAt) {
                  try {
                    const dateObj = typeof m.createdAt.toDate === "function"
                      ? m.createdAt.toDate()
                      : m.createdAt.seconds
                        ? new Date(m.createdAt.seconds * 1000)
                        : new Date(m.createdAt);
                    if (dateObj instanceof Date && !isNaN(dateObj.getTime())) {
                      time = dateObj.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      });
                    }
                  } catch (e) {
                    console.error("Error formatting chat message date:", e);
                  }
                }
                return (
                  <div
                    key={m.id}
                    className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed shadow-sm ${
                        isMe
                          ? "bg-green-500 text-slate-950 rounded-tr-none"
                          : "bg-slate-800 text-slate-100 rounded-tl-none border border-slate-700/30"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{m.text}</p>
                      <div
                        className={`text-[9px] mt-0.5 text-right ${
                          isMe ? "text-slate-800/80" : "text-slate-500"
                        }`}
                      >
                        {time}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Send Input Form */}
          <form
            onSubmit={handleSendMessage}
            className="p-3 border-t border-slate-700/40 bg-slate-900 flex gap-2"
          >
            <input
              type="text"
              placeholder="How can we help you?"
              className="flex-1 px-3 py-2 text-xs rounded-xl bg-slate-800 border border-slate-700/60 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500 transition-all"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
            />
            <button
              type="submit"
              disabled={!newMessage.trim()}
              className="px-3 py-2 bg-green-500 hover:bg-green-400 text-slate-950 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center shrink-0 cursor-pointer"
            >
              <Send size={14} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
