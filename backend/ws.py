"""
WebSocket handler for real-time chat with SQLAlchemy persistence.
"""

from datetime import datetime
import json

# active_clients maps user_id (int) to their WebSocket connection
active_clients = {}

def register_client(user_id: int, ws):
    """Register a new WebSocket client by user ID."""
    active_clients[user_id] = ws
    print(f"✓ User {user_id} connected ({len(active_clients)} active)")

def unregister_client(user_id: int):
    """Unregister a WebSocket client by user ID."""
    if user_id in active_clients:
        del active_clients[user_id]
        print(f"✓ User {user_id} disconnected ({len(active_clients)} remaining)")

def broadcast_message(message_dict: dict):
    """Broadcast a message to all connected clients."""
    payload = json.dumps(message_dict)
    disconnected = []
    
    for user_id, ws in list(active_clients.items()):
        try:
            ws.send(payload)
        except Exception:
            disconnected.append(user_id)
            
    for user_id in disconnected:
        if user_id in active_clients:
            del active_clients[user_id]

def handle_chat_message(app, sender_id: int, receiver_id: int, message_text: str):
    """
    Save chat message to the SQLAlchemy database and route it to the active sockets.
    """
    with app.app_context():
        from models import db, ChatMessage, User
        
        sender = db.session.query(User).get(sender_id)
        receiver = db.session.query(User).get(receiver_id)
        if not sender or not receiver:
            return
            
        msg = ChatMessage(
            sender_id=sender_id,
            receiver_id=receiver_id,
            message=message_text
        )
        db.session.add(msg)
        db.session.commit()
        
        payload = {
            'type': 'chat_message',
            'data': msg.to_dict()
        }
        raw_payload = json.dumps(payload)
        
        # Send to receiver if online
        if receiver_id in active_clients:
            try:
                active_clients[receiver_id].send(raw_payload)
            except Exception:
                del active_clients[receiver_id]
                
        # Send back to sender for client-side delivery confirmation
        if sender_id in active_clients:
            try:
                active_clients[sender_id].send(raw_payload)
            except Exception:
                del active_clients[sender_id]

def broadcast_appointment(appointment):
    """Broadcast a new appointment notification to all connected clients."""
    broadcast_message({
        'type': 'NEW_APPOINTMENT',
        'data': appointment.to_dict()
    })
