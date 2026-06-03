"""
REST API route handlers with Authentication, Authorization, and Logging.
"""

from flask import Blueprint, request, jsonify, session, current_app
from models import db, User, Role, Appointment, Employee, ActionLog, SuspiciousActivity, Firm, EmployeeInvitation, Service, Review, EmployeeUnavailable, ChatMessage, BroadcastNotification
from repository import AppointmentRepository
from generator import start_generator, stop_generator
import bcrypt
import json
import time

from auth_utils import login_required, permission_required, jwt_required, role_required, create_access_token, create_refresh_token, decode_token
from logging_utils import create_action_decorator

api = Blueprint("api", __name__, url_prefix="/api")

def _get_repo() -> AppointmentRepository:
    return current_app.config["REPO"]

# ============================================================================
# AUTHENTICATION
# ============================================================================

@api.route('/auth/register', methods=['POST'])
def register():
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
    
    password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    user = User(username=username, email=email, password_hash=password_hash)
    
    # Assign requested role (default to 'user')
    requested_role = data.get('role', 'user')
    role = db.session.query(Role).filter_by(name=requested_role).first()
    if not role:
        role = db.session.query(Role).filter_by(name='user').first()
    if role:
        user.roles.append(role)
    
    db.session.add(user)
    db.session.flush() # get user id before commit
    
    if requested_role == 'admin':
        desc_data = {
            'description': data.get('businessDescription', 'A beautiful scheduling workspace.'),
            'mapsUrl': data.get('mapsUrl', ''),
            'location': '123 Green St, Downtown', # default
            'category': 'Haircut & Styling', # default
            'image': 'https://images.unsplash.com/photo-1754359667692-34308056cf0e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjBzcGElMjBpbnRlcmlvciUyMG9yZ2FuaWN8ZW58MXx8fHwxNzc0NDI2OTE5fDA&ixlib=rb-4.1.0&q=80&w=1080',
            'rating': 4.9,
            'latitude': 40.7589,
            'longitude': -73.9851,
            'services': [
                {'name': 'Classic Haircut', 'price': '$45', 'duration': '45 min'},
                {'name': 'Beard Trim', 'price': '$25', 'duration': '20 min'},
                {'name': 'Hot Towel Shave', 'price': '$35', 'duration': '30 min'},
                {'name': 'Hair & Beard Combo', 'price': '$65', 'duration': '60 min'}
            ],
            'photos': [
                'https://images.unsplash.com/photo-1754359667692-34308056cf0e?w=400'
            ],
            'reviews': []
        }
        firm = Firm(
            name=data.get('businessName', username),
            description=json.dumps(desc_data),
            owner_id=user.id
        )
        db.session.add(firm)
        
    db.session.commit()
    
    return jsonify({
        'user': user.to_dict(),
        'message': 'User registered successfully'
    }), 201



@api.route('/auth/login', methods=['POST'])
def login():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({'error': 'Invalid JSON'}), 400
    
    username = data.get('username', '')
    password = data.get('password', '')
    
    user = db.session.query(User).filter(
        (User.username == username) | (User.email == username)
    ).first()
    
    if not user or not bcrypt.checkpw(password.encode('utf-8'), user.password_hash.encode('utf-8')):
        return jsonify({'error': 'Invalid credentials'}), 401
    
    # Create JWT tokens
    access_token = create_access_token(user)
    refresh_token = create_refresh_token(user)
    
    # Also set session for backward compatibility
    session['user_id'] = user.id
    
    return jsonify({
        'user': user.to_dict(),
        'access_token': access_token,
        'refresh_token': refresh_token,
        'message': 'Login successful'
    }), 200


@api.route('/auth/logout', methods=['POST'])
def logout():
    session.pop('user_id', None)
    return jsonify({'message': 'Logged out successfully'}), 200


@api.route('/auth/refresh', methods=['POST'])
def refresh_token():
    """Issue a new access token using a valid refresh token."""
    data = request.get_json(silent=True)
    if not data or not data.get('refresh_token'):
        # Also check Authorization header
        auth_header = request.headers.get('Authorization', '')
        if auth_header.startswith('Bearer '):
            token = auth_header.split(' ', 1)[1]
        else:
            return jsonify({'error': 'Refresh token required'}), 400
    else:
        token = data['refresh_token']
    
    try:
        import jwt as pyjwt
        payload = pyjwt.decode(token, current_app.config['JWT_SECRET_KEY'], algorithms=['HS256'])
        if payload.get('type') != 'refresh':
            return jsonify({'error': 'Invalid token type'}), 401
    except Exception:
        return jsonify({'error': 'Invalid or expired refresh token'}), 401
    
    user = db.session.query(User).filter_by(id=payload['user_id']).first()
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    new_access_token = create_access_token(user)
    return jsonify({
        'access_token': new_access_token,
    }), 200


