"""
Pytest configuration and fixtures.
"""

import pytest
from flask import Flask
from models import db, User, Role, Permission, Employee, Appointment
from config import TestConfig
import bcrypt

@pytest.fixture
def app():
    """Create Flask app with test config."""
    from app import create_app
    app = create_app()
    app.config.from_object(TestConfig)
    
    with app.app_context():
        # Clean up any left-over data
        db.drop_all()
        # Create tables
        db.create_all()
        
        # Seed roles and permissions
        admin_role = Role(name='admin', description='Admin')
        user_role = Role(name='user', description='User')
        client_role = Role(name='client', description='Client')
        
        # Add basic permissions needed for tests
        p_read_emp = Permission(name='employees:read', description='Read employees')
        p_read_appt = Permission(name='appointments:read', description='Read appointments')
        admin_role.permissions.extend([p_read_emp, p_read_appt])
        
        db.session.add(admin_role)
        db.session.add(user_role)
        db.session.add(client_role)
        db.session.commit()
        
        # Create seed users
        admin = User(
            username='admin',
            email='admin@test.local',
            password_hash=bcrypt.hashpw(b'admin123', bcrypt.gensalt()).decode('utf-8'),
        )
        admin.roles.append(admin_role)
        
        user = User(
            username='john',
            email='john@test.local',
            password_hash=bcrypt.hashpw(b'pass123', bcrypt.gensalt()).decode('utf-8'),
        )
        user.roles.append(user_role)
        
        db.session.add(admin)
        db.session.add(user)
        db.session.commit()
        
        # Create seed employee
        emp = Employee(user_id=user.id, name='Test Barber', color='#FF0000')
        db.session.add(emp)
        db.session.commit()
        
        yield app
        
        # Cleanup
        db.session.remove()
        db.drop_all()

@pytest.fixture
def client(app):
    """Create Flask test client."""
    return app.test_client()

@pytest.fixture
def runner(app):
    """Create Flask CLI test runner."""
    return app.test_cli_runner()
