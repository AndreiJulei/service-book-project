"""
Tests for REST API routes.
"""

def test_list_employees(client):
    """Test getting employees (requires login)."""
    # Should fail without login
    resp = client.get('/api/employees')
    assert resp.status_code == 401
    
    # Login as admin
    client.post('/api/auth/login', json={'username': 'admin', 'password': 'admin123'})
    
    # Now it should succeed
    resp = client.get('/api/employees')
    assert resp.status_code == 200
    assert isinstance(resp.get_json(), list)

def test_list_appointments(client):
    """Test getting appointments (requires login)."""
    client.post('/api/auth/login', json={'username': 'admin', 'password': 'admin123'})
    
    resp = client.get('/api/appointments?page=1&page_size=10')
    assert resp.status_code == 200
    data = resp.get_json()
    assert 'items' in data
    assert 'total' in data