@api.route('/auth/me', methods=['GET'])
def get_current_user():
    # First try JWT
    from auth_utils import get_token_from_request, decode_token
    token = get_token_from_request()
    if token:
        try:
            payload = decode_token(token)
            user = db.session.query(User).filter_by(id=payload['user_id']).first()
            if user:
                return jsonify(user.to_dict()), 200
        except Exception:
            pass
    
    # Fallback to session
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Not logged in'}), 401
    
    user = db.session.query(User).filter_by(id=user_id).first()
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    return jsonify(user.to_dict()), 200

# ============================================================================
# EMPLOYEES
# ============================================================================

@api.route("/firms", methods=["GET"])
def list_firms():
    firms = db.session.query(Firm).all()
    return jsonify([f.to_dict() for f in firms]), 200


@api.route("/employees/me", methods=["GET"])
@login_required
def get_my_employee_profile():
    user_id = request.jwt_payload['user_id']
    emp = db.session.query(Employee).filter_by(user_id=user_id).first()
    if not emp:
        return jsonify({'error': 'Employee profile not found'}), 404
    return jsonify(emp.to_dict()), 200


@api.route("/employees", methods=["GET"])
@login_required
def list_employees():
    user_id = request.jwt_payload['user_id']
    user = db.session.query(User).filter_by(id=user_id).first()
    if not user:
        return jsonify({'error': 'User not found'}), 404
        
    if user.has_role('admin'):
        firm = db.session.query(Firm).filter_by(owner_id=user_id).first()
        if not firm:
            return jsonify([]), 200
        employees = db.session.query(Employee).filter_by(firm_id=firm.id).all()
    elif user.has_role('user') and db.session.query(Employee).filter_by(user_id=user_id).first():
        emp = db.session.query(Employee).filter_by(user_id=user_id).first()
        employees = db.session.query(Employee).filter_by(firm_id=emp.firm_id).all()
    else:
        employees = db.session.query(Employee).all()
        
    return jsonify([e.to_dict() for e in employees]), 200


@api.route("/employees", methods=["POST"])
@login_required
@permission_required('employees:update')
@create_action_decorator('CREATE_EMPLOYEE')
def create_employee():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({'error': 'Missing data'}), 400
        
    user_id = request.jwt_payload['user_id']
    firm = db.session.query(Firm).filter_by(owner_id=user_id).first()
    if not firm:
        return jsonify({'error': 'No firm associated with this admin account'}), 400
        
    import os
    # Create placeholder user account for direct creation
    placeholder_username = data.get('name', '').lower().replace(' ', '_') + f"_{int(time.time())}"
    placeholder_email = placeholder_username + "@placeholder.servicebook.com"
    placeholder_pass_hash = bcrypt.hashpw(os.urandom(16), bcrypt.gensalt()).decode('utf-8')
    
    placeholder_user = User(username=placeholder_username, email=placeholder_email, password_hash=placeholder_pass_hash)
    user_role = db.session.query(Role).filter_by(name='user').first()
    if user_role:
        placeholder_user.roles.append(user_role)
        
    db.session.add(placeholder_user)
    db.session.flush() # get user ID
    
    emp = Employee(
        name=data.get('name', ''),
        color=data.get('color', '#000000'),
        user_id=placeholder_user.id,
        firm_id=firm.id
    )
    db.session.add(emp)
    db.session.commit()
    return jsonify(emp.to_dict()), 201



@api.route("/employees/<int:employee_id>", methods=["PUT"])
@login_required
@create_action_decorator('UPDATE_EMPLOYEE', 'employee_id')
def update_employee(employee_id: int):
    user_id = request.jwt_payload['user_id']
    user = db.session.query(User).get(user_id)
    emp = db.session.query(Employee).filter_by(id=employee_id).first()
    if not emp:
        return jsonify({"error": "Not found"}), 404
        
    is_self = emp.user_id == user_id
    has_perm = user.has_permission('employees:update')
    
    if not (is_self or has_perm):
        return jsonify({'error': 'Unauthorized'}), 403
        
    data = request.get_json(silent=True)
    emp.name = data.get('name', emp.name)
    emp.color = data.get('color', emp.color)
    db.session.commit()
    return jsonify(emp.to_dict()), 200


@api.route("/employees/<int:employee_id>", methods=["DELETE"])
@login_required
@permission_required('employees:update')
@create_action_decorator('DELETE_EMPLOYEE', 'employee_id')
def delete_employee(employee_id: int):
    emp = db.session.query(Employee).filter_by(id=employee_id).first()
    if not emp:
        return jsonify({"error": "Not found"}), 404
    
    # Query the associated User object before deleting the employee profile
    user = db.session.query(User).get(emp.user_id)
    db.session.delete(emp)
    if user:
        db.session.delete(user)
        
    db.session.commit()
    return jsonify({"message": "Deleted"}), 200

