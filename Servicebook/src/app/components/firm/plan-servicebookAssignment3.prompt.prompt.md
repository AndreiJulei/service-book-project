================================================================================
SERVICEBOOK ASSIGNMENT 3: CORRECTED IMPLEMENTATION PLAN
Database Persistence with SQLAlchemy, MySQL, MongoDB, and Real-time Features
================================================================================

ASSIGNMENT OVERVIEW
================================================================================
This assignment has three tiers with cumulative requirements:

BRONZE [5p] - Week 10 deadline
  • Relational database (MySQL) with proper schema design (3NF minimum)
  • All CRUD operations for entities in your domain
  • Unit tests covering all important CRUD operations and entire database
  • Cross-machine deployment (client ≠ server)

SILVER [+2p] - Week 10 deadline (or +1p week 11, +0.5p week 12)
  • Database infrastructure for USER, ROLES, and PERMISSIONS
  • Full-stack login behavior (admin with full permissions, normal user with restricted)
  • Database persistence for role/permission management (no encryption/tokens required yet)
  • Real-time chat feature using NoSQL database + WebSockets
  • Multiple logged-in users chatting in real-time

GOLD [+3p] - Week 10 deadline (or +1.5p week 11, +0.75p week 12)
  • Complete logging system on backend (every action by logged-in user)
  • Log entries: USER_ID, ROLE, ACTION_INFORMATION, TIMESTAMP
  • Malevolent behavior detection mechanism
  • Suspicious user observation list viewable by admin on frontend

================================================================================
CRITICAL REQUIREMENT: 3NF COMPLIANCE
================================================================================
Your database MUST be in at least Third Normal Form (3NF):
  1. All attributes must be atomic (no repeating groups)
  2. Every non-key attribute must depend on the primary key (2NF)
  3. No transitive dependencies between non-key attributes (3NF)

COMMON MISTAKES TO AVOID:
  ❌ Storing "role" as a plain string column → violates 3NF
  ❌ Using SQLite for tests with MySQL in production → different engines, different type handling
  ❌ Embedding role/permission names in User table → transitive dependency

CORRECT APPROACH:
  ✅ Separate Role table with id (PK) and name
  ✅ Join table UserRole to map users to roles (many-to-many)
  ✅ Separate Permission table, RolePermission join table
  ✅ Use MySQL for both test and production databases

================================================================================
PHASE 1: DATABASE & ORM SETUP
================================================================================

1.1 Install Dependencies
----
$ pip install flask-sqlalchemy mysql-connector-python pymysql alembic python-dotenv bcrypt

Update requirements.txt:
  Flask==3.1.1
  Flask-CORS==5.0.1
  flask-sqlalchemy==3.1.1
  SQLAlchemy==2.0.23
  alembic==1.12.1
  mysql-connector-python==8.2.0
  pymysql==1.1.0
  python-dotenv==1.0.0
  bcrypt==4.1.1
  pytest==8.3.5
  pytest-cov==6.1.1
  flask-sock==0.7.0
  Faker==24.11.0
  pymongo==4.6.0
  redis==5.0.1

Note: Include pymongo and redis for Silver challenge (real-time chat)

1.2 Create backend/config.py
----
Create new file: backend/config.py

import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    """Base configuration."""
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JSON_SORT_KEYS = False

class DevelopmentConfig(Config):
    """Development configuration - MySQL."""
    DB_USER = os.getenv("DB_USER", "root")
    DB_PASSWORD = os.getenv("DB_PASSWORD", "password")
    DB_HOST = os.getenv("DB_HOST", "localhost")
    DB_PORT = os.getenv("DB_PORT", "3306")
    DB_NAME = os.getenv("DB_NAME", "servicebook_dev")
    SQLALCHEMY_DATABASE_URI = (
        f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    )

class TestConfig(Config):
    """Test configuration - Separate MySQL test database."""
    DB_USER = os.getenv("DB_USER", "root")
    DB_PASSWORD = os.getenv("DB_PASSWORD", "password")
    DB_HOST = os.getenv("DB_HOST", "localhost")
    DB_PORT = os.getenv("DB_PORT", "3306")
    DB_NAME = os.getenv("TEST_DB_NAME", "servicebook_test")
    SQLALCHEMY_DATABASE_URI = (
        f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    )
    TESTING = True

1.3 Create backend/.env (for local development)
----
DB_USER=root
DB_PASSWORD=your_password
DB_HOST=localhost
DB_PORT=3306
DB_NAME=servicebook_dev
TEST_DB_NAME=servicebook_test

MONGO_URI=mongodb://localhost:27017/servicebook_chat
REDIS_URL=redis://localhost:6379/0

1.4 Create MySQL Databases
----
Open MySQL client and run:

CREATE DATABASE servicebook_dev CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE servicebook_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

1.5 Refactor backend/models.py - NEW COMPLETE SCHEMA
----
Replace entire models.py with:

"""
SQLAlchemy ORM models for ServiceBook.

Includes:
  - User authentication (Bronze)
  - Role-based access control (Silver)
  - Employee and Appointment management (Bronze)
  - Action logging (Gold)
  - Suspicious activity tracking (Gold)
"""

from datetime import datetime
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import Table, Column, Integer, String, Float, ForeignKey, DateTime, Text, Boolean
from sqlalchemy.orm import relationship

db = SQLAlchemy()

# ============================================================================
# ASSOCIATION TABLES (Many-to-Many Relationships)
# ============================================================================

user_role = Table(
    'user_role',
    db.metadata,
    Column('user_id', Integer, ForeignKey('user.id', ondelete='CASCADE'), primary_key=True),
    Column('role_id', Integer, ForeignKey('role.id', ondelete='CASCADE'), primary_key=True),
)

role_permission = Table(
    'role_permission',
    db.metadata,
    Column('role_id', Integer, ForeignKey('role.id', ondelete='CASCADE'), primary_key=True),
    Column('permission_id', Integer, ForeignKey('permission.id', ondelete='CASCADE'), primary_key=True),
)

