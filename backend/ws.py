import json

# Thread-safe enough for our use case (GIL)
_clients = set()

def register_client(ws):
    _clients.add(ws)

def unregister_client(ws):
    _clients.discard(ws)

def broadcast_appointment(appointment):
    """Sends a new appointment to all connected clients."""
    data = json.dumps({
        "type": "NEW_APPOINTMENT",
        "data": appointment.to_dict()
    })
    
    dead_clients = set()
    for ws in _clients:
        try:
            ws.send(data)
        except Exception:
            dead_clients.add(ws)
            
    for ws in dead_clients:
        _clients.discard(ws)
