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
    """
    if user_id is None:
        # Try JWT payload first, then fall back to session
        jwt_payload = getattr(request, 'jwt_payload', None)
        if jwt_payload:
            user_id = jwt_payload.get('user_id')
        else:
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
    """
    from functools import wraps
    
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            resource = None
            if resource_param and resource_param in kwargs:
                resource = f"resource:{kwargs[resource_param]}"
            
            result = f(*args, **kwargs)
            log_action(action, resource)
            return result
        return decorated
    return decorator