# ============================================================================
# APPOINTMENTS
# ============================================================================

@api.route("/appointments", methods=["GET"])
@login_required
@permission_required('appointments:read')
def list_appointments():
    repo = _get_repo()
    try:
        page = int(request.args.get("page", 1))
    except:
        page = 1
    try:
        page_size = int(request.args.get("page_size", 10))
    except:
        page_size = 10

    # Retrieve logged-in claims from request context
    payload = getattr(request, 'jwt_payload', None)
    client_name_filter = None
    if payload:
        user_roles = payload.get('roles', [])
        # If they are a client, restrict appointments to their own client_name
        if 'client' in user_roles and 'admin' not in user_roles:
            client_name_filter = payload.get('username')

    if client_name_filter:
        query = db.session.query(Appointment).filter(Appointment.client_name == client_name_filter).order_by(Appointment.start_time)
        total = query.count()
        start = (page - 1) * page_size
        items = query.offset(start).limit(page_size).all()
    else:
        items, total = repo.list_appointments_paginated(page, page_size)
        
    total_pages = (total + page_size - 1) // page_size if total > 0 else 1

    return jsonify({
        "items": [a.to_dict() for a in items],
        "page": page,
        "page_size": page_size,
        "total": total,
        "total_pages": total_pages,
    }), 200


def get_user_reliability(user_id):
    if not user_id:
        return 100
    # The user's current reliability is the score on their latest appointment
    last_appt = db.session.query(Appointment).filter(
        Appointment.client_user_id == user_id
    ).order_by(Appointment.created_at.desc()).first()
    
    if not last_appt:
        return 100
    return last_appt.reliability_score

@api.route("/appointments", methods=["POST"])
@login_required
@permission_required('appointments:create')
@create_action_decorator('CREATE_APPOINTMENT')
def create_appointment():
    repo = _get_repo()
    data = request.get_json(silent=True)
    if data is None:
        return jsonify({"error": "Invalid JSON"}), 400

    # Auto-associate the logged-in user
    user_id = request.jwt_payload['user_id']
    user = db.session.query(User).get(user_id)
    if user:
        if user.has_role('client') and not data.get('client_name'):
            data['client_name'] = user.username
        data['client_user_id'] = user.id
        data['reliability_score'] = get_user_reliability(user.id)
    else:
        if 'reliability_score' not in data:
            data['reliability_score'] = 100

    result = repo.create(data)
    if isinstance(result, dict):
        return jsonify({"errors": result}), 400

    # Broadcast new appointment via WebSocket
    try:
        from ws import broadcast_appointment
        broadcast_appointment(result)
    except Exception as e:
        print(f"Failed to broadcast appointment: {e}")

    return jsonify(result.to_dict()), 201


@api.route("/appointments/<int:appointment_id>", methods=["PUT"])
@login_required
@permission_required('appointments:update')
@create_action_decorator('UPDATE_APPOINTMENT', 'appointment_id')
def update_appointment(appointment_id: int):
    repo = _get_repo()
    data = request.get_json(silent=True)
    if data is None:
        return jsonify({"error": "Invalid JSON"}), 400

    # If updating status to no_show, apply penalty of 25 to user's reliability
    existing = repo.get_by_id(appointment_id)
    if existing and data.get('status') == 'no_show' and existing.status != 'no_show':
        if existing.client_user_id:
            current_score = get_user_reliability(existing.client_user_id)
            data['reliability_score'] = max(0, current_score - 25)

    result = repo.update(appointment_id, data)
    if result is None:
        return jsonify({"error": "Appointment not found"}), 404
    if isinstance(result, dict):
        return jsonify({"errors": result}), 400

    return jsonify(result.to_dict()), 200


@api.route("/appointments/<int:appointment_id>", methods=["DELETE"])
@login_required
@permission_required('appointments:delete')
@create_action_decorator('DELETE_APPOINTMENT', 'appointment_id')
def delete_appointment(appointment_id: int):
    repo = _get_repo()
    appt = db.session.query(Appointment).filter_by(id=appointment_id).first()
    if not appt:
        return jsonify({"error": "Appointment not found"}), 404

    # Apply tiered cancellation penalty if the appointment is associated with a registered user
    if appt.client_user_id:
        try:
            from datetime import datetime
            appt_date = datetime.strptime(appt.date, '%Y-%m-%d')
            hours = int(appt.start_time)
            minutes = int(round((appt.start_time - hours) * 60))
            appt_datetime = appt_date.replace(hour=hours, minute=minutes)
            
            now = datetime.utcnow()
            hours_until = (appt_datetime - now).total_seconds() / 3600.0
        except Exception:
            hours_until = 0

        # Tiered penalty
        is_no_show = request.args.get('no_show') == 'true' or appt.status == 'no_show'
        if is_no_show:
            penalty = 25
        elif hours_until > 24:
            penalty = 2
        else:
            penalty = 10

        current_score = get_user_reliability(appt.client_user_id)
        appt.reliability_score = max(0, current_score - penalty)

    appt.status = 'cancelled'
    db.session.commit()
    return jsonify({"message": "Appointment cancelled successfully", "status": appt.status, "reliability_score": appt.reliability_score}), 200