# ============================================================================
# USER & AUTHENTICATION (Silver)
# ============================================================================

class User(db.Model):
    """
    User account model.
    
    3NF: Depends only on PK (id). Role is stored in separate Role table via join.
    """
    __tablename__ = 'user'
    
    id = Column(Integer, primary_key=True)
    username = Column(String(80), unique=True, nullable=False, index=True)
    email = Column(String(120), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    
    # Relationships
    roles = relationship('Role', secondary=user_role, backref='users')
    employees = relationship('Employee', backref='user', cascade='all, delete-orphan')
    action_logs = relationship('ActionLog', backref='user', cascade='all, delete-orphan')
    
    def has_role(self, role_name: str) -> bool:
        """Check if user has a specific role."""
        return any(r.name == role_name for r in self.roles)
    
    def has_permission(self, permission_name: str) -> bool:
        """Check if any of user's roles have a permission."""
        for role in self.roles:
            if any(p.name == permission_name for p in role.permissions):
                return True
        return False
    
    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'created_at': self.created_at.isoformat(),
            'roles': [r.name for r in self.roles],
        }


class Role(db.Model):
    """
    Role model (e.g., 'admin', 'user').
    
    3NF: Pure reference table - depends only on PK.
    """
    __tablename__ = 'role'
    
    id = Column(Integer, primary_key=True)
    name = Column(String(50), unique=True, nullable=False, index=True)
    description = Column(String(255))
    
    # Relationships
    permissions = relationship('Permission', secondary=role_permission, backref='roles')
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'permissions': [p.name for p in self.permissions],
        }


class Permission(db.Model):
    """
    Permission model (e.g., 'appointments:create', 'appointments:delete').
    
    3NF: Pure reference table - depends only on PK.
    """
    __tablename__ = 'permission'
    
    id = Column(Integer, primary_key=True)
    name = Column(String(100), unique=True, nullable=False, index=True)
    description = Column(String(255))
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
        }

# ============================================================================
# CORE DOMAIN ENTITIES (Bronze)
# ============================================================================

class Employee(db.Model):
    """
    Employee model (barber/stylist).
    
    3NF: Every column depends on PK (id).
      - name: directly on id ✓
      - color: directly on id ✓
      - user_id: directly on id ✓
    """
    __tablename__ = 'employee'
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('user.id', ondelete='CASCADE'), nullable=False, index=True)
    name = Column(String(120), nullable=False)
    color = Column(String(7), nullable=False)  # Hex color code
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    
    # Relationships
    appointments = relationship('Appointment', backref='employee', cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'name': self.name,
            'color': self.color,
            'created_at': self.created_at.isoformat(),
        }


class Appointment(db.Model):
    """
    Appointment model.
    
    3NF: Every column depends on PK (id).
      - client_name: directly on id ✓
      - service: directly on id ✓
      - start_time, duration, reliability_score: directly on id ✓
      - employee_id (FK): directly on id ✓
    """
    __tablename__ = 'appointment'
    
    id = Column(Integer, primary_key=True)
    employee_id = Column(Integer, ForeignKey('employee.id', ondelete='CASCADE'), nullable=False, index=True)
    client_name = Column(String(120), nullable=False)
    service = Column(String(100), nullable=False)
    start_time = Column(Float, nullable=False)  # Hours (e.g., 9.5 = 9:30 AM)
    duration = Column(Float, nullable=False)    # Hours
    reliability_score = Column(Integer, nullable=False)  # 0-100
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'employee_id': self.employee_id,
            'client_name': self.client_name,
            'service': self.service,
            'start_time': self.start_time,
            'duration': self.duration,
            'reliability_score': self.reliability_score,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
        }

# ============================================================================
# LOGGING SYSTEM (Gold)
# ============================================================================

class ActionLog(db.Model):
    """
    Audit log for every action performed by logged-in users.
    
    3NF: Every column depends on PK (id).
      - user_id (FK): directly on id ✓
      - role: directly on id ✓
      - action: directly on id ✓
      - timestamp: directly on id ✓
    """
    __tablename__ = 'action_log'
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('user.id', ondelete='SET NULL'), nullable=True, index=True)
    role = Column(String(50), nullable=False)  # Snapshot of user's role at time of action
    action = Column(String(100), nullable=False)  # e.g., 'CREATE_APPOINTMENT', 'DELETE_EMPLOYEE'
    resource = Column(String(255), nullable=True)  # e.g., 'appointment:42', 'employee:3'
    details = Column(Text, nullable=True)  # JSON string with additional context
    ip_address = Column(String(45), nullable=True)  # IPv4 or IPv6
    timestamp = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'role': self.role,
            'action': self.action,
            'resource': self.resource,
            'details': self.details,
            'ip_address': self.ip_address,
            'timestamp': self.timestamp.isoformat(),
        }


class SuspiciousActivity(db.Model):
    """
    Tracks potentially malevolent user behavior detected by the system.
    
    3NF: Every column depends on PK (id).
    """
    __tablename__ = 'suspicious_activity'
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('user.id', ondelete='CASCADE'), nullable=False, index=True)
    reason = Column(String(255), nullable=False)  # e.g., '5+ deletions in 60 seconds'
    detected_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)
    resolved = Column(Boolean, default=False)
    admin_notes = Column(Text, nullable=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'reason': self.reason,
            'detected_at': self.detected_at.isoformat(),
            'resolved': self.resolved,
            'admin_notes': self.admin_notes,
        }

# ============================================================================
# CHAT MESSAGES (Silver - NoSQL, but tracking reference)
# ============================================================================
# Note: Chat messages will be stored in MongoDB, not MySQL.
# This is just a reference model for the data structure.
#
# Example MongoDB document:
# {
#   "_id": ObjectId(...),
#   "user_id": 1,
#   "username": "john_doe",
#   "message": "Hello everyone!",
#   "created_at": ISODate("2024-05-06T12:00:00Z"),
#   "room": "general"
# }

================================================================================
PHASE 2: DATABASE MIGRATIONS WITH ALEMBIC
================================================================================

2.1 Initialize Alembic
----
$ cd backend
$ alembic init migrations

