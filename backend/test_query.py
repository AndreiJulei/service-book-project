from app import create_app
from models import db, User

app = create_app()
with app.app_context():
    try:
        username = 'admin@servicebook.local'
        user = db.session.query(User).filter(
            (User.username == username) | (User.email == username)
        ).first()
        print(user)
    except Exception as e:
        print(f"ERROR: {e}")
