import websocket
import json
import time

ws = websocket.WebSocket()
ws.connect("ws://localhost:5001/api/ws")
ws.send(json.dumps({"type": "chat_message", "username": "test_script", "message": "hello"}))
print("Sent message")
res = ws.recv()
print("Received:", res)
ws.close()