2.2 Configure alembic/env.py
----
Edit migrations/env.py to use your SQLAlchemy models:

from backend.config import DevelopmentConfig
from backend.models import db

target_metadata = db.metadata

In the run_migrations_online() function, update:
  sqlalchemy_url = DevelopmentConfig.SQLALCHEMY_DATABASE_URI

2.3 Create Initial Migration
----
$ alembic revision --autogenerate -m "initial schema"

Verify the generated migration file in migrations/versions/ contains:
  - user table with user_id, username, email, password_hash, created_at, is_active
  - role table
  - permission table
  - user_role association table
  - employee table with user_id FK
  - appointment table with employee_id FK
  - action_log table
  - suspicious_activity table
  - All FKs and indexes are correct

2.4 Apply Migration
----
$ alembic upgrade head

Verify in MySQL:
$ mysql -u root -p servicebook_dev -e "SHOW TABLES;"

Should see 8 tables: user, role, permission, user_role, employee, appointment, action_log, suspicious_activity

2.5 Verify 3NF Compliance
----
For each table, check:

USER table:
  ✓ PK: id
  ✓ All columns depend on id only
  ✓ role is NOT here (separate Role table via join)

ROLE table:
  ✓ Pure reference table
  ✓ No dependencies on other tables

PERMISSION table:
  ✓ Pure reference table

EMPLOYEE table:
  ✓ PK: id
  ✓ name depends on id ✓
  ✓ color depends on id ✓
  ✓ user_id (FK) depends on id ✓
  ✓ No transitive dependencies

APPOINTMENT table:
  ✓ PK: id
  ✓ client_name, service, times, score all depend on id
  ✓ employee_id (FK) depends on id
  ✓ No transitive dependencies

ACTION_LOG, SUSPICIOUS_ACTIVITY:
  ✓ All columns depend on PK only

================================================================================
PHASE 3: SEED DATA & INITIALIZATION
================================================================================

3.1 Create backend/seed.py
----
Create file backend/seed.py with functions to initialize default roles, permissions, and users:

"""
Database seed/initialization script.
"""

from datetime import datetime
from models import db, User, Role, Permission, Employee, Appointment
from config import DevelopmentConfig
from flask import Flask
import bcrypt

def hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def init_db(app):
    """Initialize the database with default data."""
    with app.app_context():
        # Create tables (from migrations)
        db.create_all()
        
        # Create roles if they don't exist
        admin_role = db.session.query(Role).filter_by(name='admin').first()
        if not admin_role:
            admin_role = Role(name='admin', description='Administrator with full access')
            user_role = Role(name='user', description='Regular user with restricted access')
            db.session.add(admin_role)
            db.session.add(user_role)
            db.session.commit()
        
        # Create permissions if they don't exist
        perms = [
            Permission(name='appointments:create', description='Create appointments'),
            Permission(name='appointments:read', description='View appointments'),
            Permission(name='appointments:update', description='Update appointments'),
            Permission(name='appointments:delete', description='Delete appointments'),
            Permission(name='employees:read', description='View employees'),
            Permission(name='employees:update', description='Update employees'),
            Permission(name='logs:read', description='View action logs'),
            Permission(name='users:manage', description='Manage users and roles'),
        ]
        for perm in perms:
            if not db.session.query(Permission).filter_by(name=perm.name).first():
                db.session.add(perm)
        db.session.commit()
        
        # Assign permissions to roles
        admin_role = db.session.query(Role).filter_by(name='admin').first()
        user_role = db.session.query(Role).filter_by(name='user').first()
        all_perms = db.session.query(Permission).all()
        
        # Admin gets all permissions
        if not admin_role.permissions:
            admin_role.permissions = all_perms
        
        # User gets limited permissions
        if not user_role.permissions:
            user_perms = db.session.query(Permission).filter(
                Permission.name.in_(['appointments:create', 'appointments:read', 'employees:read'])
            ).all()
            user_role.permissions = user_perms
        
        db.session.commit()
        
        # Create seed users if they don't exist
        if not db.session.query(User).filter_by(username='admin').first():
            admin_user = User(
                username='admin',
                email='admin@servicebook.local',
                password_hash=hash_password('admin123'),
            )
            admin_user.roles = [admin_role]
            db.session.add(admin_user)
            db.session.commit()
        
        if not db.session.query(User).filter_by(username='john_doe').first():
            user = User(
                username='john_doe',
                email='john@servicebook.local',
                password_hash=hash_password('password123'),
            )
            user.roles = [user_role]
            db.session.add(user)
            db.session.commit()
        
        # Create seed employees
        employees_data = [
            {'name': 'Marcus Chen', 'color': '#8FAF8A', 'user_id': 2},
            {'name': 'Sarah Williams', 'color': '#6B7F5F', 'user_id': 2},
            {'name': 'Jake Morrison', 'color': '#50C878', 'user_id': 2},
            {'name': 'Emily Zhang', 'color': '#4A7C59', 'user_id': 2},
        ]
        
        if not db.session.query(Employee).first():
            for emp_data in employees_data:
                emp = Employee(**emp_data)
                db.session.add(emp)
            db.session.commit()
        
        # Create seed appointments
        appointments_data = [
            {'employee_id': 1, 'client_name': 'John Doe', 'service': 'Haircut', 'start_time': 9, 'duration': 1, 'reliability_score': 85},
            {'employee_id': 1, 'client_name': 'Jane Smith', 'service': 'Coloring', 'start_time': 10.5, 'duration': 2, 'reliability_score': 92},
            {'employee_id': 2, 'client_name': 'Bob Johnson', 'service': 'Shave', 'start_time': 9.5, 'duration': 0.75, 'reliability_score': 35},
            {'employee_id': 2, 'client_name': 'Alice Brown', 'service': 'Styling', 'start_time': 11, 'duration': 1.5, 'reliability_score': 78},
            {'employee_id': 3, 'client_name': 'Charlie Davis', 'service': 'Haircut', 'start_time': 10, 'duration': 1, 'reliability_score': 45},
            {'employee_id': 3, 'client_name': 'Diana Evans', 'service': 'Treatment', 'start_time': 13, 'duration': 2, 'reliability_score': 95},
        ]
        
        if not db.session.query(Appointment).first():
            for appt_data in appointments_data:
                appt = Appointment(**appt_data)
                db.session.add(appt)
            db.session.commit()
        
        print("✓ Database initialized successfully")

