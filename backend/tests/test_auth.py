"""
Tests for authentication endpoints.
"""

import pytest

def test_register(client):
    """Test user registration."""
    response = client.post('/api/auth/register', json={
        'username': 'newuser',
        'email': 'newuser@test.local',
        'password': 'password123',
    })
    
    assert response.status_code == 201
    data = response.get_json()
    assert data['user']['username'] == 'newuser'

def test_register_duplicate_username(client):
    """Test registration with duplicate username."""
    response = client.post('/api/auth/register', json={
        'username': 'admin',  # Already exists from conftest
        'email': 'another@test.local',
        'password': 'password123',
    })
    
    assert response.status_code == 400
    assert 'already exists' in response.get_json()['error']

def test_login(client):
    """Test user login."""
    response = client.post('/api/auth/login', json={
        'username': 'admin',
        'password': 'admin123',
    })
    
    assert response.status_code == 200
    data = response.get_json()
    assert data['user']['username'] == 'admin'

def test_login_invalid_credentials(client):
    """Test login with wrong password."""
    response = client.post('/api/auth/login', json={
        'username': 'admin',
        'password': 'wrongpassword',
    })
    
    assert response.status_code == 401

def test_get_current_user(client):
    """Test retrieving current user."""
    # Login first
    client.post('/api/auth/login', json={
        'username': 'admin',
        'password': 'admin123',
    })
    
    # Get current user
    response = client.get('/api/auth/me')
    assert response.status_code == 200
    assert response.get_json()['username'] == 'admin'
