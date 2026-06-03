"""
SQLAlchemy ORM models for ServiceBook.

Includes:
  - User authentication (Bronze)
  - Role-based access control (Silver)
  - Employee and Appointment management (Bronze)
  - Service catalog and scheduling (Production)
  - Reviews and ratings (Production)
  - Chat messaging (Production)
  - Broadcast notifications (Production)
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

# Many-to-many: Appointment <-> Service
appointment_service = Table(
    'appointment_service',
    db.metadata,
    Column('appointment_id', Integer, ForeignKey('appointment.id', ondelete='CASCADE'), primary_key=True),
    Column('service_id', Integer, ForeignKey('service.id', ondelete='CASCADE'), primary_key=True),
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
    phone = Column(String(20), nullable=True)
    avatar_url = Column(String(500), nullable=True)
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
            'phone': self.phone,
            'avatar_url': self.avatar_url,
            'created_at': self.created_at.isoformat(),
            'is_active': self.is_active,
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

class Firm(db.Model):
    """
    Firm model (e.g. Barber shop, Salon).
    """
    __tablename__ = 'firm'
    
    id = Column(Integer, primary_key=True)
    name = Column(String(120), nullable=False)
    description = Column(Text, nullable=True)
    owner_id = Column(Integer, ForeignKey('user.id', ondelete='CASCADE'), nullable=False, index=True)
    open_time = Column(Float, nullable=False, default=8.0)   # e.g. 8.0 = 08:00
    close_time = Column(Float, nullable=False, default=18.0)  # e.g. 18.0 = 18:00
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    
    employees = relationship('Employee', backref='firm', cascade='all, delete-orphan')
    services = relationship('Service', backref='firm', cascade='all, delete-orphan')

    def to_dict(self):
        desc = self.description
        data = {
            'id': self.id,
            'name': self.name,
            'description': desc,
            'owner_id': self.owner_id,
            'open_time': self.open_time,
            'close_time': self.close_time,
            'created_at': self.created_at.isoformat(),
            'employees': [e.to_dict() for e in self.employees]
        }
        # Parse JSON description for extra rich metadata
        if desc and desc.strip().startswith('{'):
            try:
                import json
                extra = json.loads(desc)
                data.update(extra)
            except Exception:
                pass
        # Add actual database services
        data['services'] = [s.to_dict() for s in self.services]
        return data

class EmployeeInvitation(db.Model):
    """
    Model for employee invitation codes generated by firms.
    """
    __tablename__ = 'employee_invitation'
    
    id = Column(Integer, primary_key=True)
    code = Column(String(6), unique=True, nullable=False, index=True)
    firm_id = Column(Integer, ForeignKey('firm.id', ondelete='CASCADE'), nullable=False, index=True)
    is_used = Column(Boolean, default=False, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    
    # Relationship
    firm = relationship('Firm', backref='invitations')
    
    def to_dict(self):
        return {
            'id': self.id,
            'code': self.code,
            'firm_id': self.firm_id,
            'is_used': self.is_used,
            'expires_at': self.expires_at.isoformat(),
            'created_at': self.created_at.isoformat(),
        }


class Employee(db.Model):
    """
    Employee model (barber/stylist).
    
    3NF: Every column depends on PK (id).
    """
    __tablename__ = 'employee'
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('user.id', ondelete='CASCADE'), nullable=False, index=True)
    firm_id = Column(Integer, ForeignKey('firm.id', ondelete='CASCADE'), nullable=True, index=True)
    name = Column(String(120), nullable=False)
    color = Column(String(7), nullable=False)  # Hex color code
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    
    # Relationships
    appointments = relationship('Appointment', backref='employee', cascade='all, delete-orphan')
    unavailable_blocks = relationship('EmployeeUnavailable', backref='employee', cascade='all, delete-orphan')
    
    def to_dict(self):
        total_appts = len(self.appointments)
        avg_rel = sum(a.reliability_score for a in self.appointments) / total_appts if total_appts > 0 else 0
        # Simple revenue logic: $50 per hour of duration
        revenue = sum(a.duration * 50 for a in self.appointments)

        return {
            'id': str(self.id),  # Frontend expects strings
            'user_id': self.user_id,
            'firm_id': self.firm_id,
            'name': self.name,
            'color': self.color,
            'created_at': self.created_at.isoformat(),
            'statistics': {
                'totalAppointments': total_appts,
                'totalRevenue': int(revenue),
                'averageReliability': int(avg_rel)
            }
        }

# ============================================================================
# SERVICE CATALOG (Production)
# ============================================================================

class Service(db.Model):
    """
    Service menu item for a firm (e.g. 'Classic Haircut', 'Beard Trim').
    
    3NF: Every column depends on PK (id).
    """
    __tablename__ = 'service'
    
    id = Column(Integer, primary_key=True)
    firm_id = Column(Integer, ForeignKey('firm.id', ondelete='CASCADE'), nullable=False, index=True)
    name = Column(String(120), nullable=False)
    price = Column(Float, nullable=False, default=0.0)
    duration_minutes = Column(Integer, nullable=False, default=30)
    
    def to_dict(self):
        return {
            'id': self.id,
            'firm_id': self.firm_id,
            'name': self.name,
            'price': self.price,
            'duration_minutes': self.duration_minutes,
        }

# ============================================================================
# SCHEDULING (Production)
# ============================================================================

class Appointment(db.Model):
    """
    Appointment model.
    
    3NF: Every column depends on PK (id).
    """
    __tablename__ = 'appointment'
    
    id = Column(Integer, primary_key=True)
    employee_id = Column(Integer, ForeignKey('employee.id', ondelete='CASCADE'), nullable=False, index=True)
    client_user_id = Column(Integer, ForeignKey('user.id', ondelete='SET NULL'), nullable=True, index=True)
    client_name = Column(String(120), nullable=False)
    service = Column(String(100), nullable=False)
    date = Column(String(10), nullable=True)  # YYYY-MM-DD
    start_time = Column(Float, nullable=False)  # Hours (e.g., 9.5 = 9:30 AM)
    duration = Column(Float, nullable=False)    # Hours
    status = Column(String(20), nullable=False, default='confirmed')  # confirmed, completed, cancelled, no_show
    reliability_score = Column(Integer, nullable=False)  # 0-100
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Many-to-many relationship with services
    booked_services = relationship('Service', secondary=appointment_service, backref='appointments')
    # Relationship to review
    review = relationship('Review', backref='appointment', uselist=False, cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': str(self.id),  # Frontend expects strings
            'employeeId': str(self.employee_id),
            'clientUserId': self.client_user_id,
            'clientName': self.client_name,
            'service': self.service,
            'date': self.date,
            'startTime': self.start_time,
            'duration': self.duration,
            'status': self.status,
            'reliabilityScore': self.reliability_score,
            'bookedServices': [s.to_dict() for s in self.booked_services] if self.booked_services else [],
            'hasReview': self.review is not None,
            'createdAt': self.created_at.isoformat(),
            'updatedAt': self.updated_at.isoformat(),
        }


class EmployeeUnavailable(db.Model):
    """
    Blocks schedule slots for vacation, breaks, or sick days.
    
    3NF: Every column depends on PK (id).
    """
    __tablename__ = 'employee_unavailable'
    
    id = Column(Integer, primary_key=True)
    employee_id = Column(Integer, ForeignKey('employee.id', ondelete='CASCADE'), nullable=False, index=True)
    date = Column(String(10), nullable=False)  # YYYY-MM-DD
    start_time = Column(Float, nullable=False)  # Hours
    duration = Column(Float, nullable=False)    # Hours
    reason = Column(String(255), nullable=True)  # e.g. 'Lunch break', 'Vacation'
    
    def to_dict(self):
        return {
            'id': self.id,
            'employee_id': self.employee_id,
            'date': self.date,
            'start_time': self.start_time,
            'duration': self.duration,
            'reason': self.reason,
        }

# ============================================================================
# REVIEWS & RATINGS (Production)
# ============================================================================

class Review(db.Model):
    """
    Client review for a completed appointment.
    
    3NF: Every column depends on PK (id).
    """
    __tablename__ = 'review'
    
    id = Column(Integer, primary_key=True)
    firm_id = Column(Integer, ForeignKey('firm.id', ondelete='CASCADE'), nullable=False, index=True)
    employee_id = Column(Integer, ForeignKey('employee.id', ondelete='SET NULL'), nullable=True, index=True)
    client_user_id = Column(Integer, ForeignKey('user.id', ondelete='SET NULL'), nullable=True, index=True)
    appointment_id = Column(Integer, ForeignKey('appointment.id', ondelete='CASCADE'), nullable=False, unique=True)
    rating = Column(Integer, nullable=False)  # 1-5
    text = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    
    def to_dict(self):
        client_user = db.session.get(User, self.client_user_id) if self.client_user_id else None
        return {
            'id': self.id,
            'firm_id': self.firm_id,
            'employee_id': self.employee_id,
            'client_user_id': self.client_user_id,
            'client_name': client_user.username if client_user else 'Anonymous',
            'appointment_id': self.appointment_id,
            'rating': self.rating,
            'text': self.text,
            'created_at': self.created_at.isoformat(),
        }

# ============================================================================
# MESSAGING (Production)
# ============================================================================

class ChatMessage(db.Model):
    """
    Direct message between two users (persistent, replaces TinyDB).
    
    3NF: Every column depends on PK (id).
    """
    __tablename__ = 'chat_message'
    
    id = Column(Integer, primary_key=True)
    sender_id = Column(Integer, ForeignKey('user.id', ondelete='CASCADE'), nullable=False, index=True)
    receiver_id = Column(Integer, ForeignKey('user.id', ondelete='CASCADE'), nullable=False, index=True)
    message = Column(Text, nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)
    
    sender = relationship('User', foreign_keys=[sender_id], backref='sent_messages')
    receiver = relationship('User', foreign_keys=[receiver_id], backref='received_messages')
    
    def to_dict(self):
        return {
            'id': self.id,
            'sender_id': self.sender_id,
            'receiver_id': self.receiver_id,
            'sender_name': self.sender.username if self.sender else 'Unknown',
            'receiver_name': self.receiver.username if self.receiver else 'Unknown',
            'message': self.message,
            'created_at': self.created_at.isoformat(),
        }


class BroadcastNotification(db.Model):
    """
    Persistent broadcast notification sent by firm admin.
    
    3NF: Every column depends on PK (id).
    """
    __tablename__ = 'broadcast_notification'
    
    id = Column(Integer, primary_key=True)
    firm_id = Column(Integer, ForeignKey('firm.id', ondelete='CASCADE'), nullable=False, index=True)
    message = Column(Text, nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)
    
    firm = relationship('Firm', backref='broadcasts')
    
    def to_dict(self):
        return {
            'id': self.id,
            'firm_id': self.firm_id,
            'firm_name': self.firm.name if self.firm else 'Unknown',
            'message': self.message,
            'created_at': self.created_at.isoformat(),
        }

# ============================================================================
# LOGGING SYSTEM (Gold)
# ============================================================================

class ActionLog(db.Model):
    """
    Audit log for every action performed by logged-in users.
    
    3NF: Every column depends on PK (id).
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