if __name__ == '__main__':
    from app import create_app
    app = create_app()
    init_db(app)

3.2 Run Seed Script
----
$ python seed.py

================================================================================
PHASE 4: REFACTOR REPOSITORY & DATA LAYER
================================================================================

4.1 Refactor backend/repository.py
----
Replace with SQLAlchemy version:

"""
Data repository using SQLAlchemy ORM.
"""

from sqlalchemy.orm import Session
from models import db, Appointment, Employee, User, ActionLog
from validators import validate_appointment_input
from datetime import datetime
import json

class AppointmentRepository:
    """Repository for Appointment and Employee operations."""
    
    def __init__(self, session: Session = None):
        """Initialize with optional custom session (for testing)."""
        self.session = session or db.session
    
    # === EMPLOYEE OPERATIONS ===
    
    def list_employees(self) -> list[dict]:
        """Get all employees."""
        employees = self.session.query(Employee).all()
        return [e.to_dict() for e in employees]
    
    def get_employee(self, employee_id: int) -> dict | None:
        """Get a single employee by ID."""
        emp = self.session.query(Employee).filter_by(id=employee_id).first()
        return emp.to_dict() if emp else None
    
    # === APPOINTMENT CRUD ===
    
    def list_appointments(self) -> list[dict]:
        """Get all appointments, sorted by employee_id then start_time."""
        appointments = self.session.query(Appointment).order_by(
            Appointment.employee_id, Appointment.start_time
        ).all()
        return [a.to_dict() for a in appointments]
    
    def list_appointments_paginated(
        self,
        page: int = 1,
        page_size: int = 10,
    ) -> tuple[list[dict], int]:
        """
        Return paginated appointments and total count.
        
        Args:
            page: 1-indexed page number
            page_size: items per page
        
        Returns:
            (items_on_page, total_count)
        """
        query = self.session.query(Appointment).order_by(
            Appointment.employee_id, Appointment.start_time
        )
        total = query.count()
        
        start = (page - 1) * page_size
        items = query.offset(start).limit(page_size).all()
        
        return [a.to_dict() for a in items], total
    
    def get_appointment(self, appointment_id: int) -> dict | None:
        """Get a single appointment by ID."""
        appt = self.session.query(Appointment).filter_by(id=appointment_id).first()
        return appt.to_dict() if appt else None
    
    def appointments_by_employee(self, employee_id: int) -> list[dict]:
        """Get all appointments for a specific employee."""
        appointments = self.session.query(Appointment).filter_by(
            employee_id=employee_id
        ).order_by(Appointment.start_time).all()
        return [a.to_dict() for a in appointments]
    
    def create_appointment(self, data: dict) -> tuple[dict | None, dict | None]:
        """
        Create a new appointment.
        
        Returns:
            (appointment_dict, errors_dict)
            - On success: (appointment, None)
            - On failure: (None, errors)
        """
        # Validate
        employee_ids = [e.id for e in self.session.query(Employee).all()]
        existing_appts = self.session.query(Appointment).all()
        
        errors = validate_appointment_input(data, employee_ids, existing_appts)
        if errors:
            return None, errors
        
        # Create
        appointment = Appointment(
            employee_id=data['employee_id'],
            client_name=data['client_name'].strip(),
            service=data['service'].strip(),
            start_time=data['start_time'],
            duration=data['duration'],
            reliability_score=int(data['reliability_score']),
        )
        
        self.session.add(appointment)
        self.session.commit()
        
        return appointment.to_dict(), None
    
    def update_appointment(self, appointment_id: int, data: dict) -> tuple[dict | None, dict | None, bool]:
        """
        Update an existing appointment.
        
        Returns:
            (appointment_dict, errors_dict, found)
            - On success: (updated_appt, None, True)
            - On validation error: (None, errors, True)
            - Not found: (None, None, False)
        """
        appointment = self.session.query(Appointment).filter_by(id=appointment_id).first()
        if not appointment:
            return None, None, False
        
        # Validate
        employee_ids = [e.id for e in self.session.query(Employee).all()]
        existing_appts = self.session.query(Appointment).filter(Appointment.id != appointment_id).all()
        
        errors = validate_appointment_input(data, employee_ids, existing_appts, current_id=appointment_id)
        if errors:
            return None, errors, True
        
        # Update
        appointment.employee_id = data['employee_id']
        appointment.client_name = data['client_name'].strip()
        appointment.service = data['service'].strip()
        appointment.start_time = data['start_time']
        appointment.duration = data['duration']
        appointment.reliability_score = int(data['reliability_score'])
        appointment.updated_at = datetime.utcnow()
        
        self.session.commit()
        
        return appointment.to_dict(), None, True
    
    def delete_appointment(self, appointment_id: int) -> bool:
        """Delete an appointment. Returns True if deleted, False if not found."""
        appointment = self.session.query(Appointment).filter_by(id=appointment_id).first()
        if not appointment:
            return False
        
        self.session.delete(appointment)
        self.session.commit()
        return True
    
    def count_appointments(self) -> int:
        """Count total appointments."""
        return self.session.query(Appointment).count()
    
    # === STATISTICS ===
    
    def appointments_by_reliability_range(self, min_score: int, max_score: int) -> list[dict]:
        """Get appointments within a reliability score range."""
        appointments = self.session.query(Appointment).filter(
            Appointment.reliability_score.between(min_score, max_score)
        ).all()
        return [a.to_dict() for a in appointments]

================================================================================
PHASE 5: AUTHENTICATION LAYER (SILVER)
================================================================================

5.1 Update backend/routes.py - Add Auth Endpoints
----
Add to routes.py:

from flask import request, session
from models import User, db
import bcrypt