# ============================================================================
# ADMIN DASHBOARD
# ============================================================================

@api.route('/admin/action-logs', methods=['GET'])
@login_required
@permission_required('logs:read')
def get_action_logs():
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


@api.route('/admin/suspicious-activity', methods=['GET'])
@login_required
@permission_required('logs:read')
def get_suspicious_activity():
    suspicious = db.session.query(SuspiciousActivity).order_by(
        SuspiciousActivity.detected_at.desc()
    ).all()
    return jsonify([s.to_dict() for s in suspicious]), 200

@api.route("/generator/start", methods=["POST"])
@login_required
def api_start_generator():
    start_generator()
    return jsonify({"message": "Generator started"}), 200

@api.route("/generator/stop", methods=["POST"])
@login_required
def api_stop_generator():
    stop_generator()
    return jsonify({"message": "Generator stopped"}), 200

# ============================================================================

# ============================================================================
# CROSS-DEVICE ACCESS CODE SYNC (LAN) & EMPLOYEE ONBOARDING
# ============================================================================

@api.route('/auth/access-code', methods=['POST'])
@login_required
@permission_required('employees:update')
def set_access_code():
    data = request.get_json(silent=True)
    if not data or not data.get('code') or not data.get('expiry'):
        return jsonify({'error': 'Missing code or expiry'}), 400
    
    user_id = request.jwt_payload['user_id']
    firm = db.session.query(Firm).filter_by(owner_id=user_id).first()
    if not firm:
        return jsonify({'error': 'No firm associated with this admin account'}), 400
        
    code = str(data['code'])
    expiry_ms = int(data['expiry'])
    
    from datetime import datetime
    expires_at = datetime.utcfromtimestamp(expiry_ms / 1000.0)
    
    # Save the invitation in the database
    invitation = EmployeeInvitation(
        code=code,
        firm_id=firm.id,
        expires_at=expires_at,
        is_used=False
    )
    db.session.add(invitation)
    db.session.commit()
    
    return jsonify({'message': 'Access code saved successfully'}), 200


@api.route('/auth/verify-code', methods=['POST'])
def verify_access_code():
    data = request.get_json(silent=True)
    if not data or not data.get('code'):
        return jsonify({'error': 'Missing code'}), 400
    
    code = str(data['code'])
    invitation = db.session.query(EmployeeInvitation).filter_by(code=code, is_used=False).first()
    if not invitation:
        return jsonify({'error': 'No active access code found on server'}), 400
        
    from datetime import datetime
    if datetime.utcnow() > invitation.expires_at:
        return jsonify({'error': 'Access code has expired'}), 400
        
    return jsonify({
        'firm_name': invitation.firm.name,
        'message': 'Code verified successfully'
    }), 200


@api.route('/auth/employee-signup', methods=['POST'])
def employee_signup():
    data = request.get_json(silent=True)
    if not data or not data.get('code') or not data.get('username') or not data.get('email') or not data.get('password') or not data.get('name') or not data.get('color'):
        return jsonify({'error': 'Missing required fields'}), 400
        
    code = str(data['code'])
    username = data['username'].strip()
    email = data['email'].strip()
    password = data['password']
    name = data['name'].strip()
    color = data['color'].strip()
    
    # Verify the code again
    invitation = db.session.query(EmployeeInvitation).filter_by(code=code, is_used=False).first()
    if not invitation:
        return jsonify({'error': 'Invalid invitation code'}), 400
        
    from datetime import datetime
    if datetime.utcnow() > invitation.expires_at:
        return jsonify({'error': 'Access code has expired'}), 400
        
    # Check if username or email exists
    if db.session.query(User).filter_by(username=username).first():
        return jsonify({'error': 'Username already exists'}), 400
        
    if db.session.query(User).filter_by(email=email).first():
        return jsonify({'error': 'Email already exists'}), 400
        
    # Create the user with employee role ('user')
    password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    user = User(username=username, email=email, password_hash=password_hash)
    
    role = db.session.query(Role).filter_by(name='user').first()
    if not role:
        role = Role(name='user')
        db.session.add(role)
    user.roles.append(role)
    
    db.session.add(user)
    db.session.flush() # get user id
    
    # Create the employee profile linked to the user and firm
    employee = Employee(
        user_id=user.id,
        firm_id=invitation.firm_id,
        name=name,
        color=color
    )
    db.session.add(employee)
    
    # Mark invitation as used
    invitation.is_used = True
    
    db.session.commit()
    
    return jsonify({
        'user': user.to_dict(),
        'message': 'Employee registered and profile created successfully'
    }), 201


