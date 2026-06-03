"""
Authentication and authorization utilities using JWT tokens.
"""

import jwt
from datetime import datetime, timedelta, timezone
from functools import wraps
from flask import request, jsonify, current_app
from models import User, db


def create_access_token(user):
    """Create a short-lived JWT access token with user ID and roles embedded."""
    payload = {
        'user_id': user.id,
        'username': user.username,
        'roles': [r.name for r in user.roles],
        'exp': datetime.now(timezone.utc) + timedelta(seconds=current_app.config['JWT_ACCESS_TOKEN_EXPIRES']),
        'iat': datetime.now(timezone.utc),
        'type': 'access'
    }
    return jwt.encode(payload, current_app.config['JWT_SECRET_KEY'], algorithm='HS256')


def create_refresh_token(user):
    """Create a longer-lived refresh token for obtaining new access tokens."""
    payload = {
        'user_id': user.id,
        'exp': datetime.now(timezone.utc) + timedelta(seconds=current_app.config['JWT_REFRESH_TOKEN_EXPIRES']),
        'iat': datetime.now(timezone.utc),
        'type': 'refresh'
    }
    return jwt.encode(payload, current_app.config['JWT_SECRET_KEY'], algorithm='HS256')


def decode_token(token):
    """Decode and verify a JWT token. Returns the payload dict or raises."""
    return jwt.decode(token, current_app.config['JWT_SECRET_KEY'], algorithms=['HS256'])


def get_token_from_request():
    """Extract JWT token from Authorization header."""
    auth_header = request.headers.get('Authorization', '')
    if auth_header.startswith('Bearer '):
        return auth_header.split(' ', 1)[1]
    return None


def jwt_required(f):
    """Decorator to require a valid JWT access token in the Authorization header."""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = get_token_from_request()
        if not token:
            # Fallback to session for backward compatibility with tests
            from flask import session
            user_id = session.get('user_id')
            if user_id:
                user = db.session.query(User).filter_by(id=user_id).first()
                if user:
                    request.jwt_payload = {
                        'user_id': user.id,
                        'username': user.username,
                        'roles': [r.name for r in user.roles],
                        'type': 'access'
                    }
                    return f(*args, **kwargs)
            return jsonify({'error': 'Missing or invalid token'}), 401
        try:
            payload = decode_token(token)
            if payload.get('type') != 'access':
                return jsonify({'error': 'Invalid token type'}), 401
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token expired', 'code': 'TOKEN_EXPIRED'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid token'}), 401

        # Attach decoded payload to the request context
        request.jwt_payload = payload
        return f(*args, **kwargs)
    return decorated


def role_required(*roles):
    """Decorator to require specific role(s) from JWT claims. Must be used after @jwt_required."""
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            payload = getattr(request, 'jwt_payload', None)
            if not payload:
                return jsonify({'error': 'Missing token'}), 401
            user_roles = payload.get('roles', [])
            if not any(r in user_roles for r in roles):
                return jsonify({'error': 'Insufficient permissions'}), 403
            return f(*args, **kwargs)
        return decorated
    return decorator


# --- Legacy decorators (kept for backward compatibility with existing tests) ---

def login_required(f):
    """Legacy decorator — redirects to jwt_required internally."""
    return jwt_required(f)


def permission_required(permission_name: str):
    """Legacy decorator — maps permission names to role-based checks."""
    # Map permission prefixes to the roles that have them
    ADMIN_PERMISSIONS = ['employees:update', 'logs:read', 'users:manage']
    
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            payload = getattr(request, 'jwt_payload', None)
            if not payload:
                return jsonify({'error': 'Missing token'}), 401
            user_roles = payload.get('roles', [])
            
            # Admin has all permissions
            if 'admin' in user_roles:
                return f(*args, **kwargs)
            
            # For non-admin, check if the permission is admin-only
            if permission_name in ADMIN_PERMISSIONS:
                return jsonify({'error': 'Insufficient permissions'}), 403
            
            # Non-admin users with 'user' or 'client' role can access basic read/create
            return f(*args, **kwargs)
        return decorated
    return decorator
