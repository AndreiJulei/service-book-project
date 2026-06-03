"""
Database seed/initialization script.
"""

from datetime import datetime, timedelta
from models import db, User, Role, Permission, Employee, Appointment, Service, Review, EmployeeUnavailable, Firm
from config import DevelopmentConfig
from flask import Flask
import bcrypt
import json

def hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def init_db(app):
    """Initialize the database with default data."""
    with app.app_context():
        # Create tables
        db.create_all()
        
        # Create roles if they don't exist
        admin_role = db.session.query(Role).filter_by(name='admin').first()
        if not admin_role:
            admin_role = Role(name='admin', description='Administrator with full access')
            db.session.add(admin_role)
            
        user_role = db.session.query(Role).filter_by(name='user').first()
        if not user_role:
            user_role = Role(name='user', description='Regular user with restricted access')
            db.session.add(user_role)
            
        client_role = db.session.query(Role).filter_by(name='client').first()
        if not client_role:
            client_role = Role(name='client', description='Client user')
            db.session.add(client_role)
            
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
        
        # Create or update seed users
        admin_user = db.session.query(User).filter_by(username='admin').first()
        if not admin_user:
            admin_user = User(
                username='admin',
                email='admin@servicebook.com',
                password_hash=hash_password('admin123'),
                phone='0740123456',
                avatar_url='https://api.dicebear.com/7.x/adventurer/svg?seed=admin'
            )
            admin_user.roles = [admin_role]
            db.session.add(admin_user)
        else:
            admin_user.email = 'admin@servicebook.com'
        db.session.commit()
        
        user = db.session.query(User).filter_by(username='john_doe').first()
        if not user:
            user = User(
                username='john_doe',
                email='john@servicebook.com',
                password_hash=hash_password('password123'),
                phone='0740234567',
                avatar_url='https://api.dicebear.com/7.x/adventurer/svg?seed=john'
            )
            user.roles = [user_role]
            db.session.add(user)
        else:
            user.email = 'john@servicebook.com'
        db.session.commit()
            
        client_role = db.session.query(Role).filter_by(name='client').first()
        client_user = db.session.query(User).filter_by(username='client').first()
        if not client_user:
            client_user = User(
                username='client',
                email='client@servicebook.com',
                password_hash=hash_password('client123'),
                phone='0740345678',
                avatar_url='https://api.dicebear.com/7.x/adventurer/svg?seed=client'
            )
            client_user.roles = [client_role]
            db.session.add(client_user)
        else:
            client_user.email = 'client@servicebook.com'
        db.session.commit()
            
        # Dental Admin
        dental_admin = db.session.query(User).filter_by(username='dental_admin').first()
        if not dental_admin:
            dental_admin = User(
                username='dental_admin',
                email='dental@servicebook.com',
                password_hash=hash_password('dental123'),
                phone='0740456789',
                avatar_url='https://api.dicebear.com/7.x/adventurer/svg?seed=dental'
            )
            dental_admin.roles = [admin_role]
            db.session.add(dental_admin)
        db.session.commit()
        
        # Fitness Admin
        fitness_admin = db.session.query(User).filter_by(username='fitness_admin').first()
        if not fitness_admin:
            fitness_admin = User(
                username='fitness_admin',
                email='fitness@servicebook.com',
                password_hash=hash_password('fitness123'),
                phone='0740567890',
                avatar_url='https://api.dicebear.com/7.x/adventurer/svg?seed=fitness'
            )
            fitness_admin.roles = [admin_role]
            db.session.add(fitness_admin)
        db.session.commit()
            
        admin_user_obj = db.session.query(User).filter_by(username='admin').first()
        dental_admin_obj = db.session.query(User).filter_by(username='dental_admin').first()
        fitness_admin_obj = db.session.query(User).filter_by(username='fitness_admin').first()
        
        # Descriptions
        f1_desc = {
            'category': 'Haircut & Styling',
            'rating': 4.9,
            'image': 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=600',
            'location': 'Calea Moților 10, Cluj-Napoca',
            'duration': '45 min',
            'price': '$45',
            'latitude': 46.7735,
            'longitude': 23.5894,
            'description': 'Modern barbershop specializing in classic cuts and contemporary styles. Expert team with over 20 years of combined experience.',
            'services': [
                { 'name': 'Classic Haircut', 'price': '$45', 'duration': '45 min' },
                { 'name': 'Beard Trim', 'price': '$25', 'duration': '20 min' },
                { 'name': 'Hot Towel Shave', 'price': '$35', 'duration': '30 min' },
                { 'name': 'Hair & Beard Combo', 'price': '$65', 'duration': '60 min' }
            ],
            'photos': [
                'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=400',
                'https://images.unsplash.com/photo-1582555172866-f73bb12a2ab3?w=400',
                'https://images.unsplash.com/photo-1621607512214-68297480165e?w=400'
            ],
            'reviews': []
        }
        
        f2_desc = {
            'category': 'Dental Cleaning',
            'rating': 4.8,
            'image': 'https://images.unsplash.com/photo-1606811841689-23dfddce3e95?w=600',
            'location': 'Str. Theodor Mihali 4, Cluj-Napoca',
            'duration': '60 min',
            'price': '$120',
            'latitude': 46.7681,
            'longitude': 23.6145,
            'description': 'State-of-the-art dental practice focused on preventive care and patient comfort. Gentle, caring approach to all dental needs.',
            'services': [
                { 'name': 'Regular Cleaning', 'price': '$120', 'duration': '60 min' },
                { 'name': 'Deep Cleaning', 'price': '$200', 'duration': '90 min' },
                { 'name': 'Whitening', 'price': '$300', 'duration': '75 min' },
                { 'name': 'Checkup', 'price': '$80', 'duration': '30 min' }
            ],
            'photos': [
                'https://images.unsplash.com/photo-1606811841689-23dfddce3e95?w=400',
                'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?w=400'
            ],
            'reviews': []
        }
        
        f3_desc = {
            'category': 'Personal Training',
            'rating': 4.7,
            'image': 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600',
            'location': 'Str. Primăverii 2, Cluj-Napoca',
            'duration': '90 min',
            'price': '$80',
            'latitude': 46.7695,
            'longitude': 23.5823,
            'description': 'Premium fitness center offering personalized training programs. Achieve your fitness goals with certified professionals.',
            'services': [
                { 'name': '1-on-1 Training', 'price': '$80', 'duration': '60 min' },
                { 'name': 'Group Session', 'price': '$40', 'duration': '60 min' },
                { 'name': 'Nutrition Consult', 'price': '$60', 'duration': '45 min' },
                { 'name': 'Assessment', 'price': '$50', 'duration': '30 min' }
            ],
            'photos': [
                'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=400',
                'https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=400'
            ],
            'reviews': []
        }
        
        # Seed Firms
        firm1 = db.session.query(Firm).filter_by(name='The Forest Barber').first()
        if not firm1:
            firm1 = Firm(
                name='The Forest Barber',
                description=json.dumps(f1_desc),
                owner_id=admin_user_obj.id,
                open_time=8.0,
                close_time=20.0
            )
            db.session.add(firm1)
            
        firm2 = db.session.query(Firm).filter_by(name='Serenity Dental').first()
        if not firm2:
            firm2 = Firm(
                name='Serenity Dental',
                description=json.dumps(f2_desc),
                owner_id=dental_admin_obj.id,
                open_time=9.0,
                close_time=17.0
            )
            db.session.add(firm2)
            
        firm3 = db.session.query(Firm).filter_by(name='Peak Fitness Studio').first()
        if not firm3:
            firm3 = Firm(
                name='Peak Fitness Studio',
                description=json.dumps(f3_desc),
                owner_id=fitness_admin_obj.id,
                open_time=7.0,
                close_time=21.0
            )
            db.session.add(firm3)
            
        db.session.commit()
        
        # Seed Services
        for firm, desc in [(firm1, f1_desc), (firm2, f2_desc), (firm3, f3_desc)]:
            for s in desc['services']:
                existing_service = db.session.query(Service).filter_by(firm_id=firm.id, name=s['name']).first()
                if not existing_service:
                    price_val = float(s['price'].replace('$', ''))
                    dur_val = int(s['duration'].replace(' min', ''))
                    new_service = Service(
                        firm_id=firm.id,
                        name=s['name'],
                        price=price_val,
                        duration_minutes=dur_val
                    )
                    db.session.add(new_service)
        db.session.commit()
        
        # Create unique users for employees
        emp_users_data = [
            {'username': 'marcus', 'email': 'marcus@servicebook.com'},
            {'username': 'sarah', 'email': 'sarah@servicebook.com'},
            {'username': 'jake', 'email': 'jake@servicebook.com'},
            {'username': 'emily', 'email': 'emily@servicebook.com'},
        ]
        
        emp_users = {}
        for udata in emp_users_data:
            uobj = db.session.query(User).filter_by(username=udata['username']).first()
            if not uobj:
                uobj = User(
                    username=udata['username'],
                    email=udata['email'],
                    password_hash=hash_password('password123'),
                    phone='0740000000',
                    avatar_url=f'https://api.dicebear.com/7.x/adventurer/svg?seed={udata["username"]}'
                )
                uobj.roles = [user_role]
                db.session.add(uobj)
            emp_users[udata['username']] = uobj
        db.session.commit()
        
        # Create seed employees
        f1_id = db.session.query(Firm).filter_by(name='The Forest Barber').first().id
        f2_id = db.session.query(Firm).filter_by(name='Serenity Dental').first().id
        f3_id = db.session.query(Firm).filter_by(name='Peak Fitness Studio').first().id
        
        employees_data = [
            {'name': 'Marcus Chen', 'color': '#8FAF8A', 'user_id': emp_users['marcus'].id, 'firm_id': f1_id},
            {'name': 'Jake Morrison', 'color': '#50C878', 'user_id': emp_users['jake'].id, 'firm_id': f1_id},
            {'name': 'Dr. Sarah Williams', 'color': '#6B7F5F', 'user_id': emp_users['sarah'].id, 'firm_id': f2_id},
            {'name': 'Dr. Emily Zhang', 'color': '#4A7C59', 'user_id': emp_users['emily'].id, 'firm_id': f2_id},
        ]
        
        if not db.session.query(Employee).first():
            for emp_data in employees_data:
                emp = Employee(**emp_data)
                db.session.add(emp)
            db.session.commit()
            
        employees = db.session.query(Employee).all()
        e1, e2, e3 = employees[0].id, employees[1].id, employees[2].id
        
        # Create seed appointments
        client_user_obj = db.session.query(User).filter_by(username='client').first()
        john_user_obj = db.session.query(User).filter_by(username='john_doe').first()
        
        # Today's date string
        today_str = datetime.utcnow().strftime('%Y-%m-%d')
        yesterday_str = (datetime.utcnow() - timedelta(days=1)).strftime('%Y-%m-%d')
        tomorrow_str = (datetime.utcnow() + timedelta(days=1)).strftime('%Y-%m-%d')
        
        appointments_data = [
            {'employee_id': e1, 'client_user_id': john_user_obj.id, 'client_name': 'John Doe', 'service': 'Classic Haircut', 'start_time': 9.0, 'duration': 0.75, 'reliability_score': 95, 'date': yesterday_str, 'status': 'completed'},
            {'employee_id': e1, 'client_user_id': client_user_obj.id, 'client_name': 'Jane Smith', 'service': 'Beard Trim', 'start_time': 10.5, 'duration': 0.33, 'reliability_score': 92, 'date': today_str, 'status': 'confirmed'},
            {'employee_id': e2, 'client_user_id': john_user_obj.id, 'client_name': 'Bob Johnson', 'service': 'Classic Haircut', 'start_time': 9.5, 'duration': 0.75, 'reliability_score': 85, 'date': yesterday_str, 'status': 'completed'},
            {'employee_id': e2, 'client_user_id': client_user_obj.id, 'client_name': 'Alice Brown', 'service': 'Hot Towel Shave', 'start_time': 11.0, 'duration': 0.5, 'reliability_score': 78, 'date': tomorrow_str, 'status': 'confirmed'},
            {'employee_id': e3, 'client_user_id': john_user_obj.id, 'client_name': 'Charlie Davis', 'service': 'Regular Cleaning', 'start_time': 10.0, 'duration': 1.0, 'reliability_score': 90, 'date': yesterday_str, 'status': 'completed'},
            {'employee_id': e3, 'client_user_id': client_user_obj.id, 'client_name': 'Diana Evans', 'service': 'Deep Cleaning', 'start_time': 13.0, 'duration': 1.5, 'reliability_score': 95, 'date': tomorrow_str, 'status': 'confirmed'},
        ]
        
        if not db.session.query(Appointment).first():
            for appt_data in appointments_data:
                emp_obj = db.session.query(Employee).get(appt_data['employee_id'])
                svc_obj = db.session.query(Service).filter_by(firm_id=emp_obj.firm_id, name=appt_data['service']).first()
                
                appt = Appointment(
                    employee_id=appt_data['employee_id'],
                    client_user_id=appt_data['client_user_id'],
                    client_name=appt_data['client_name'],
                    service=appt_data['service'],
                    start_time=appt_data['start_time'],
                    duration=appt_data['duration'],
                    reliability_score=appt_data['reliability_score'],
                    date=appt_data['date'],
                    status=appt_data['status']
                )
                if svc_obj:
                    appt.booked_services.append(svc_obj)
                db.session.add(appt)
            db.session.commit()
            
            # Seed some reviews for completed appointments
            completed_appts = db.session.query(Appointment).filter_by(status='completed').all()
            if not db.session.query(Review).first():
                for appt in completed_appts:
                    review = Review(
                        firm_id=appt.employee.firm_id,
                        employee_id=appt.employee_id,
                        client_user_id=appt.client_user_id,
                        appointment_id=appt.id,
                        rating=5 if appt.reliability_score >= 90 else 4,
                        text=f"Wonderful experience with {appt.employee.name} for {appt.service}!"
                    )
                    db.session.add(review)
                db.session.commit()
                
            # Seed employee unavailabilities
            if not db.session.query(EmployeeUnavailable).first():
                # Marcus is at lunch today at 12:00
                unavail = EmployeeUnavailable(
                    employee_id=e1,
                    date=today_str,
                    start_time=12.0,
                    duration=1.0,
                    reason="Lunch break"
                )
                db.session.add(unavail)
                # Jake is on vacation tomorrow
                unavail2 = EmployeeUnavailable(
                    employee_id=e2,
                    date=tomorrow_str,
                    start_time=9.0,
                    duration=8.0,
                    reason="Vacation day"
                )
                db.session.add(unavail2)
                db.session.commit()
        
        print("✓ Database initialized successfully with services, reviews, and operating hours.")

if __name__ == '__main__':
    from app import create_app
    app = create_app()
    init_db(app)
