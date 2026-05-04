"""
Flask application entry point.

Creates the app, registers the API blueprint, and starts the dev server.
"""

from flask import Flask
from flask_cors import CORS
from flask_sock import Sock
from routes import api
from repository import AppointmentRepository
from generator import init_generator
from ws import register_client, unregister_client

sock = Sock()


def create_app(repo: AppointmentRepository | None = None) -> Flask:
    """
    Application factory.

    Args:
        repo: Optional repository instance. If None, a default one with
              seed data is created. Pass a custom repo for testing.
    """
    app = Flask(__name__)

    # Allow the React dev server (localhost:5173) to call the API
    CORS(app)
    
    # Initialize WebSocket support
    sock.init_app(app)

    if repo is None:
        repo = AppointmentRepository()

    # Store the repository in app config so routes can access it
    # via current_app.config["REPO"]
    app.config["REPO"] = repo
    
    # Inject the repository into the background generator
    init_generator(repo)

    app.register_blueprint(api)
    
    @sock.route('/api/ws')
    def ws_endpoint(ws):
        register_client(ws)
        try:
            while True:
                # Keep connection alive and swallow incoming messages
                _ = ws.receive()
        except Exception:
            pass
        finally:
            unregister_client(ws)

    return app


if __name__ == "__main__":
    app = create_app()
    print("ServiceBook API running on http://localhost:5001")
    app.run(debug=True, port=5001)