# ============================================================================
# SERVICES
# ============================================================================

@api.route('/firms/<int:firm_id>/services', methods=['GET'])
def get_firm_services(firm_id):
    services = db.session.query(Service).filter_by(firm_id=firm_id).all()
    return jsonify([s.to_dict() for s in services]), 200


@api.route('/firms/<int:firm_id>/services', methods=['POST'])
@login_required
@role_required('admin')
def create_firm_service(firm_id):
    user_id = request.jwt_payload['user_id']
    firm = db.session.query(Firm).filter_by(id=firm_id, owner_id=user_id).first()
    if not firm:
        return jsonify({'error': 'Unauthorized or firm not found'}), 403
    
    data = request.get_json(silent=True)
    if not data or not data.get('name') or not data.get('price') or not data.get('duration_minutes'):
        return jsonify({'error': 'Missing required fields'}), 400
    
    service = Service(
        firm_id=firm_id,
        name=data['name'].strip(),
        price=float(data['price']),
        duration_minutes=int(data['duration_minutes'])
    )
    db.session.add(service)
    db.session.commit()
    return jsonify(service.to_dict()), 201


@api.route('/services/<int:service_id>', methods=['DELETE'])
@login_required
@role_required('admin')
def delete_service(service_id):
    service = db.session.query(Service).get(service_id)
    if not service:
        return jsonify({'error': 'Service not found'}), 404
        
    user_id = request.jwt_payload['user_id']
    if service.firm.owner_id != user_id:
        return jsonify({'error': 'Unauthorized'}), 403
        
    db.session.delete(service)
    db.session.commit()
    return jsonify({'message': 'Service deleted'}), 200


# ============================================================================
# SCHEDULING & AVAILABLE SLOTS
# ============================================================================

@api.route('/available-slots', methods=['GET'])
def get_available_slots():
    employee_id_param = request.args.get('employee_id')
    date = request.args.get('date') # YYYY-MM-DD
    service_ids_param = request.args.get('service_ids')
    
    if not (employee_id_param and date):
        return jsonify({'error': 'employee_id and date parameters are required'}), 400
        
    employee_id = int(employee_id_param)
    employee = db.session.query(Employee).get(employee_id)
    if not employee:
        return jsonify({'error': 'Employee not found'}), 404
        
    # Get firm operating hours
    open_time = employee.firm.open_time if employee.firm.open_time is not None else 8.0
    close_time = employee.firm.close_time if employee.firm.close_time is not None else 18.0
    
    # Calculate required duration in hours
    total_duration_minutes = 30
    if service_ids_param:
        try:
            s_ids = [int(i) for i in service_ids_param.split(',') if i.strip().isdigit()]
            if s_ids:
                services = db.session.query(Service).filter(Service.id.in_(s_ids)).all()
                total_duration_minutes = sum(s.duration_minutes for s in services)
        except Exception:
            pass
            
    total_duration_hours = total_duration_minutes / 60.0
    
    # Get all active appointments on this date
    appointments = db.session.query(Appointment).filter(
        Appointment.employee_id == employee_id,
        Appointment.date == date,
        Appointment.status != 'cancelled'
    ).all()
    
    # Get unavailability blocks
    unavailables = db.session.query(EmployeeUnavailable).filter(
        EmployeeUnavailable.employee_id == employee_id,
        EmployeeUnavailable.date == date
    ).all()
    
    # Generate 30-min start time slots
    slots = []
    t = open_time
    while t <= (close_time - total_duration_hours):
        # Check overlap
        overlaps = False
        end_t = t + total_duration_hours
        
        # Check appointment overlap
        for appt in appointments:
            appt_end = appt.start_time + appt.duration
            if not (end_t <= appt.start_time or t >= appt_end):
                overlaps = True
                break
                
        if not overlaps:
            # Check unavailability overlap
            for block in unavailables:
                block_end = block.start_time + block.duration
                if not (end_t <= block.start_time or t >= block_end):
                    overlaps = True
                    break
                    
        if not overlaps:
            hours = int(t)
            minutes = int(round((t - hours) * 60))
            label = f"{hours:02d}:{minutes:02d}"
            slots.append({
                'time': t,
                'label': label
            })
            
        t += 0.5 # 30 min step
        
    return jsonify(slots), 200


# ============================================================================
# EMPLOYEE UNAVAILABILITY
# ============================================================================