@api.route('/auth/register', methods=['POST'])
def register():
    """
    POST /api/auth/register
    
    Body: { "username": str, "email": str, "password": str }
    Response: { "user": { ... }, "message": str } (201)
             or { "error": str } (400)
    """
    data = request.get_json(silent=True)
    if not data:
        return jsonify({'error': 'Invalid JSON'}), 400
    
    username = data.get('username', '').strip()
    email = data.get('email', '').strip()
    password = data.get('password', '')
    
    if not (username and email and password):
        return jsonify({'error': 'Missing required fields'}), 400
    
    if db.session.query(User).filter_by(username=username).first():
        return jsonify({'error': 'Username already exists'}), 400
    
    if db.session.query(User).filter_by(email=email).first():
        return jsonify({'error': 'Email already exists'}), 400
    
    # Hash password
    password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    user = User(username=username, email=email, password_hash=password_hash)
    
    # Assign default 'user' role
    user_role = db.session.query(Role).filter_by(name='user').first()
    if user_role:
        user.roles.append(user_role)
    
    db.session.add(user)
    db.session.commit()
    
    return jsonify({
        'user': user.to_dict(),
        'message': 'User registered successfully'
    }), 201


@api.route('/auth/login', methods=['POST'])
def login():
    """
    POST /api/auth/login
    
    Body: { "username": str, "password": str }
    Response: { "user": { ... }, "message": str } (200)
             or { "error": str } (401)
    """
    data = request.get_json(silent=True)
    if not data:
        return jsonify({'error': 'Invalid JSON'}), 400
    
    username = data.get('username', '')
    password = data.get('password', '')
    
    if not (username and password):
        return jsonify({'error': 'Missing username or password'}), 400
    
    user = db.session.query(User).filter_by(username=username).first()
    
    if not user or not bcrypt.checkpw(password.encode('utf-8'), user.password_hash.encode('utf-8')):
        return jsonify({'error': 'Invalid credentials'}), 401
    
    # Store user ID in session (simple Flask session)
    session['user_id'] = user.id
    
    return jsonify({
        'user': user.to_dict(),
        'message': 'Login successful'
    }), 200


@api.route('/auth/logout', methods=['POST'])
def logout():
    """POST /api/auth/logout"""
    session.pop('user_id', None)
    return jsonify({'message': 'Logged out successfully'}), 200


@api.route('/auth/me', methods=['GET'])
def get_current_user():
    """GET /api/auth/me - Get current logged-in user."""
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Not logged in'}), 401
    
    user = db.session.query(User).filter_by(id=user_id).first()
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    return jsonify(user.to_dict()), 200


5.2 Add Permission Checking Middleware
----
Create backend/auth_utils.py:

"""
Authentication and authorization utilities.
"""

from functools import wraps
from flask import session, jsonify
from models import User, db

def login_required(f):
    """Decorator to require login."""
    @wraps(f)
    def decorated(*args, **kwargs):
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({'error': 'Login required'}), 401
        
        user = db.session.query(User).filter_by(id=user_id).first()
        if not user:
            session.pop('user_id', None)
            return jsonify({'error': 'User not found'}), 401
        
        return f(*args, **kwargs)
    return decorated

def permission_required(permission_name: str):
    """Decorator to require a specific permission."""
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            user_id = session.get('user_id')
            if not user_id:
                return jsonify({'error': 'Login required'}), 401
            
            user = db.session.query(User).filter_by(id=user_id).first()
            if not user:
                session.pop('user_id', None)
                return jsonify({'error': 'User not found'}), 401
            
            if not user.has_permission(permission_name):
                return jsonify({'error': 'Insufficient permissions'}), 403
            
            return f(*args, **kwargs)
        return decorated
    return decorator

5.3 Apply Decorators to Existing Routes
----
In routes.py, wrap appointment endpoints with @login_required:

from auth_utils import login_required, permission_required

@api.route('/appointments', methods=['POST'])
@permission_required('appointments:create')
def create_appointment():
    # ... existing code ...

@api.route('/appointments/<int:appointment_id>', methods=['PUT'])
@permission_required('appointments:update')
def update_appointment(appointment_id):
    # ... existing code ...

@api.route('/appointments/<int:appointment_id>', methods=['DELETE'])
@permission_required('appointments:delete')
def delete_appointment(appointment_id):
    # ... existing code ...

================================================================================
PHASE 6: REAL-TIME CHAT WITH NOSQL (SILVER)
================================================================================

6.1 Choose NoSQL: MongoDB or Redis
----
Recommendation: MongoDB (more flexible for message documents)

Install MongoDB locally or use Docker:
  $ docker run -d -p 27017:27017 --name mongodb mongo

6.2 Update backend/ws.py for Persistent Chat
----
Replace entire ws.py:

"""
WebSocket handler for real-time chat with MongoDB persistence.
"""

from flask import session
from flask_sock import Sock
from pymongo import MongoClient
from datetime import datetime
from bson import ObjectId
import json

# MongoDB connection
MONGO_URI = "mongodb://localhost:27017/servicebook_chat"
mongo_client = MongoClient(MONGO_URI)
db_mongo = mongo_client['servicebook_chat']
messages_collection = db_mongo['messages']

# Active WebSocket connections
active_clients = {}

def register_client(ws, user_id: int, username: str):
    """Register a new WebSocket client."""
    client_key = f"{user_id}_{id(ws)}"
    active_clients[client_key] = {
        'ws': ws,
        'user_id': user_id,
        'username': username,
    }
    print(f"✓ Client connected: {username} ({len(active_clients)} active)")

def unregister_client(ws):
    """Unregister a WebSocket client."""
    for key, client in list(active_clients.items()):
        if client['ws'] == ws:
            del active_clients[key]
            print(f"✓ Client disconnected ({len(active_clients)} remaining)")
            break

