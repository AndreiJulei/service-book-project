"""
Tests for AppointmentRepository.
"""

import pytest
from models import db, Appointment, Employee
from repository import AppointmentRepository

def test_list_appointments(app):
    """Test listing all appointments."""
    with app.app_context():
        repo = AppointmentRepository()
        
        # Create test appointment
        emp = db.session.query(Employee).first()
        appt = Appointment(
            employee_id=emp.id,
            client_name='Test Client',
            service='Haircut',
            start_time=9.0,
            duration=1.0,
            reliability_score=80,
        )
        db.session.add(appt)
        db.session.commit()
        
        appointments = repo.list_appointments()
        assert len(appointments) >= 1
        assert appointments[0].client_name == 'Test Client'

def test_create_appointment(app):
    """Test creating an appointment."""
    with app.app_context():
        repo = AppointmentRepository()
        emp = db.session.query(Employee).first()
        
        data = {
            'employee_id': emp.id,
            'client_name': 'New Client',
            'service': 'Coloring',
            'start_time': 10.5,
            'duration': 2.0,
            'reliability_score': 90,
        }
        
        result = repo.create(data)
        
        assert not isinstance(result, dict)
        assert result is not None
        assert result.client_name == 'New Client'
        assert result.id > 0

def test_update_appointment(app):
    """Test updating an appointment."""
    with app.app_context():
        repo = AppointmentRepository()
        emp = db.session.query(Employee).first()
        
        # Create appointment
        appt = Appointment(
            employee_id=emp.id,
            client_name='Original',
            service='Haircut',
            start_time=9.0,
            duration=1.0,
            reliability_score=80,
        )
        db.session.add(appt)
        db.session.commit()
        appt_id = appt.id
        
        # Update
        data = {
            'employee_id': emp.id,
            'client_name': 'Updated',
            'service': 'Shave',
            'start_time': 10.0,
            'duration': 0.75,
            'reliability_score': 85,
        }
        
        result = repo.update(appt_id, data)
        
        assert not isinstance(result, dict)
        assert result is not None
        assert result.client_name == 'Updated'

def test_delete_appointment(app):
    """Test deleting an appointment."""
    with app.app_context():
        repo = AppointmentRepository()
        emp = db.session.query(Employee).first()
        
        # Create appointment
        appt = Appointment(
            employee_id=emp.id,
            client_name='To Delete',
            service='Haircut',
            start_time=9.0,
            duration=1.0,
            reliability_score=80,
        )
        db.session.add(appt)
        db.session.commit()
        appt_id = appt.id
        
        # Delete
        deleted = repo.delete(appt_id)
        assert deleted
        
        # Verify deletion
        found = repo.get_by_id(appt_id)
        assert found is None

def test_pagination(app):
    """Test paginated appointment retrieval."""
    with app.app_context():
        repo = AppointmentRepository()
        emp = db.session.query(Employee).first()
        
        # Create 15 appointments
        for i in range(15):
            appt = Appointment(
                employee_id=emp.id,
                client_name=f'Client {i}',
                service='Haircut',
                start_time=9.0,
                duration=0.5,
                reliability_score=80,
            )
            db.session.add(appt)
        db.session.commit()
        
        # Get first page
        items, total = repo.list_appointments_paginated(page=1, page_size=10)
        
        assert len(items) == 10
        assert total >= 15
