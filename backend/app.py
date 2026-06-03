"""
Flask application entry point.

Creates the app, registers the API blueprint, and starts the dev server.
"""

import os
from flask import Flask, send_from_directory
from flask_cors import CORS
from flask_sock import Sock
from routes import api
from repository import AppointmentRepository
from generator import init_generator
from ws import register_client, unregister_client, handle_chat_message
from models import db
from config import DevelopmentConfig, ProductionConfig
import json
import re

sock = Sock()


def create_app(repo: AppointmentRepository | None = None) -> Flask:
    """
    Application factory.

    Args:
        repo: Optional repository instance. If None, a default one with
              seed data is created. Pass a custom repo for testing.
    """
    app = Flask(__name__)

    # Allow any origin since we are testing on a local network
    CORS(app, supports_credentials=True, origins=re.compile(r".*"))
    
    # Initialize WebSocket support
    sock.init_app(app)

    if repo is None:
        repo = AppointmentRepository()

    # Auto-select config based on environment
    if os.getenv("DATABASE_URL"):
        app.config.from_object(ProductionConfig)
    else:
        app.config.from_object(DevelopmentConfig)
    
    db.init_app(app)

    # Ensure uploads directory exists
    os.makedirs(app.config.get('UPLOAD_FOLDER', 'uploads'), exist_ok=True)

    # Store the repository in app config so routes can access it
    # via current_app.config["REPO"]
    app.config["REPO"] = repo
    
    # Inject the repository into the background generator
    init_generator(app, app.config["REPO"])

    app.register_blueprint(api)
    
    # Serve uploaded files
    @app.route('/uploads/<path:filename>')
    def serve_upload(filename):
        return send_from_directory(app.config.get('UPLOAD_FOLDER', 'uploads'), filename)
    
    @sock.route('/api/ws')
    def ws_endpoint(ws):
        from flask import request
        from auth_utils import decode_token
        token = request.args.get('token')
        if not token:
            try:
                ws.close(1008, 'Missing token')
            except Exception:
                pass
            return
        
        try:
            payload = decode_token(token)
            if payload.get('type') != 'access':
                try:
                    ws.close(1008, 'Invalid token type')
                except Exception:
                    pass
                return
        except Exception:
            try:
                ws.close(1008, 'Invalid or expired token')
            except Exception:
                pass
            return

        user_id = int(payload['user_id'])
        register_client(user_id, ws)
        try:
            while True:
                msg = ws.receive()
                if msg:
                    try:
                        data = json.loads(msg)
                        if data.get('type') == 'chat_message':
                            receiver_id = int(data.get('receiver_id'))
                            message_text = data.get('message', '').strip()
                            if receiver_id and message_text:
                                handle_chat_message(app, user_id, receiver_id, message_text)
                    except Exception:
                        pass
        except Exception:
            pass
        finally:
            unregister_client(user_id)

    return app


if __name__ == "__main__":
    import os
    import ssl
    
    app = create_app()
    
    cert_file = os.path.join(os.path.dirname(__file__), 'cert.pem')
    key_file = os.path.join(os.path.dirname(__file__), 'key.pem')
    
    if os.path.exists(cert_file) and os.path.exists(key_file):
        print("ServiceBook API running on https://0.0.0.0:5001 (HTTPS)")
        app.run(host='0.0.0.0', port=5001, ssl_context=(cert_file, key_file))
    else:
        print("WARNING: No SSL certificates found. Running on HTTP (insecure).")
        print("Run 'python generate_cert.py' to generate SSL certificates.")
        app.run(host='0.0.0.0', debug=True, port=5001)
