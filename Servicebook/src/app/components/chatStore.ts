import { useState, useEffect, useCallback, useRef } from 'react';
import { authService } from './authService';

const API_BASE = '/api';

export interface ChatMessage {
  id: number;
  sender_id: number;
  receiver_id: number;
  message: string;
  created_at: string;
}

export interface Conversation {
  other_user: {
    id: number;
    username: string;
    roles: string[];
  };
  last_message: ChatMessage;
}

export interface AdminConversation {
  user1: {
    id: number;
    username: string;
    roles: string[];
  };
  user2: {
    id: number;
    username: string;
    roles: string[];
  };
  last_message: ChatMessage;
}

export const chatStore = {
  async getConversations(): Promise<Conversation[]> {
    const res = await fetch(`${API_BASE}/chats/conversations`, { headers: authService.getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch conversations');
    return await res.json();
  },

  async getAdminConversations(): Promise<AdminConversation[]> {
    const res = await fetch(`${API_BASE}/admin/chats/conversations`, { headers: authService.getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch admin conversations');
    return await res.json();
  },

  async getHistory(withUserId: number): Promise<ChatMessage[]> {
    const res = await fetch(`${API_BASE}/chats/history?with_user_id=${withUserId}`, {
      headers: authService.getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to fetch chat history');
    return await res.json();
  },

  async getAdminHistory(user1Id: number, user2Id: number): Promise<ChatMessage[]> {
    const res = await fetch(`${API_BASE}/chats/history?user1_id=${user1Id}&user2_id=${user2Id}`, {
      headers: authService.getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to fetch admin chat history');
    return await res.json();
  },

  async sendHttpMessage(receiverId: number, message: string): Promise<ChatMessage> {
    const res = await fetch(`${API_BASE}/chats/send`, {
      method: 'POST',
      headers: authService.getAuthHeaders(),
      body: JSON.stringify({ receiver_id: receiverId, message })
    });
    if (!res.ok) throw new Error('Failed to send message via HTTP');
    return await res.json();
  }
};

/**
 * Custom hook to manage WebSocket connection and message routing.
 */
export function useChatWebSocket(onIncomingMessage?: (msg: ChatMessage) => void) {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let socket: WebSocket;
    let isMounted = true;
    let reconnectTimeout: ReturnType<typeof setTimeout>;

    const connect = () => {
      const token = localStorage.getItem('sb_access_token');
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsHost = import.meta.env.VITE_WS_URL || `${protocol}//${host}`;
      const wsUrl = token 
        ? `${wsHost}/api/ws?token=${token}` 
        : `${wsHost}/api/ws`;

      console.log(`Connecting to WebSocket: ${wsUrl}`);
      socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      socket.onopen = () => {
        console.log('✓ Chat WebSocket Connected');
        if (isMounted) {
          setWs(socket);
          setIsConnected(true);
        }
      };

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'chat_message' && payload.data) {
            if (onIncomingMessage) {
              onIncomingMessage(payload.data);
            }
          }
        } catch (e) {
          console.error("Error parsing WS message", e);
        }
      };

      socket.onclose = () => {
        console.log('✗ Chat WebSocket Disconnected');
        if (isMounted) {
          setWs(null);
          setIsConnected(false);
          // Auto reconnect after 3 seconds
          reconnectTimeout = setTimeout(connect, 3000);
        }
      };

      socket.onerror = (err) => {
        console.error("WebSocket Error:", err);
      };
    };

    connect();

    return () => {
      isMounted = false;
      clearTimeout(reconnectTimeout);
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [onIncomingMessage]);

  const sendWsMessage = useCallback((receiverId: number, messageText: string) => {
    const socket = socketRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: 'chat_message',
        receiver_id: receiverId,
        message: messageText
      }));
      return true;
    }
    return false;
  }, []);

  return { sendWsMessage, isConnected };
}