@api.route('/employees/<int:employee_id>/unavailable', methods=['POST'])
@login_required
def set_employee_unavailable(employee_id):
    # Verify authorization (admin of firm, or the employee themselves)
    user_id = request.jwt_payload['user_id']
    employee = db.session.query(Employee).get(employee_id)
    if not employee:
        return jsonify({'error': 'Employee not found'}), 404
        
    user = db.session.query(User).get(user_id)
    is_owner = employee.firm.owner_id == user_id
    is_self = employee.user_id == user_id
    
    if not (is_owner or is_self):
        return jsonify({'error': 'Unauthorized'}), 403
        
    data = request.get_json(silent=True)
    if not data or not data.get('date') or data.get('start_time') is None or data.get('duration') is None:
        return jsonify({'error': 'Missing required fields'}), 400
        
    block = EmployeeUnavailable(
        employee_id=employee_id,
        date=data['date'],
        start_time=float(data['start_time']),
        duration=float(data['duration']),
        reason=data.get('reason', '').strip()
    )
    db.session.add(block)
    db.session.commit()
    return jsonify(block.to_dict()), 201


@api.route('/employees/<int:employee_id>/unavailable', methods=['GET'])
@login_required
def get_employee_unavailable(employee_id):
    date = request.args.get('date')
    query = db.session.query(EmployeeUnavailable).filter_by(employee_id=employee_id)
    if date:
        query = query.filter_by(date=date)
    blocks = query.all()
    return jsonify([b.to_dict() for b in blocks]), 200


@api.route('/unavailability/<int:block_id>', methods=['DELETE'])
@login_required
def delete_employee_unavailable(block_id):
    block = db.session.query(EmployeeUnavailable).get(block_id)
    if not block:
        return jsonify({'error': 'Block not found'}), 404
        
    user_id = request.jwt_payload['user_id']
    employee = db.session.query(Employee).get(block.employee_id)
    is_owner = employee.firm.owner_id == user_id if employee else False
    is_self = employee.user_id == user_id if employee else False
    
    if not (is_owner or is_self):
        return jsonify({'error': 'Unauthorized'}), 403
        
    db.session.delete(block)
    db.session.commit()
    return jsonify({'message': 'Block deleted successfully'}), 200


# ============================================================================================
# REVIEWS
# ============================================================================

@api.route('/reviews', methods=['POST'])
@login_required
def create_review():
    user_id = request.jwt_payload['user_id']
    data = request.get_json(silent=True)
    if not data or not data.get('appointment_id') or not data.get('rating'):
        return jsonify({'error': 'Missing required fields'}), 400
        
    appt_id = int(data['appointment_id'])
    rating = int(data['rating'])
    text = data.get('text', '').strip()
    
    if rating < 1 or rating > 5:
        return jsonify({'error': 'Rating must be between 1 and 5'}), 400
        
    appt = db.session.query(Appointment).get(appt_id)
    if not appt:
        return jsonify({'error': 'Appointment not found'}), 404
        
    if appt.client_user_id != user_id:
        return jsonify({'error': 'Unauthorized'}), 403
        
    if appt.status != 'completed':
        return jsonify({'error': 'Can only review completed appointments'}), 400
        
    existing_review = db.session.query(Review).filter_by(appointment_id=appt_id).first()
    if existing_review:
        return jsonify({'error': 'Review already exists for this appointment'}), 400
        
    review = Review(
        firm_id=appt.employee.firm_id,
        employee_id=appt.employee_id,
        client_user_id=user_id,
        appointment_id=appt_id,
        rating=rating,
        text=text
    )
    db.session.add(review)
    db.session.commit()
    return jsonify(review.to_dict()), 201


@api.route('/firms/<int:firm_id>/reviews', methods=['GET'])
def list_firm_reviews(firm_id):
    reviews = db.session.query(Review).filter_by(firm_id=firm_id).order_by(Review.created_at.desc()).all()
    return jsonify([r.to_dict() for r in reviews]), 200


@api.route('/employees/<int:employee_id>/reviews', methods=['GET'])
@login_required
def list_employee_reviews(employee_id):
    reviews = db.session.query(Review).filter_by(employee_id=employee_id).order_by(Review.created_at.desc()).all()
    return jsonify([r.to_dict() for r in reviews]), 200


@api.route('/reviews/<int:review_id>', methods=['DELETE'])
@login_required
@role_required('admin')
def delete_review(review_id):
    review = db.session.query(Review).get(review_id)
    if not review:
        return jsonify({'error': 'Review not found'}), 404
        
    user_id = request.jwt_payload['user_id']
    if review.firm.owner_id != user_id:
        return jsonify({'error': 'Unauthorized'}), 403
        
    db.session.delete(review)
    db.session.commit()
    return jsonify({'message': 'Review deleted successfully'}), 200


@api.route('/pending-reviews', methods=['GET'])
@login_required
def get_pending_reviews():
    user_id = request.jwt_payload['user_id']
    subquery = db.session.query(Review.appointment_id).subquery()
    appts = db.session.query(Appointment).filter(
        Appointment.client_user_id == user_id,
        Appointment.status == 'completed',
        ~Appointment.id.in_(subquery)
    ).all()
    return jsonify([a.to_dict() for a in appts]), 200