def broadcast_message(message_dict: dict):
    """Broadcast a message to all connected clients."""
    payload = json.dumps(message_dict)
    disconnected = []
    
    for key, client in active_clients.items():
        try:
            client['ws'].send(payload)
        except Exception as e:
            print(f"Failed to send to {key}: {e}")
            disconnected.append(key)
    
    # Clean up disconnected clients
    for key in disconnected:
        if key in active_clients:
            del active_clients[key]

def handle_chat_message(user_id: int, username: str, message_text: str):
    """
    Save chat message to MongoDB and broadcast to all clients.
    """
    # Create message document
    message_doc = {
        'user_id': user_id,
        'username': username,
        'message': message_text,
        'created_at': datetime.utcnow(),
        'room': 'general',  # Can extend to multi-room later
    }
    
    # Save to MongoDB
    try:
        result = messages_collection.insert_one(message_doc)
        message_doc['_id'] = str(result.inserted_id)
    except Exception as e:
        print(f"Failed to save message to MongoDB: {e}")
        return
    
    # Broadcast to all clients
    broadcast_message({
        'type': 'chat_message',
        'user_id': user_id,
        'username': username,
        'message': message_text,
        'timestamp': datetime.utcnow().isoformat(),
    })

================================================================================
PHASE 7: LOGGING SYSTEM (GOLD)
================================================================================

7.1 Create backend/logging_utils.py
----
Create file with action logging and anomaly detection:

"""
Logging and anomaly detection for user actions.
"""

from models import db, ActionLog, SuspiciousActivity, User
from datetime import datetime, timedelta
from flask import request, session
import json

def log_action(action: str, resource: str = None, details: dict = None, user_id: int = None):
    """
    Log a user action to the database.
    
    Args:
        action: e.g., 'CREATE_APPOINTMENT', 'DELETE_EMPLOYEE'
        resource: e.g., 'appointment:42'
        details: Additional context as dict (will be JSON-stringified)
        user_id: Optional user ID (defaults to session user_id)
    """
    if user_id is None:
        user_id = session.get('user_id')
    
    if not user_id:
        return  # No user logged in, don't log
    
    user = db.session.query(User).filter_by(id=user_id).first()
    if not user:
        return
    
    role = user.roles[0].name if user.roles else 'unknown'
    ip_address = request.remote_addr if request else None
    
    log_entry = ActionLog(
        user_id=user_id,
        role=role,
        action=action,
        resource=resource,
        details=json.dumps(details) if details else None,
        ip_address=ip_address,
    )
    
    db.session.add(log_entry)
    db.session.commit()
    
    # Check for suspicious behavior
    detect_suspicious_activity(user_id, action)

def detect_suspicious_activity(user_id: int, action: str):
    """
    Detect and flag potentially malevolent behavior.
    
    Rules:
      - 5+ DELETE actions in 60 seconds
      - Repeated failed login attempts (would be implemented in auth)
    """
    if 'DELETE' not in action:
        return
    
    # Count DELETE actions in the last 60 seconds
    one_minute_ago = datetime.utcnow() - timedelta(seconds=60)
    delete_count = db.session.query(ActionLog).filter(
        ActionLog.user_id == user_id,
        ActionLog.action.contains('DELETE'),
        ActionLog.timestamp >= one_minute_ago,
    ).count()
    
    if delete_count >= 5:
        # Check if user is already flagged
        existing_flag = db.session.query(SuspiciousActivity).filter(
            SuspiciousActivity.user_id == user_id,
            SuspiciousActivity.resolved == False,
        ).first()
        
        if not existing_flag:
            suspicious = SuspiciousActivity(
                user_id=user_id,
                reason=f'{delete_count} deletions in 60 seconds',
            )
            db.session.add(suspicious)
            db.session.commit()
            print(f"⚠️  Suspicious activity detected for user {user_id}")

def create_action_decorator(action: str, resource_param: str = None):
    """
    Decorator factory for logging actions.
    
    Usage:
        @api.route('/appointments', methods=['DELETE'])
        @create_action_decorator('DELETE_APPOINTMENT', 'appointment_id')
        def delete_appointment(appointment_id):
            ...
    """
    from functools import wraps
    
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            # Get resource ID from kwargs if specified
            resource = None
            if resource_param and resource_param in kwargs:
                resource = f"appointment:{kwargs[resource_param]}"
            
            result = f(*args, **kwargs)
            log_action(action, resource)
            return result
        return decorated
    return decorator

7.2 Update routes.py to Log All Actions
----
Add logging to appointment endpoints:

from logging_utils import log_action

@api.route('/appointments', methods=['POST'])
@permission_required('appointments:create')
def create_appointment():
    repo = _get_repo()
    data = request.get_json(silent=True)
    
    result, errors = repo.create_appointment(data)
    
    if errors:
        return jsonify({'errors': errors}), 400
    
    # Log the action
    log_action(
        action='CREATE_APPOINTMENT',
        resource=f"appointment:{result['id']}",
        details={'service': result['service'], 'client': result['client_name']}
    )
    
    return jsonify(result), 201

@api.route('/appointments/<int:appointment_id>', methods=['DELETE'])
@permission_required('appointments:delete')
def delete_appointment(appointment_id: int):
    repo = _get_repo()
    deleted = repo.delete_appointment(appointment_id)
    
    if not deleted:
        return jsonify({'error': 'Appointment not found'}), 404
    
    # Log the action
    log_action(
        action='DELETE_APPOINTMENT',
        resource=f"appointment:{appointment_id}"
    )
    
    return jsonify({'message': 'Appointment deleted'}), 200

# Similar logging for updates, employee operations, etc.

7.3 Add Admin Endpoint to View Suspicious Activity
----
Add to routes.py:

@api.route('/admin/suspicious-activity', methods=['GET'])
@permission_required('logs:read')
def get_suspicious_activity():
    """GET /api/admin/suspicious-activity - View all suspicious users."""
    suspicious = db.session.query(SuspiciousActivity).order_by(
        SuspiciousActivity.detected_at.desc()
    ).all()
    
    return jsonify([s.to_dict() for s in suspicious]), 200

