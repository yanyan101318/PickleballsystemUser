import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { MessageSquare, X, Send, Pin, AlertCircle, Paperclip, Loader2 } from "lucide-react";
import api from "../api";
import { io } from "socket.io-client";
import { Toaster, toast } from 'react-hot-toast';
import MessageOptionsMenu from "./chat/MessageOptionsMenu";

// Socket connection
const socket = io(import.meta.env.VITE_API_URL || "http://localhost:3000", { autoConnect: false });

export default function ChatWidget() {
  const { user, userProfile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  
  // Edit State
  const [editingMessage, setEditingMessage] = useState(null);
  
  // Image Attachment State
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isConverting, setIsConverting] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  // Modals
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [showReportConfirm, setShowReportConfirm] = useState(null);
  const [reportReason, setReportReason] = useState("");

  const messagesEndRef = useRef(null);

  // 1. Fetch messages
  const fetchMessages = async () => {
    if (!user?.uid) return;
    try {
      const { data } = await api.get('/chats/messages');
      setMessages(data);
      if (data.length > 0) {
        socket.connect();
        socket.emit('joinChat', data[0].chatId || data[0].chat_id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, [user?.uid]);
  
  // Socket.io Listeners
  useEffect(() => {
    socket.on('messageCreated', (msg) => {
      setMessages(prev => {
        if (prev.find(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    });

    socket.on('messageEdited', (updated) => {
      setMessages(prev => prev.map(m => m.id === updated.id ? { ...m, text: updated.text, isEdited: true } : m));
    });

    socket.on('messageDeleted', ({ id }) => {
      setMessages(prev => prev.map(m => m.id === id ? { ...m, text: "This message was deleted", image: null, isDeleted: true } : m));
    });

    socket.on('messagePinned', ({ id, isPinned }) => {
      setMessages(prev => prev.map(m => m.id === id ? { ...m, isPinned } : m));
    });

    socket.on('messageReacted', ({ id, reactions }) => {
      setMessages(prev => prev.map(m => m.id === id ? { ...m, reactions } : m));
    });

    return () => {
      socket.off('messageCreated');
      socket.off('messageEdited');
      socket.off('messageDeleted');
      socket.off('messagePinned');
      socket.off('messageReacted');
    };
  }, []);

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
    const interval = setInterval(fetchUnreadCount, 5000);
    return () => clearInterval(interval);
  }, [user?.uid]);

  // 3. Mark read
  useEffect(() => {
    if (!user?.uid) return;
    if (isOpen) {
      api.post('/chats/mark-read').catch(console.error);
      setUnreadCount(0);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  }, [isOpen, messages.length, user?.uid]);

  // Image Handling
  const processFile = (file) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Only image files are allowed');
      return;
    }
    if (file.size > 2 * 1024 * 1024) { // 2MB
      toast.error('Image size must be less than 2MB');
      return;
    }
    
    setIsConverting(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target.result);
      setImageFile(file);
      setIsConverting(false);
    };
    reader.onerror = () => {
      toast.error('Error reading file');
      setIsConverting(false);
    };
    reader.readAsDataURL(file);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    if (e.target) e.target.value = '';
  };

  const handlePaste = (e) => {
    const file = e.clipboardData.files?.[0];
    if (file) {
      e.preventDefault();
      processFile(file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };
  
  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };
  
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!user?.uid || (!newMessage.trim() && !imagePreview)) return;
    
    try {
      if (editingMessage) {
        await api.put(`/chats/messages/${editingMessage.id}`, { text: newMessage.trim() });
        setEditingMessage(null);
      } else {
        const senderName = userProfile?.fullName || user.displayName || "Customer";
        
        // Split mixed payloads
        const textContent = newMessage.trim();
        const hasText = !!textContent;
        const hasImage = !!imagePreview;
        
        let chatIdToJoin = null;
        let groupId = null;
        
        if (hasText && hasImage) {
          groupId = 'grp_' + Date.now().toString(36) + Math.random().toString(36).substring(2);
        }

        if (hasImage) {
          const { data } = await api.post('/chats/messages', {
            text: "",
            senderName,
            image: imagePreview,
            groupId
          });
          chatIdToJoin = data.chatId;
        }

        if (hasText) {
          const { data } = await api.post('/chats/messages', {
            text: textContent,
            senderName,
            image: null,
            groupId
          });
          if (!chatIdToJoin) chatIdToJoin = data.chatId;
        }

        if (chatIdToJoin) {
          socket.connect();
          socket.emit('joinChat', chatIdToJoin);
        }
      }
      setNewMessage("");
      setImagePreview(null);
      setImageFile(null);
      
      const { data: updatedMessages } = await api.get('/chats/messages');
      setMessages(updatedMessages);
    } catch (err) {
      toast.error("Failed to send message");
    }
  };

  const confirmDelete = async () => {
    if (!showDeleteConfirm) return;
    try {
      await api.delete(`/chats/messages/${showDeleteConfirm}`);
      setShowDeleteConfirm(null);
      toast.success("Message deleted");
      const { data } = await api.get('/chats/messages');
      setMessages(data);
    } catch (err) {
      toast.error("Failed to delete");
    }
  };

  const handlePin = async (msgId) => {
    try {
      await api.post(`/chats/messages/${msgId}/pin`);
      const { data } = await api.get('/chats/messages');
      setMessages(data);
    } catch (err) {
      toast.error("Failed to pin message");
    }
  };

  const handleReact = async (msgId, emoji) => {
    try {
      await api.post(`/chats/messages/${msgId}/react`, { emoji });
      const { data } = await api.get('/chats/messages');
      setMessages(data);
    } catch (err) {
      toast.error("Failed to react");
    }
  };

  const confirmReport = async () => {
    if (!showReportConfirm) return;
    try {
      await api.post(`/chats/messages/${showReportConfirm}/report`, { reason: reportReason });
      setShowReportConfirm(null);
      setReportReason("");
      toast.success("Message reported");
    } catch (err) {
      toast.error("Failed to report");
    }
  };

  if (!user) return null;

  const pinnedMessages = messages.filter(m => m.isPinned);

  return (
    <div className="fixed bottom-6 right-6 z-[999] font-sans">
      <Toaster position="top-center" />
      
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

      {isOpen && (
        <div 
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`w-[360px] sm:w-[380px] h-[480px] bg-[#1e293b] border ${isDragging ? 'border-green-500' : 'border-slate-700/50'} rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 transform scale-100 origin-bottom-right relative`}
        >
          
          {/* Drag Overlay */}
          {isDragging && (
            <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center border-4 border-dashed border-green-500 rounded-2xl pointer-events-none">
              <div className="text-white font-bold flex flex-col items-center gap-2">
                <Paperclip size={48} className="text-green-400" />
                <p>Drop image here to attach</p>
              </div>
            </div>
          )}

          {/* Header */}
          <div className="bg-slate-900 border-b border-slate-700/40 p-4 flex items-center justify-between z-10">
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
            <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white transition-colors cursor-pointer">
              <X size={18} />
            </button>
          </div>

          {/* Pinned Messages Banner */}
          {pinnedMessages.length > 0 && (
            <div className="bg-slate-800/80 border-b border-slate-700/50 p-2 flex gap-2 items-start text-xs z-10 shadow-md">
              <Pin size={14} className="text-green-400 mt-0.5 shrink-0" />
              <div className="flex-1 overflow-hidden">
                <p className="text-slate-300 font-semibold mb-1">Pinned Message</p>
                <p className="text-slate-400 truncate">{pinnedMessages[pinnedMessages.length - 1].text}</p>
              </div>
            </div>
          )}

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#0f172a]/20">
            {messages.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs">
                Send a message to start chatting with court staff!
              </div>
            ) : (
              messages.map((m, index) => {
                if (m.isDeleted) {
                  // Skip if this is a grouped message and the previous one was already rendered as deleted
                  if (m.groupId && index > 0) {
                    const prevM = messages[index - 1];
                    if (prevM.isDeleted && prevM.groupId === m.groupId) {
                      return null;
                    }
                  }
                  return (
                    <div key={m.id} className="flex justify-center my-1 w-full">
                      <div className="text-[11px] text-slate-500/70 italic bg-transparent px-3 py-1">
                        This message was deleted
                      </div>
                    </div>
                  );
                }

                const isMe = m.senderId === user.uid;
                let time = "";
                if (m.createdAt) {
                  try {
                    const dateObj = typeof m.createdAt.toDate === "function" ? m.createdAt.toDate() : new Date(m.createdAt);
                    if (dateObj instanceof Date && !isNaN(dateObj.getTime())) {
                      time = dateObj.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                    }
                  } catch (e) {}
                }
                return (
                  <div key={m.id} className={`flex group ${isMe ? "justify-end" : "justify-start"}`}>
                    
                    {!isMe && (
                      <div className="flex items-center justify-center mr-1">
                        <MessageOptionsMenu 
                          message={m} 
                          isMe={isMe} 
                          onPin={() => handlePin(m.id)}
                          onReact={(emoji) => handleReact(m.id, emoji)}
                          onReport={() => setShowReportConfirm(m.id)}
                        />
                      </div>
                    )}

                    <div className="flex flex-col relative max-w-[75%] gap-1">
                      {m.image && (
                        <div className={`rounded-2xl shadow-sm overflow-hidden ${m.isDeleted ? 'opacity-60' : ''}`}>
                          <img 
                            src={m.image} 
                            alt="Attachment" 
                            className="max-w-full max-h-48 rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => setLightboxImage(m.image)}
                          />
                          {!m.text && (
                            <div className={`text-[9px] mt-1 flex gap-2 justify-end items-center ${isMe ? "text-slate-400" : "text-slate-500"}`}>
                              <span>{time}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {m.text && (
                        <div className={`rounded-2xl px-3.5 py-2 text-xs leading-relaxed shadow-sm ${
                            isMe ? "bg-green-500 text-slate-950 rounded-tr-none" : "bg-slate-800 text-slate-100 rounded-tl-none border border-slate-700/30"
                          } ${m.isDeleted ? 'opacity-60 italic' : ''}`}
                        >
                          <p className="whitespace-pre-wrap break-words">{m.text}</p>
                          
                          <div className={`text-[9px] mt-0.5 flex gap-2 justify-end items-center ${isMe ? "text-slate-800/80" : "text-slate-500"}`}>
                            {m.isEdited && <span>(edited)</span>}
                            <span>{time}</span>
                          </div>
                        </div>
                      )}

                      {/* Reactions Display */}
                      {m.reactions && Object.keys(m.reactions).length > 0 && (
                        <div className={`flex gap-1 mt-1 ${isMe ? "justify-end" : "justify-start"}`}>
                          {Object.entries(m.reactions).map(([emoji, users]) => (
                            <div key={emoji} className="bg-slate-800 border border-slate-700 rounded-full px-1.5 py-0.5 text-[10px] flex items-center gap-1 shadow-sm">
                              <span>{emoji}</span>
                              <span className="text-slate-400">{users.length}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {isMe && (
                      <div className="flex items-center justify-center ml-1">
                        <MessageOptionsMenu 
                          message={m} 
                          isMe={isMe} 
                          onEdit={() => { setEditingMessage(m); setNewMessage(m.text || ""); }}
                          onDelete={() => setShowDeleteConfirm(m.id)}
                          onPin={() => handlePin(m.id)}
                          onReact={(emoji) => handleReact(m.id, emoji)}
                        />
                      </div>
                    )}

                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Image Preview Area */}
          {imagePreview && (
            <div className="bg-slate-800 p-2 border-t border-slate-700 flex items-center justify-between z-10 shadow-lg">
              <div className="relative">
                <img src={imagePreview} alt="Preview" className="h-16 w-16 object-cover rounded shadow-sm border border-slate-600" />
                <button 
                  onClick={() => { setImagePreview(null); setImageFile(null); }}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-400 shadow-md"
                >
                  <X size={12} />
                </button>
              </div>
              <div className="text-xs text-slate-400 mr-2">Image attached</div>
            </div>
          )}

          {/* Send Input Form */}
          {editingMessage && (
            <div className="bg-slate-800 p-2 border-t border-slate-700 flex justify-between items-center text-xs text-slate-300">
              <span>Editing message...</span>
              <button onClick={() => { setEditingMessage(null); setNewMessage(""); }} className="hover:text-white">Cancel</button>
            </div>
          )}
          <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-700/40 bg-slate-900 flex gap-2 items-center">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileSelect}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isConverting}
              className="p-2 text-slate-400 hover:text-green-400 hover:bg-slate-800 rounded-full transition-colors cursor-pointer disabled:opacity-50"
            >
              {isConverting ? <Loader2 size={18} className="animate-spin" /> : <Paperclip size={18} />}
            </button>
            <input
              type="text"
              placeholder={editingMessage ? "Edit message..." : "How can we help you?"}
              className="flex-1 px-3 py-2 text-xs rounded-xl bg-slate-800 border border-slate-700/60 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-green-500 transition-all"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onPaste={handlePaste}
            />
            <button
              type="submit"
              disabled={(!newMessage.trim() && !imagePreview) || isConverting}
              className="px-3 py-2 bg-green-500 hover:bg-green-400 text-slate-950 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer transition-colors"
            >
              <Send size={14} />
            </button>
          </form>

          {/* Delete Confirm Modal */}
          {showDeleteConfirm && (
            <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in zoom-in duration-200">
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 shadow-2xl w-full max-w-sm">
                <h3 className="text-white font-bold mb-2">Delete Message?</h3>
                <p className="text-slate-400 text-xs mb-4">This action cannot be undone.</p>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setShowDeleteConfirm(null)} className="px-4 py-2 text-xs rounded-lg text-slate-300 hover:bg-slate-700">Cancel</button>
                  <button onClick={confirmDelete} className="px-4 py-2 text-xs rounded-lg bg-red-500 text-white hover:bg-red-600">Delete</button>
                </div>
              </div>
            </div>
          )}

          {/* Report Modal */}
          {showReportConfirm && (
            <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in zoom-in duration-200">
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 shadow-2xl w-full max-w-sm">
                <h3 className="text-white font-bold mb-2 flex items-center gap-2"><AlertCircle size={16} className="text-orange-400"/> Report Message</h3>
                <p className="text-slate-400 text-xs mb-3">Why are you reporting this message?</p>
                <select 
                  value={reportReason} 
                  onChange={(e) => setReportReason(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white mb-4 outline-none focus:border-green-500"
                >
                  <option value="">Select a reason...</option>
                  <option value="spam">Spam or Abuse</option>
                  <option value="inappropriate">Inappropriate Content</option>
                  <option value="other">Other</option>
                </select>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setShowReportConfirm(null)} className="px-4 py-2 text-xs rounded-lg text-slate-300 hover:bg-slate-700">Cancel</button>
                  <button disabled={!reportReason} onClick={confirmReport} className="px-4 py-2 text-xs rounded-lg bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50">Submit Report</button>
                </div>
              </div>
            </div>
          )}

        </div>
      )}
      
      {/* Lightbox Modal for Images */}
      {lightboxImage && (
        <div 
          className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[1000] flex items-center justify-center" 
          onClick={() => setLightboxImage(null)}
        >
          <button 
            className="absolute top-4 right-4 text-white hover:text-slate-300 bg-slate-800/50 hover:bg-slate-700/50 p-2 rounded-full transition-colors"
            onClick={() => setLightboxImage(null)}
          >
            <X size={24} />
          </button>
          <img 
            src={lightboxImage} 
            alt="Fullscreen view" 
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-md shadow-2xl animate-in zoom-in duration-200"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
