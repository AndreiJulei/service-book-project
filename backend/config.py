import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    """Base configuration."""
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JSON_SORT_KEYS = False
    SECRET_KEY = os.getenv("SECRET_KEY", "super-secret-dev-key")
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'jwt-dev-fallback-key')
    JWT_ACCESS_TOKEN_EXPIRES = 900   # 15 minutes
    JWT_REFRESH_TOKEN_EXPIRES = 86400  # 24 hours
    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_pre_ping': True,
        'pool_recycle': 300,
    }
    UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'uploads')

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

class ProductionConfig(Config):
    """Production configuration - PostgreSQL via DATABASE_URL."""
    _uri = os.getenv("DATABASE_URL", "")
    # Render/Heroku use postgres:// but SQLAlchemy requires postgresql://
    if _uri.startswith("postgres://"):
        _uri = _uri.replace("postgres://", "postgresql://", 1)
    SQLALCHEMY_DATABASE_URI = _uri or DevelopmentConfig.SQLALCHEMY_DATABASE_URI

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