# ============================================================================
# USER MANAGEMENT & BAN
# ============================================================================

@api.route('/users/<int:user_id>/ban', methods=['POST'])
@login_required
@role_required('admin')
def ban_user(user_id):
    user = db.session.query(User).get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
        
    user.is_active = False
    db.session.commit()
    return jsonify({'message': f'User {user.username} has been banned'}), 200


# ============================================================================
# PROFILE UPDATES & FILE UPLOADS
# ============================================================================

@api.route('/users/me', methods=['PUT'])
@login_required
def update_profile():
    user_id = request.jwt_payload['user_id']
    user = db.session.query(User).get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
        
    data = request.get_json(silent=True)
    if not data:
        return jsonify({'error': 'Invalid JSON'}), 400
        
    email_changed = 'email' in data and data['email'].strip() != user.email
    password_changed = 'new_password' in data and data['new_password']
    
    if email_changed or password_changed:
        current_password = data.get('current_password')
        if not current_password or not bcrypt.checkpw(current_password.encode('utf-8'), user.password_hash.encode('utf-8')):
            return jsonify({'error': 'Verification failed: incorrect current password'}), 401
            
    if 'username' in data:
        new_username = data['username'].strip()
        if new_username != user.username:
            if db.session.query(User).filter_by(username=new_username).first():
                return jsonify({'error': 'Username already exists'}), 400
            user.username = new_username
            
    if email_changed:
        new_email = data['email'].strip()
        if db.session.query(User).filter_by(email=new_email).first():
            return jsonify({'error': 'Email already exists'}), 400
        user.email = new_email
        
    if password_changed:
        user.password_hash = bcrypt.hashpw(data['new_password'].encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        
    if 'phone' in data:
        user.phone = data['phone'].strip() if data['phone'] else None
        
    if 'avatar_url' in data:
        user.avatar_url = data['avatar_url'].strip() if data['avatar_url'] else None
        
    db.session.commit()
    return jsonify(user.to_dict()), 200


from werkzeug.utils import secure_filename
import os

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@api.route('/upload', methods=['POST'])
@login_required
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
        
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        filename = f"{int(time.time())}_{filename}"
        
        upload_folder = current_app.config.get('UPLOAD_FOLDER')
        if not os.path.exists(upload_folder):
            os.makedirs(upload_folder)
            
        file.save(os.path.join(upload_folder, filename))
        file_url = f"/uploads/{filename}"
        return jsonify({'url': file_url}), 200
        
    return jsonify({'error': 'File type not allowed'}), 400


# ============================================================================
# PERSISTENT CHAT & CONVERSATIONS
# ============================================================================

@api.route('/chats/conversations', methods=['GET'])
@login_required
def get_conversations():
    user_id = request.jwt_payload['user_id']
    messages = db.session.query(ChatMessage).filter(
        (ChatMessage.sender_id == user_id) | (ChatMessage.receiver_id == user_id)
    ).order_by(ChatMessage.created_at.desc()).all()
    
    convs = {}
    for m in messages:
        other_id = m.receiver_id if m.sender_id == user_id else m.sender_id
        if other_id not in convs:
            other_user = db.session.query(User).get(other_id)
            if other_user:
                convs[other_id] = {
                    'other_user': other_user.to_dict(),
                    'last_message': m.to_dict()
                }
    return jsonify(list(convs.values())), 200


@api.route('/admin/chats/conversations', methods=['GET'])
@login_required
@role_required('admin')
def get_admin_conversations():
    user_id = request.jwt_payload['user_id']
    firm = db.session.query(Firm).filter_by(owner_id=user_id).first()
    if not firm:
        return jsonify({'error': 'Firm not found'}), 404
        
    emp_ids = [e.user_id for e in firm.employees if e.user_id]
    all_ids = [user_id] + emp_ids
    
    messages = db.session.query(ChatMessage).filter(
        (ChatMessage.sender_id.in_(all_ids)) | (ChatMessage.receiver_id.in_(all_ids))
    ).order_by(ChatMessage.created_at.desc()).all()
    
    convs = {}
    for m in messages:
        pair = tuple(sorted([m.sender_id, m.receiver_id]))
        if pair not in convs:
            u1 = db.session.query(User).get(pair[0])
            u2 = db.session.query(User).get(pair[1])
            if u1 and u2:
                convs[pair] = {
                    'user1': u1.to_dict(),
                    'user2': u2.to_dict(),
                    'last_message': m.to_dict()
                }
    return jsonify(list(convs.values())), 200


@api.route('/chats/history', methods=['GET'])
@login_required
def get_chat_history():
    user_id = request.jwt_payload['user_id']
    user1_id = request.args.get('user1_id')
    user2_id = request.args.get('user2_id')
    
    if user1_id and user2_id:
        roles = request.jwt_payload.get('roles', [])
        if 'admin' not in roles:
            return jsonify({'error': 'Unauthorized'}), 403
        u1 = int(user1_id)
        u2 = int(user2_id)
        messages = db.session.query(ChatMessage).filter(
            ((ChatMessage.sender_id == u1) & (ChatMessage.receiver_id == u2)) |
            ((ChatMessage.sender_id == u2) & (ChatMessage.receiver_id == u1))
        ).order_by(ChatMessage.created_at.asc()).all()
    else:
        with_user_id = request.args.get('with_user_id')
        if not with_user_id:
            return jsonify({'error': 'with_user_id parameter is required'}), 400
        with_user_id = int(with_user_id)
        messages = db.session.query(ChatMessage).filter(
            ((ChatMessage.sender_id == user_id) & (ChatMessage.receiver_id == with_user_id)) |
            ((ChatMessage.sender_id == with_user_id) & (ChatMessage.receiver_id == user_id))
        ).order_by(ChatMessage.created_at.asc()).all()
        
    return jsonify([m.to_dict() for m in messages]), 200


@api.route('/chats/send', methods=['POST'])
@login_required
def send_chat_message():
    user_id = request.jwt_payload['user_id']
    data = request.get_json(silent=True)
    if not data or not data.get('receiver_id') or not data.get('message'):
        return jsonify({'error': 'Missing receiver_id or message'}), 400
        
    receiver_id = int(data['receiver_id'])
    message_text = data['message'].strip()
    
    msg = ChatMessage(
        sender_id=user_id,
        receiver_id=receiver_id,
        message=message_text
    )
    db.session.add(msg)
    db.session.commit()
    
    return jsonify(msg.to_dict()), 201


# ============================================================================
# BROADCAST NOTIFICATIONS
# ============================================================================

@api.route('/broadcasts', methods=['POST'])
@login_required
@role_required('admin')
def create_broadcast():
    user_id = request.jwt_payload['user_id']
    firm = db.session.query(Firm).filter_by(owner_id=user_id).first()
    if not firm:
        return jsonify({'error': 'No firm associated with this admin account'}), 400
        
    data = request.get_json(silent=True)
    if not data or not data.get('message'):
        return jsonify({'error': 'Missing message'}), 400
        
    broadcast = BroadcastNotification(
        firm_id=firm.id,
        message=data['message'].strip()
    )
    db.session.add(broadcast)
    db.session.commit()
    
    try:
        from ws import broadcast_message
        broadcast_message({
            'type': 'broadcast',
            'firm_name': firm.name,
            'message': broadcast.message,
            'timestamp': broadcast.created_at.isoformat()
        })
    except Exception as e:
        print(f"Failed to broadcast: {e}")
        
    return jsonify(broadcast.to_dict()), 201


@api.route('/notifications', methods=['GET'])
@login_required
def get_notifications():
    broadcasts = db.session.query(BroadcastNotification).order_by(BroadcastNotification.created_at.desc()).all()
    return jsonify([b.to_dict() for b in broadcasts]), 200


@api.route('/firms/me', methods=['GET'])
@login_required
@role_required('admin')
def get_my_firm():
    user_id = request.jwt_payload['user_id']
    firm = db.session.query(Firm).filter_by(owner_id=user_id).first()
    if not firm:
        return jsonify({'error': 'Firm not found'}), 404
    return jsonify(firm.to_dict()), 200


@api.route('/firms/me', methods=['PUT'])
@login_required
@role_required('admin')
def update_my_firm():
    user_id = request.jwt_payload['user_id']
    firm = db.session.query(Firm).filter_by(owner_id=user_id).first()
    if not firm:
        return jsonify({'error': 'Firm not found'}), 404
        
    data = request.get_json(silent=True)
    if not data:
        return jsonify({'error': 'Invalid JSON'}), 400
        
    firm.name = data.get('name', firm.name)
    if 'open_time' in data:
        firm.open_time = float(data['open_time'])
    if 'close_time' in data:
        firm.close_time = float(data['close_time'])
    
    # We can also update details inside the JSON description
    try:
        desc_data = json.loads(firm.description) if firm.description else {}
    except Exception:
        desc_data = {}
        
    if 'location' in data:
        desc_data['location'] = data['location']
    if 'latitude' in data:
        desc_data['latitude'] = float(data['latitude'])
    if 'longitude' in data:
        desc_data['longitude'] = float(data['longitude'])
    if 'category' in data:
        desc_data['category'] = data['category']
    if 'image' in data:
        desc_data['image'] = data['image']
    if 'description_text' in data:
        desc_data['description'] = data['description_text']
    if 'social_tiktok' in data:
        desc_data['social_tiktok'] = data['social_tiktok']
    if 'social_instagram' in data:
        desc_data['social_instagram'] = data['social_instagram']
        
    firm.description = json.dumps(desc_data)
    db.session.commit()
    
    return jsonify(firm.to_dict()), 200

