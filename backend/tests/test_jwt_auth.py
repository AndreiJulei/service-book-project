"""
Tests for JWT-based Authentication and Authorization.
"""

import pytest
import jwt
from datetime import datetime, timedelta, timezone
from flask import current_app
from models import db, User, Role

def get_auth_headers(token):
    return {'Authorization': f'Bearer {token}'}

def test_login_returns_tokens(client):
    """Test login returns both access and refresh tokens."""
    response = client.post('/api/auth/login', json={
        'username': 'admin',
        'password': 'admin123'
    })
    
    assert response.status_code == 200
    data = response.get_json()
    assert 'access_token' in data
    assert 'refresh_token' in data
    assert data['user']['username'] == 'admin'

def test_login_invalid_credentials(client):
    """Test login fails with invalid credentials."""
    response = client.post('/api/auth/login', json={
        'username': 'admin',
        'password': 'wrongpassword'
    })
    assert response.status_code == 401

def test_register_new_user(client):
    """Test user registration."""
    response = client.post('/api/auth/register', json={
        'username': 'clientuser',
        'email': 'clientuser@test.local',
        'password': 'password123',
        'role': 'client'
    })
    
    assert response.status_code == 201
    data = response.get_json()
    assert data['user']['username'] == 'clientuser'
    
    # Verify the user exists and has client role
    with client.application.app_context():
        user = db.session.query(User).filter_by(username='clientuser').first()
        assert user is not None
        roles = [r.name for r in user.roles]
        assert 'client' in roles

def test_register_duplicate_username(client):
    """Test registration fails with duplicate username."""
    response = client.post('/api/auth/register', json={
        'username': 'admin',
        'email': 'unique@test.local',
        'password': 'password123'
    })
    assert response.status_code == 400
    assert 'Username already exists' in response.get_json()['error']

def test_register_duplicate_email(client):
    """Test registration fails with duplicate email."""
    response = client.post('/api/auth/register', json={
        'username': 'unique',
        'email': 'admin@test.local',
        'password': 'password123'
    })
    assert response.status_code == 400
    assert 'Email already exists' in response.get_json()['error']

def test_access_protected_route_without_token(client):
    """Test accessing protected route without a token fails."""
    # GET /appointments is a protected route
    response = client.get('/api/appointments')
    assert response.status_code == 401
    assert 'Missing or invalid token' in response.get_json()['error']

def test_access_protected_route_with_valid_token(client):
    """Test accessing protected route with a valid access token."""
    login_res = client.post('/api/auth/login', json={
        'username': 'admin',
        'password': 'admin123'
    })
    token = login_res.get_json()['access_token']
    
    response = client.get('/api/appointments', headers=get_auth_headers(token))
    assert response.status_code == 200

def test_access_protected_route_with_expired_token(client, app):
    """Test accessing protected route with an expired token fails."""
    with app.app_context():
        user = db.session.query(User).filter_by(username='admin').first()
        # Forge an expired token manually
        payload = {
            'user_id': user.id,
            'username': user.username,
            'roles': [r.name for r in user.roles],
            'exp': datetime.now(timezone.utc) - timedelta(seconds=60), # Expired 1 min ago
            'iat': datetime.now(timezone.utc) - timedelta(seconds=120),
            'type': 'access'
        }
        expired_token = jwt.encode(payload, app.config['JWT_SECRET_KEY'], algorithm='HS256')
    
    response = client.get('/api/appointments', headers=get_auth_headers(expired_token))
    assert response.status_code == 401
    assert 'Token expired' in response.get_json()['error']

def test_refresh_token_returns_new_access_token(client):
    """Test refreshing an access token using a valid refresh token."""
    login_res = client.post('/api/auth/login', json={
        'username': 'admin',
        'password': 'admin123'
    })
    refresh_token = login_res.get_json()['refresh_token']
    
    response = client.post('/api/auth/refresh', json={
        'refresh_token': refresh_token
    })
    assert response.status_code == 200
    assert 'access_token' in response.get_json()

def test_role_based_access_admin_only(client):
    """Test that admin user can access admin-only endpoints."""
    login_res = client.post('/api/auth/login', json={
        'username': 'admin',
        'password': 'admin123'
    })
    token = login_res.get_json()['access_token']
    
    # GET /api/admin/action-logs is admin-only
    response = client.get('/api/admin/action-logs', headers=get_auth_headers(token))
    assert response.status_code == 200

def test_role_based_access_denied(client):
    """Test that non-admin user is denied access to admin-only endpoints."""
    # Login as non-admin user
    login_res = client.post('/api/auth/login', json={
        'username': 'john',
        'password': 'pass123'
    })
    token = login_res.get_json()['access_token']
    
    # GET /api/admin/action-logs is admin-only
    response = client.get('/api/admin/action-logs', headers=get_auth_headers(token))
    assert response.status_code == 403
    assert 'Insufficient permissions' in response.get_json()['error']

def test_token_contains_correct_roles(client, app):
    """Verify that decoded JWT token contains correct roles and claims."""
    login_res = client.post('/api/auth/login', json={
        'username': 'admin',
        'password': 'admin123'
    })
    token = login_res.get_json()['access_token']
    
    with app.app_context():
        payload = jwt.decode(token, app.config['JWT_SECRET_KEY'], algorithms=['HS256'])
        assert payload['username'] == 'admin'
        assert 'admin' in payload['roles']
        assert payload['type'] == 'access'

def test_get_current_user_with_token(client):
    """Verify that /auth/me returns the correct user when JWT token is provided."""
    login_res = client.post('/api/auth/login', json={
        'username': 'admin',
        'password': 'admin123'
    })
    token = login_res.get_json()['access_token']
    
    response = client.get('/api/auth/me', headers=get_auth_headers(token))
    assert response.status_code == 200
    assert response.get_json()['username'] == 'admin'
