from flask_login import UserMixin
from .extensions import db, login_manager

# --- Database Models ---
@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

class User(db.Model, UserMixin):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(60), nullable=False)
    currency = db.Column(db.String(3), nullable=False, default='GBP')
    reset_token = db.Column(db.String(100), unique=True, nullable=True)
    reset_token_expiry = db.Column(db.BigInteger, nullable=True)
    email_confirmed = db.Column(db.Boolean, nullable=False, default=False)
    
    ebay_token = db.relationship('EbayToken', backref='user', uselist=False, cascade="all, delete-orphan")
    materials = db.relationship('Material', backref='owner', lazy=True, cascade="all, delete-orphan")
    products = db.relationship('Product', backref='owner', lazy=True, cascade="all, delete-orphan")

class Material(db.Model): 
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    cost = db.Column(db.Float, nullable=False)
    quantity = db.Column(db.Float, nullable=False)
    unit = db.Column(db.String(20), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)

class Product(db.Model): 
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    recipe = db.relationship('RecipeItem', backref='product', lazy=True, cascade="all, delete-orphan")
    labour_hours = db.Column(db.Float, nullable=False, default=0)
    hourly_rate = db.Column(db.Float, nullable=False, default=0)
    profit_margin = db.Column(db.Float, nullable=False, default=100)

class RecipeItem(db.Model): 
    id = db.Column(db.Integer, primary_key=True)
    quantity = db.Column(db.Float, nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('product.id'), nullable=False)
    material_id = db.Column(db.Integer, db.ForeignKey('material.id'), nullable=False)
    material = db.relationship('Material')

class EbayToken(db.Model): 
    id = db.Column(db.Integer, primary_key=True)
    refresh_token = db.Column(db.String(500), nullable=False)
    refresh_token_expiry = db.Column(db.BigInteger, nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)