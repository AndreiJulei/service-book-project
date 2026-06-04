import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router';
import {
  Search,
  Calendar,
  MessageSquare,
  Settings,
  Send,
  Circle,
} from 'lucide-react';
import { authService } from '../authService';
import { chatStore, ChatMessage, Conversation, useChatWebSocket } from '../chatStore';

export function ClientChats() {
  const navigate = useNavigate();
  const location = useLocation();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [availableEmployees, setAvailableEmployees] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [activeReceiver, setActiveReceiver] = useState<any | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchConversations = async () => {
    try {
      const data = await chatStore.getConversations();
      setConversations(data);
    } catch (err) {
      console.error("Failed to load conversations", err);
    }
  };

  const fetchEmployees = async () => {
    try {
      const res = await fetch('/api/employees', { headers: authService.getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setAvailableEmployees(data);
      }
    } catch (err) {
      console.error("Failed to load employees list", err);
    }
  };

  const loadActiveChatHistory = async (receiverId: number) => {
    try {
      const history = await chatStore.getHistory(receiverId);
      setMessages(history);
    } catch (err) {
      console.error("Failed to load chat history", err);
    }
  };

  const fetchAppointments = async () => {
    try {
      const res = await fetch('/api/appointments?page_size=1000', { headers: authService.getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.items)) {
          setAppointments(data.items);
        } else if (Array.isArray(data)) {
          setAppointments(data);
        }
      }
    } catch (err) {
      console.error("Failed to load appointments list", err);
    }
  };

  // Setup WebSocket incoming message handler
  const handleIncomingMessage = useCallback((msg: ChatMessage) => {
    if (activeReceiver && (msg.sender_id === activeReceiver.id || msg.receiver_id === activeReceiver.id)) {
      setMessages(prev => {
        if (prev.some(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    }
    fetchConversations();
  }, [activeReceiver]);

  const { sendWsMessage, isConnected } = useChatWebSocket(handleIncomingMessage);

  useEffect(() => {
    const user = authService.getCurrentUser();
    setCurrentUser(user);
    
    setIsLoading(true);
    Promise.all([fetchConversations(), fetchEmployees(), fetchAppointments()]).finally(() => {
      setIsLoading(false);
    });
  }, []);

  // Handle opening directly via deep link state from appointments
  useEffect(() => {
    if (location.state?.openWith) {
      setActiveReceiver(location.state.openWith);
      // Clear navigation state so it doesn't reopen on reload
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // When active receiver changes, load history
  useEffect(() => {
    if (activeReceiver) {
      loadActiveChatHistory(activeReceiver.id);
    } else {
      setMessages([]);
    }
  }, [activeReceiver]);

  const handleSelectConversation = (otherUser: any) => {
    setActiveReceiver(otherUser);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !activeReceiver) return;

    const text = message.trim();
    setMessage('');

    // Try WS first
    const sent = sendWsMessage(activeReceiver.id, text);
    if (!sent) {
      // HTTP fallback
      try {
        const newMsg = await chatStore.sendHttpMessage(activeReceiver.id, text);
        setMessages(prev => [...prev, newMsg]);
        fetchConversations();
      } catch (err) {
        alert("Failed to send message.");
      }
    }
  };

  // Get unique employee IDs from appointments
  const bookedEmployeeIds = new Set(
    appointments.map(appt => String(appt.employee_id || appt.employeeId))
  );

  // Filter employees for search query and only display those the client has booked appointments with
  const filteredEmployees = availableEmployees.filter(emp => 
    emp.name.toLowerCase().includes(searchQuery.toLowerCase()) && 
    emp.user_id &&
    bookedEmployeeIds.has(String(emp.id))
  );

  return (
    <div className="flex h-screen bg-white dark:bg-chat-bg text-[#013220] dark:text-[#8FAF8A]">
      {/* Left Sidebar - Navigation */}
      <div className="w-20 bg-[#F5F5DC] dark:bg-chat-sidebar flex flex-col items-center py-8 gap-8 border-r border-[#013220]/10 dark:border-white/5 flex-shrink-0">
        <button
          onClick={() => navigate('/client/search')}
          className="p-4 rounded-[16px] text-[#013220] dark:text-[#8FAF8A] hover:bg-white dark:hover:bg-chat-bg transition-colors"
        >
          <Search size={24} />
        </button>
        <button
          onClick={() => navigate('/client/appointments')}
          className="p-4 rounded-[16px] text-[#013220] dark:text-[#8FAF8A] hover:bg-white dark:hover:bg-chat-bg transition-colors"
        >
          <Calendar size={24} />
        </button>
        <button
          onClick={() => navigate('/client/chats')}
          className="p-4 rounded-[16px] bg-[#013220] dark:bg-chat-bubble-out text-white dark:text-chat-bg"
        >
          <MessageSquare size={24} />
        </button>
        <button
          onClick={() => navigate('/client/settings')}
          className="p-4 rounded-[16px] text-[#013220] dark:text-[#8FAF8A] hover:bg-white dark:hover:bg-chat-bg transition-colors mt-auto"
        >
          <Settings size={24} />
        </button>
      </div>

      {/* Chat Sidebar / Lists */}
      <div className="w-96 bg-[#F5F5DC] dark:bg-chat-inbox border-r border-[#013220]/10 dark:border-white/5 flex flex-col">
        <div className="p-6 border-b border-[#013220]/10 dark:border-white/5">
          <h2 className="text-2xl text-[#013220] dark:text-[#8FAF8A] mb-4" style={{ fontFamily: 'Playfair Display, serif' }}>
            Messages
          </h2>
          {/* Search box to find employees */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search providers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-chat-bg rounded-[16px] border border-[#013220]/10 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-[#D4AF37] text-sm text-[#013220] dark:text-[#8FAF8A]"
            />
            <Search className="absolute left-3.5 top-3 text-[#013220]/40 dark:text-[#8FAF8A]/40" size={16} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {searchQuery === '' && (
            <div>
              <p className="text-xs font-semibold text-[#013220]/50 dark:text-[#8FAF8A]/50 px-2 mb-2 uppercase tracking-wider">Conversations</p>
              {isLoading ? (
                <p className="text-xs text-[#013220]/40 dark:text-[#8FAF8A]/40 px-2">Loading chats...</p>
              ) : conversations.length === 0 ? (
                <p className="text-xs text-[#013220]/40 dark:text-[#8FAF8A]/40 px-2 italic">No current conversations. Search staff members below to start chatting!</p>
              ) : (
                <div className="space-y-1.5">
                  {conversations.map((conv) => {
                    const isSelected = activeReceiver && activeReceiver.id === conv.other_user.id;
                    const initials = conv.other_user.username.split(' ').map((n: string) => n[0]).join('').toUpperCase().substring(0, 2);
                    return (
                      <button
                        key={conv.other_user.id}
                        onClick={() => handleSelectConversation({ id: conv.other_user.id, name: conv.other_user.username })}
                        className={`w-full p-3 rounded-[16px] text-left transition-all border border-[#013220]/5 dark:border-white/5 ${
                          isSelected ? 'bg-[#013220] dark:bg-chat-bubble-out text-white dark:text-chat-bg shadow-md' : 'bg-white dark:bg-chat-bg hover:bg-white/60 dark:hover:bg-chat-bg/60 text-[#013220] dark:text-[#8FAF8A]'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                            isSelected ? 'bg-[#D4AF37]/20 dark:bg-chat-bg/10 text-white dark:text-chat-bg' : 'bg-[#D4AF37]/20 dark:bg-[#D4AF37]/10 text-[#013220] dark:text-[#D4AF37]'
                          }`}>
                            {initials}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-sm truncate">{conv.other_user.username}</h4>
                            <p className={`text-xs truncate ${isSelected ? 'text-white/70 dark:text-[#013220]/70' : 'text-[#013220]/60 dark:text-[#8FAF8A]/60'}`}>
                              {conv.last_message.message}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Available Staff Section */}
          <div>
            <p className="text-xs font-semibold text-[#013220]/50 dark:text-[#8FAF8A]/50 px-2 mb-2 uppercase tracking-wider">
              {searchQuery ? 'Search Results' : 'Service Staff'}
            </p>
            <div className="space-y-1.5">
              {filteredEmployees.length === 0 ? (
                <p className="text-xs text-[#013220]/40 dark:text-[#8FAF8A]/40 px-2 italic">No matching providers found</p>
              ) : (
                filteredEmployees.map((emp) => {
                  const isSelected = activeReceiver && activeReceiver.id === emp.user_id;
                  const initials = emp.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().substring(0, 2);
                  return (
                    <button
                      key={emp.id}
                      onClick={() => handleSelectConversation({ id: emp.user_id, name: emp.name })}
                      className={`w-full p-3 rounded-[16px] text-left transition-all border border-[#013220]/5 dark:border-white/5 ${
                        isSelected ? 'bg-[#013220] dark:bg-chat-bubble-out text-white dark:text-chat-bg shadow-md' : 'bg-white dark:bg-chat-bg hover:bg-white/60 dark:hover:bg-chat-bg/60 text-[#013220] dark:text-[#8FAF8A]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                          isSelected ? 'bg-[#D4AF37]/20 dark:bg-chat-bg/10 text-white dark:text-chat-bg' : 'bg-[#013220]/10 text-[#013220] dark:text-[#8FAF8A]'
                        }`}>
                          {initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-sm truncate">{emp.name}</h4>
                          <p className="text-[10px] text-[#D4AF37] font-semibold uppercase">{emp.role || 'Staff member'}</p>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Chat Content Panel */}
      <div className="flex-1 flex flex-col bg-white dark:bg-chat-bg">
        {activeReceiver ? (
          <>
            {/* Active Header */}
            <div className="p-6 border-b border-[#013220]/10 dark:border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-[#013220] dark:bg-chat-bubble-out text-white dark:text-chat-bg flex items-center justify-center font-semibold text-lg">
                  {activeReceiver.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().substring(0, 2)}
                </div>
                <div>
                  <h3 className="font-bold text-[#013220] dark:text-[#8FAF8A] text-lg">{activeReceiver.name}</h3>
                  <div className="flex items-center gap-1.5">
                    <Circle size={10} className={isConnected ? 'text-[#50C878] fill-[#50C878]' : 'text-gray-400 fill-gray-400'} />
                    <span className="text-xs text-[#013220]/60 dark:text-[#8FAF8A]/60">{isConnected ? 'Connected' : 'Offline / Reconnecting'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Messages Feed */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50/50 dark:bg-chat-inbox/50">
              {messages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-center p-8">
                  <div>
                    <MessageSquare size={36} className="text-[#013220]/20 dark:text-[#8FAF8A]/20 mx-auto mb-2" />
                    <p className="text-[#013220]/60 dark:text-[#8FAF8A]/60 text-sm">This is the start of your chat history. Say hello!</p>
                  </div>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMe = currentUser && msg.sender_id === currentUser.user_id;
                  return (
                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`px-5 py-3 rounded-[20px] max-w-md shadow-sm ${
                        isMe 
                          ? 'bg-[#013220] dark:bg-chat-bubble-out text-white dark:text-chat-bg rounded-tr-sm' 
                          : 'bg-white dark:bg-chat-bubble-in text-[#013220] dark:text-[#8FAF8A] border border-[#013220]/5 dark:border-white/5 rounded-tl-sm'
                      }`}>
                        <p className="text-sm">{msg.message}</p>
                        <p className={`text-[9px] mt-1 text-right ${isMe ? 'text-white/60 dark:text-[#013220]/60' : 'text-[#013220]/40 dark:text-[#8FAF8A]/40'}`}>
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Form */}
            <form onSubmit={handleSendMessage} className="p-6 border-t border-[#013220]/10 dark:border-white/5 bg-white dark:bg-chat-bg">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Type your message..."
                  className="flex-1 px-6 py-4 bg-[#F5F5DC]/40 dark:bg-chat-sidebar rounded-[24px] border border-[#013220]/10 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-[#D4AF37] text-[#013220] dark:text-[#8FAF8A]"
                />
                <button
                  type="submit"
                  disabled={!message.trim()}
                  className="px-6 py-4 bg-[#013220] dark:bg-chat-bubble-out text-white dark:text-chat-bg rounded-[24px] hover:bg-[#013220]/90 dark:hover:bg-[#8FAF8A]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center"
                >
                  <Send size={20} />
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-center p-8 bg-gray-50/20 dark:bg-chat-inbox/20">
            <div>
              <MessageSquare size={48} className="text-[#013220]/15 dark:text-[#8FAF8A]/15 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-[#013220] dark:text-[#8FAF8A] mb-1" style={{ fontFamily: 'Playfair Display, serif' }}>
                Your Inbox
              </h3>
              <p className="text-[#013220]/60 dark:text-[#8FAF8A]/60 max-w-sm text-sm">
                Select a conversation on the left or search providers to coordinate appointments.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}