@api.route('/admin/action-logs', methods=['GET'])
@permission_required('logs:read')
def get_action_logs():
    """GET /api/admin/action-logs - View action logs with pagination."""
    page = int(request.args.get('page', 1))
    page_size = int(request.args.get('page_size', 50))
    
    query = db.session.query(ActionLog).order_by(ActionLog.timestamp.desc())
    total = query.count()
    
    logs = query.offset((page - 1) * page_size).limit(page_size).all()
    
    return jsonify({
        'items': [l.to_dict() for l in logs],
        'total': total,
        'page': page,
        'page_size': page_size,
    }), 200

================================================================================
PHASE 8: TESTING STRATEGY
================================================================================

8.1 Update backend/requirements.txt
----
Add testing dependencies:

pytest==8.3.5
pytest-cov==6.1.1

8.2 Create backend/tests/conftest.py
----
Pytest configuration file for shared fixtures:

"""
Pytest configuration and fixtures.
"""

import pytest
from flask import Flask
from models import db, User, Role, Permission, Employee, Appointment
from config import TestConfig
from bcrypt import hashpw, gensalt

@pytest.fixture
def app():
    """Create Flask app with test config."""
    app = Flask(__name__)
    app.config.from_object(TestConfig)
    
    db.init_app(app)
    
    with app.app_context():
        # Create tables
        db.create_all()
        
        # Seed roles and permissions
        admin_role = Role(name='admin', description='Admin')
        user_role = Role(name='user', description='User')
        db.session.add(admin_role)
        db.session.add(user_role)
        db.session.commit()
        
        # Create seed users
        admin = User(
            username='admin',
            email='admin@test.local',
            password_hash=hashpw(b'admin123', gensalt()).decode('utf-8'),
        )
        admin.roles.append(admin_role)
        
        user = User(
            username='john',
            email='john@test.local',
            password_hash=hashpw(b'pass123', gensalt()).decode('utf-8'),
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

8.3 Create backend/tests/test_repository.py
----
Test CRUD operations:

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
        appt = Appointment(
            employee_id=1,
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
        assert appointments[0]['client_name'] == 'Test Client'

def test_create_appointment(app):
    """Test creating an appointment."""
    with app.app_context():
        repo = AppointmentRepository()
        
        data = {
            'employee_id': 1,
            'client_name': 'New Client',
            'service': 'Coloring',
            'start_time': 10.5,
            'duration': 2.0,
            'reliability_score': 90,
        }
        
        result, errors = repo.create_appointment(data)
        
        assert errors is None
        assert result is not None
        assert result['client_name'] == 'New Client'
        assert result['id'] > 0

def test_update_appointment(app):
    """Test updating an appointment."""
    with app.app_context():
        repo = AppointmentRepository()
        
        # Create appointment
        appt = Appointment(
            employee_id=1,
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
            'employee_id': 1,
            'client_name': 'Updated',
            'service': 'Shave',
            'start_time': 10.0,
            'duration': 0.75,
            'reliability_score': 85,
        }
        
        result, errors, found = repo.update_appointment(appt_id, data)
        
        assert found
        assert errors is None
        assert result['client_name'] == 'Updated'

def test_delete_appointment(app):
    """Test deleting an appointment."""
    with app.app_context():
        repo = AppointmentRepository()
        
        # Create appointment
        appt = Appointment(
            employee_id=1,
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
        deleted = repo.delete_appointment(appt_id)
        assert deleted
        
        # Verify deletion
        found = repo.get_appointment(appt_id)
        assert found is None

def test_pagination(app):
    """Test paginated appointment retrieval."""
    with app.app_context():
        repo = AppointmentRepository()
        
        # Create 15 appointments
        for i in range(15):
            appt = Appointment(
                employee_id=1,
                client_name=f'Client {i}',
                service='Haircut',
                start_time=9.0 + i,
                duration=1.0,
                reliability_score=80,
            )
            db.session.add(appt)
        db.session.commit()
        
        # Get first page
        items, total = repo.list_appointments_paginated(page=1, page_size=10)
        
        assert len(items) == 10
        assert total >= 15

8.4 Create backend/tests/test_auth.py
----
Test authentication endpoints:

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
        'username': 'admin',  # Already exists
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

8.5 Run Tests
----
$ cd backend
$ pytest tests/ -v --cov=. --cov-report=html

This generates a coverage report showing which code paths are tested.

================================================================================
PHASE 9: CHAT UI UPDATES (SILVER)
================================================================================

9.1 Update Frontend WebSocket Connection
----
In Servicebook/src/App.tsx or chat component:

import { useEffect, useState } from 'react';

export function ChatComponent() {
  const [messages, setMessages] = useState([]);
  const [ws, setWs] = useState(null);
  
  useEffect(() => {
    // Get server IP from environment or config
    const serverIP = process.env.REACT_APP_SERVER_IP || '192.168.1.15';
    const wsURL = `ws://${serverIP}:5001/api/ws`;
    
    const websocket = new WebSocket(wsURL);
    
    websocket.onopen = () => {
      console.log('✓ Connected to chat');
    };
    
    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'chat_message') {
        setMessages(prev => [...prev, {
          username: data.username,
          message: data.message,
          timestamp: data.timestamp,
        }]);
      }
    };
    
    websocket.onerror = (error) => {
      console.error('✗ WebSocket error:', error);
    };
    
    setWs(websocket);
    
    return () => websocket.close();
  }, []);
  
  const sendMessage = (text) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'chat_message',
        message: text,
      }));
    }
  };
  
  return (
    <div>
      <div className="messages">
        {messages.map((msg, idx) => (
          <div key={idx}>
            <strong>{msg.username}:</strong> {msg.message}
          </div>
        ))}
      </div>
      <input
        type="text"
        onKeyPress={(e) => {
          if (e.key === 'Enter') {
            sendMessage(e.target.value);
            e.target.value = '';
          }
        }}
      />
    </div>
  );
}

================================================================================
PHASE 10: ADMIN DASHBOARD (GOLD)
================================================================================

10.1 Create Admin Page Components
----
Create Servicebook/src/pages/AdminDashboard.tsx:

Shows:
  - List of suspicious users
  - Action logs with filtering
  - Admin controls to resolve flags

