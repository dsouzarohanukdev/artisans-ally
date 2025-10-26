import os
from flask import Flask
from dotenv import load_dotenv
from flask_cors import CORS
from openai import OpenAI
from .extensions import db, migrate, bcrypt, login_manager

# Import our new Blueprints
from .routes.auth import auth_bp
from .routes.workshop import workshop_bp
from .routes.api import api_bp, init_api_keys

def create_app():
    """
    Application factory function.
    """
    
    app = Flask(__name__)
    
    # Load .env file
    dotenv_path = os.path.join(os.path.dirname(app.root_path), '.env')
    if os.path.exists(dotenv_path):
        load_dotenv(dotenv_path)
    
    # --- Load Configuration ---
    # We use app.config.from_mapping to load defaults and then override with env vars
    app.config.from_mapping(
        SECRET_KEY=os.environ.get('SECRET_KEY', 'a_default_development_key'),
        SQLALCHEMY_TRACK_MODIFICATIONS=False,
        SESSION_COOKIE_SAMESITE='None',
        SESSION_COOKIE_SECURE=True,
        
        # Load keys from environment
        BREVO_API_KEY=os.environ.get('BREVO_API_KEY'),
        EBAY_PROD_CLIENT_ID=os.environ.get("EBAY_PROD_CLIENT_ID"),
        EBAY_PROD_CLIENT_SECRET=os.environ.get("EBAY_PROD_CLIENT_SECRET"),
        EBAY_PROD_RUNAME=os.environ.get("EBAY_PROD_RUNAME"),
        OPENAI_API_KEY=os.environ.get("OPENAI_API_KEY"),
        
        # This is the Vercel URL for production
        FRONTEND_URL=os.environ.get("FRONTEND_URL", "http://localhost:3000") 
    )

    # --- Database Configuration ---
    MYSQL_USER = os.environ.get('MYSQL_USER')
    MYSQL_PASSWORD = os.environ.get('MYSQL_PASSWORD')
    MYSQL_HOST = os.environ.get('MYSQL_HOST')
    MYSQL_DB = os.environ.get('MYSQL_DB')
    
    # Smartly switch between live MySQL and local SQLite
    if MYSQL_USER and MYSQL_PASSWORD and MYSQL_HOST and MYSQL_DB:
        LIVE_DB_URL = f"mysql+pymysql://{MYSQL_USER}:{MYSQL_PASSWORD}@{MYSQL_HOST}/{MYSQL_DB}"
        app.config['SQLALCHEMY_DATABASE_URI'] = LIVE_DB_URL
    else:
        # Use a local SQLite database if live credentials aren't set
        app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///site.db'

    # --- Initialize Extensions with the App ---
    db.init_app(app)
    migrate.init_app(app, db)
    bcrypt.init_app(app)
    login_manager.init_app(app)
    
    # --- Register Blueprints (Our "Departments") ---
    app.register_blueprint(auth_bp)
    app.register_blueprint(workshop_bp)
    app.register_blueprint(api_bp)

    # --- Initialize API keys for the api_routes blueprint ---
    with app.app_context():
        init_api_keys(app)

    # --- Configure CORS ---
    CORS(app, resources={r"/api/*": {"origins": [
        "http://localhost:3000", 
        "https://artisans-ally-git-main-dsouzarohanukdev.vercel.app", 
        "https://freefileconverter.co.uk", 
        "https://www.freefileconverter.co.uk"
    ]}}, supports_credentials=True)

    return app