import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import {
  MessageSquare,
  Send,
  Circle,
  Search,
  User,
  Users
} from 'lucide-react';
import { FirmSidebar } from './FirmSidebar';
import { authService } from '../authService';
import { chatStore, ChatMessage, AdminConversation, useChatWebSocket } from '../chatStore';

export function FirmChats() {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<AdminConversation[]>([]);
  const [activeConv, setActiveConv] = useState<AdminConversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // For Client-Employee chats, admin can choose who to reply to
  const [replyTargetId, setReplyTargetId] = useState<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchConversations = async () => {
    try {
      const data = await chatStore.getAdminConversations();
      setConversations(data);
    } catch (err) {
      console.error("Failed to load admin conversations", err);
    }
  };

  const loadActiveChatHistory = async (u1Id: number, u2Id: number) => {
    try {
      const history = await chatStore.getAdminHistory(u1Id, u2Id);
      setMessages(history);
    } catch (err) {
      console.error("Failed to load chat history", err);
    }
  };

  // Setup WebSocket incoming message handler
  const handleIncomingMessage = useCallback((msg: ChatMessage) => {
    if (activeConv) {
      const u1 = activeConv.user1.id;
      const u2 = activeConv.user2.id;
      const msgUsers = [msg.sender_id, msg.receiver_id];
      if (msgUsers.includes(u1) && msgUsers.includes(u2)) {
        setMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      }
    }
    fetchConversations();
  }, [activeConv]);

  const { sendWsMessage, isConnected } = useChatWebSocket(handleIncomingMessage);

  useEffect(() => {
    const user = authService.getCurrentUser();
    setCurrentUser(user);
    
    setIsLoading(true);
    fetchConversations().finally(() => {
      setIsLoading(false);
    });
  }, []);

  // When active conversation changes, load history and set default reply target
  useEffect(() => {
    if (activeConv && currentUser) {
      loadActiveChatHistory(activeConv.user1.id, activeConv.user2.id);
      
      // Decide default reply target
      if (activeConv.user1.id === currentUser.user_id) {
        setReplyTargetId(activeConv.user2.id);
      } else if (activeConv.user2.id === currentUser.user_id) {
        setReplyTargetId(activeConv.user1.id);
      } else {
        // If it's a Client ↔ Employee conversation:
        // By default, reply to the Client (who is usually the one with 'client' role)
        const clientUser = activeConv.user1.roles.includes('client') ? activeConv.user1 : activeConv.user2;
        setReplyTargetId(clientUser.id);
      }
    } else {
      setMessages([]);
      setReplyTargetId(null);
    }
  }, [activeConv, currentUser]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !activeConv || !replyTargetId) return;

    const text = message.trim();
    setMessage('');

    const sent = sendWsMessage(replyTargetId, text);
    if (!sent) {
      try {
        const newMsg = await chatStore.sendHttpMessage(replyTargetId, text);
        setMessages(prev => [...prev, newMsg]);
        fetchConversations();
      } catch (err) {
        alert("Failed to send message.");
      }
    }
  };

  const getChatPartnerName = (conv: AdminConversation) => {
    if (!currentUser) return 'Conversation';
    if (conv.user1.id === currentUser.user_id) return conv.user2.username;
    if (conv.user2.id === currentUser.user_id) return conv.user1.username;
    return `${conv.user1.username} ↔ ${conv.user2.username}`;
  };

  const getChatPartnerRole = (conv: AdminConversation) => {
    if (!currentUser) return '';
    if (conv.user1.id === currentUser.user_id) return conv.user2.roles.join(', ');
    if (conv.user2.id === currentUser.user_id) return conv.user1.roles.join(', ');
    return 'Client ↔ Employee';
  };

  const filteredConversations = conversations.filter(conv => {
    const partnerName = getChatPartnerName(conv).toLowerCase();
    return partnerName.includes(searchQuery.toLowerCase());
  });

  return (
    <div className="flex h-screen bg-white dark:bg-chat-bg text-[#013220] dark:text-[#8FAF8A]">
      <FirmSidebar />

      {/* Inbox Sidebar */}
      <div className="w-96 bg-[#F5F5DC] dark:bg-chat-inbox border-r border-[#013220]/10 dark:border-white/5 flex flex-col">
        <div className="p-6 border-b border-[#013220]/10 dark:border-white/5">
          <h2 className="text-2xl text-[#013220] dark:text-[#8FAF8A] mb-4" style={{ fontFamily: 'Playfair Display, serif' }}>
            Master Inbox
          </h2>
          <div className="relative">
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-chat-bg border border-[#013220]/10 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-[#D4AF37] text-sm text-[#013220] dark:text-[#8FAF8A]"
            />
            <Search className="absolute left-3.5 top-3 text-[#013220]/40 dark:text-[#8FAF8A]/40" size={16} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {isLoading ? (
            <p className="text-xs text-[#013220]/40 px-2">Loading inbox...</p>
          ) : filteredConversations.length === 0 ? (
            <p className="text-xs text-[#013220]/40 px-2 italic">No active conversations found</p>
          ) : (
            filteredConversations.map((conv, index) => {
              const isSelected = activeConv && 
                ((activeConv.user1.id === conv.user1.id && activeConv.user2.id === conv.user2.id) ||
                 (activeConv.user1.id === conv.user2.id && activeConv.user2.id === conv.user1.id));
              
              const initials = getChatPartnerName(conv).split(' ').map((n: string) => n[0]).join('').toUpperCase().substring(0, 2);
              
              return (
                <button
                  key={index}
                  onClick={() => setActiveConv(conv)}
                  className={`w-full p-4 rounded-[20px] text-left transition-all border border-[#013220]/5 dark:border-white/5 ${
                    isSelected ? 'bg-[#013220] dark:bg-chat-bubble-out text-white dark:text-chat-bg shadow-md' : 'bg-white dark:bg-chat-bg hover:bg-white/60 dark:hover:bg-chat-bg/60 text-[#013220] dark:text-[#8FAF8A]'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-full bg-[#D4AF37]/20 dark:bg-[#D4AF37]/10 text-[#013220] dark:text-[#D4AF37] flex items-center justify-center font-bold text-sm flex-shrink-0">
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h4 className="font-semibold text-sm truncate">{getChatPartnerName(conv)}</h4>
                        <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-md ${
                          isSelected ? 'bg-white/20 text-white' : 'bg-[#013220]/5 dark:bg-white/5 text-[#013220]/60 dark:text-[#8FAF8A]/60'
                        }`}>
                          {getChatPartnerRole(conv)}
                        </span>
                      </div>
                      <p className={`text-xs truncate ${isSelected ? 'text-white/70 dark:text-chat-bg/70' : 'text-[#013220]/60 dark:text-[#8FAF8A]/60'}`}>
                        {conv.last_message.message}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-white dark:bg-chat-bg">
        {activeConv ? (
          <>
            {/* Header */}
            <div className="p-6 border-b border-[#013220]/10 dark:border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-[#013220] dark:bg-chat-bubble-out text-white dark:text-chat-bg flex items-center justify-center font-semibold text-lg">
                  {getChatPartnerName(activeConv).split(' ').map((n: string) => n[0]).join('').toUpperCase().substring(0, 2)}
                </div>
                <div>
                  <h3 className="font-bold text-[#013220] dark:text-[#8FAF8A] text-lg">{getChatPartnerName(activeConv)}</h3>
                  <div className="flex items-center gap-1.5">
                    <Circle size={10} className={isConnected ? 'text-[#50C878] fill-[#50C878]' : 'text-gray-400 fill-gray-400'} />
                    <span className="text-xs text-[#013220]/60 dark:text-[#8FAF8A]/60">{isConnected ? 'Connected' : 'Offline / Reconnecting'}</span>
                  </div>
                </div>
              </div>

              {/* If it's a Client ↔ Employee conversation, let admin toggle who to reply to */}
              {currentUser && 
               activeConv.user1.id !== currentUser.user_id && 
               activeConv.user2.id !== currentUser.user_id && (
                <div className="flex items-center gap-2 bg-[#F5F5DC] dark:bg-chat-inbox p-1.5 rounded-[16px] border border-[#013220]/10 dark:border-white/5">
                  <span className="text-xs font-semibold text-[#013220]/60 dark:text-[#8FAF8A]/60 px-2">Reply To:</span>
                  <button
                    onClick={() => setReplyTargetId(activeConv.user1.id)}
                    className={`px-3 py-1.5 rounded-[12px] text-xs font-semibold transition-all ${
                      replyTargetId === activeConv.user1.id
                        ? 'bg-[#013220] dark:bg-chat-bubble-out text-white dark:text-chat-bg shadow-sm'
                        : 'text-[#013220]/70 dark:text-[#8FAF8A]/70 hover:text-[#013220] dark:hover:text-[#8FAF8A]'
                    }`}
                  >
                    {activeConv.user1.username}
                  </button>
                  <button
                    onClick={() => setReplyTargetId(activeConv.user2.id)}
                    className={`px-3 py-1.5 rounded-[12px] text-xs font-semibold transition-all ${
                      replyTargetId === activeConv.user2.id
                        ? 'bg-[#013220] dark:bg-chat-bubble-out text-white dark:text-chat-bg shadow-sm'
                        : 'text-[#013220]/70 dark:text-[#8FAF8A]/70 hover:text-[#013220] dark:hover:text-[#8FAF8A]'
                    }`}
                  >
                    {activeConv.user2.username}
                  </button>
                </div>
              )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50/50 dark:bg-chat-inbox/50">
              {messages.map((msg) => {
                const senderName = msg.sender_id === activeConv.user1.id ? activeConv.user1.username : activeConv.user2.username;
                const isMe = currentUser && msg.sender_id === currentUser.user_id;
                
                return (
                  <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`px-5 py-3 rounded-[20px] max-w-md shadow-sm ${
                      isMe 
                        ? 'bg-[#013220] dark:bg-chat-bubble-out text-white dark:text-chat-bg rounded-tr-sm' 
                        : 'bg-white dark:bg-chat-bubble-in text-[#013220] dark:text-[#8FAF8A] border border-[#013220]/5 dark:border-white/5 rounded-tl-sm'
                    }`}>
                      {!isMe && (
                        <p className="text-[10px] font-bold text-[#D4AF37] mb-1">
                          {senderName}
                        </p>
                      )}
                      <p className="text-sm">{msg.message}</p>
                      <p className={`text-[9px] mt-1 text-right ${isMe ? 'text-white/60 dark:text-chat-bg/60' : 'text-[#013220]/40 dark:text-[#8FAF8A]/40'}`}>
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <form onSubmit={handleSendMessage} className="p-6 border-t border-[#013220]/10 dark:border-white/5 bg-white dark:bg-chat-bg">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={`Send reply to ${
                    replyTargetId === activeConv.user1.id ? activeConv.user1.username : 
                    replyTargetId === activeConv.user2.id ? activeConv.user2.username : 'recipient'
                  }...`}
                  className="flex-1 px-6 py-4 bg-[#F5F5DC]/40 dark:bg-chat-sidebar rounded-[24px] border border-[#013220]/10 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-[#D4AF37] text-[#013220] dark:text-[#8FAF8A]"
                />
                <button
                  type="submit"
                  disabled={!message.trim()}
                  className="px-6 py-4 bg-[#013220] dark:bg-chat-bubble-out text-white dark:text-chat-bg rounded-[24px] hover:bg-[#013220]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center"
                >
                  <Send size={20} />
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-center p-8 bg-gray-50/20 dark:bg-chat-inbox/20">
            <div>
              <Users size={48} className="text-[#013220]/15 dark:text-[#8FAF8A]/15 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-[#013220] dark:text-[#8FAF8A] mb-1" style={{ fontFamily: 'Playfair Display, serif' }}>
                Master Inbox
              </h3>
              <p className="text-[#013220]/60 dark:text-[#8FAF8A]/60 max-w-sm text-sm">
                Select a channel on the left to monitor communications, check client messages, or coordinate directly.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