(Detailed React component code would go here)

================================================================================
PHASE 11: NETWORK DEPLOYMENT
================================================================================

11.1 Configure Backend for Network Access
----
In backend/app.py:

if __name__ == '__main__':
    app = create_app()
    print("ServiceBook API running on http://0.0.0.0:5001")
    app.run(host='0.0.0.0', port=5001, debug=False)

11.2 Find Your Server IP
----
$ ipconfig getifaddr en0  # macOS
$ hostname -I             # Linux
$ ipconfig                # Windows

Example: 192.168.1.15

11.3 Start Backend on Main Machine
----
$ cd backend
$ python app.py

11.4 Start Frontend on Different Machine
----
$ cd Servicebook
$ npm run dev -- --host

11.5 Update Frontend API URL
----
In Servicebook/src/config.ts or .env:

VITE_API_URL=http://192.168.1.15:5001/api

11.6 Test Cross-Machine
----
Open frontend on second machine
Verify:
  ✓ Can load employees
  ✓ Can create appointments
  ✓ Can update/delete appointments
  ✓ Can login
  ✓ Chat works between users

================================================================================
DELIVERABLES CHECKLIST
================================================================================

BRONZE [5p]:
  ☐ MySQL database created with 3+ tables (user, employee, appointment, roles/permissions)
  ☐ Verified 3NF compliance (no transitive dependencies)
  ☐ All CRUD operations working (create, read, update, delete for appointments)
  ☐ Unit tests for all CRUD operations (test_repository.py)
  ☐ Database coverage tests show >80% coverage
  ☐ API endpoints tested and working (test_routes.py)
  ☐ Cross-machine deployment working (different machine can access API)
  ☐ README or document explaining schema design and 3NF compliance

SILVER [+2p]:
  ☐ User table with authentication fields
  ☐ Role and Permission tables with proper relationships
  ☐ User-Role join table (many-to-many)
  ☐ Role-Permission join table (many-to-many)
  ☐ POST /api/auth/register endpoint
  ☐ POST /api/auth/login endpoint
  ☐ POST /api/auth/logout endpoint
  ☐ GET /api/auth/me endpoint
  ☐ Login required decorators on restricted endpoints
  ☐ Permission checking for different operations
  ☐ MongoDB connected and chat messages persisting
  ☐ WebSocket chat working with 2+ users visible
  ☐ Real-time message broadcasting verified

GOLD [+3p]:
  ☐ ActionLog table created and migrations applied
  ☐ SuspiciousActivity table created and migrations applied
  ☐ @log_action decorator on all data-modifying endpoints
  ☐ Anomaly detection running (e.g., 5+ deletes in 60 seconds)
  ☐ GET /api/admin/action-logs endpoint
  ☐ GET /api/admin/suspicious-activity endpoint
  ☐ Admin-only access to logging endpoints (permissions checked)
  ☐ Frontend page showing suspicious users (admin only)
  ☐ Suspicious user flag test (manually trigger by creating 5 deletes)

================================================================================
DEPENDENCIES SUMMARY
================================================================================

BACKEND:
  Flask, Flask-SQLAlchemy, SQLAlchemy, Alembic
  mysql-connector-python, pymysql
  python-dotenv, bcrypt
  pytest, pytest-cov
  flask-sock (WebSocket)
  pymongo (NoSQL chat)
  redis (optional, alternative to MongoDB)

DATABASE:
  MySQL 8.0+
  MongoDB (or Redis)

FRONTEND:
  React, Vite
  (Same as before)

================================================================================
COMMON PITFALLS TO AVOID
================================================================================

1. ❌ Storing role as a string column in User table
   ✅ Create separate Role table and use many-to-many relationship

2. ❌ Using SQLite for tests with MySQL in production
   ✅ Create separate MySQL test database (servicebook_test)

3. ❌ Not running migrations (manually creating tables in MySQL)
   ✅ Use Alembic to generate and apply migrations

4. ❌ Forgetting to hash passwords
   ✅ Use bcrypt in register and login endpoints

5. ❌ WebSocket only broadcasts, doesn't persist messages
   ✅ Save to MongoDB before broadcasting

6. ❌ Logging actions without actually persisting them
   ✅ Ensure ActionLog inserts are committed to database

7. ❌ Anomaly detection logic that runs but doesn't flag users
   ✅ Insert suspicious activities and verify they appear in query

8. ❌ Testing only happy path (successful operations)
   ✅ Test error cases: invalid data, permissions, not found, etc.

9. ❌ Forgetting to apply @login_required and @permission_required decorators
   ✅ Protect all endpoints that modify data or return sensitive info

10. ❌ Using localhost (127.0.0.1) for backend binding
    ✅ Bind to 0.0.0.0 and test from different machine

================================================================================
TIMELINE
================================================================================

Week 9 (Prep):
  - Install dependencies
  - Create config.py and .env
  - Convert models to SQLAlchemy
  - Initialize Alembic

Week 10 (Bronze + Silver + Gold):
  - Phase 1-3: Database setup, migrations, repository refactor (2-3 days)
  - Phase 4-5: Auth layer implementation (1-2 days)
  - Phase 6: Chat with MongoDB (1 day)
  - Phase 7: Logging system (1-2 days)
  - Phase 8: Comprehensive testing (1 day)
  - Phase 9-11: UI updates and deployment (1 day)
  - Total: ~10 days (doable for Week 10 deadline if you start early)

If delayed to Week 11-12: Adjust scope based on points available

================================================================================
QUESTIONS BEFORE YOU START
================================================================================

1. MySQL Setup:
   Do you have MySQL installed locally, or prefer Docker?
   
2. Password Hashing:
   Are you comfortable with bcrypt, or want a simpler approach?
   
3. NoSQL Choice:
   MongoDB or Redis for chat messages?
   
4. Admin Dashboard:
   Will you build a custom React component, or use a library?
   
5. Timezone/Logging:
   Should timestamps be UTC or local? (Use UTC for consistency)

================================================================================
END OF PLAN
================================================================================
