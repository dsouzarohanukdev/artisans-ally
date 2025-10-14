import os
import statistics
import time
import json
from collections import Counter # THIS IS THE MISSING LINE THAT IS NOW RESTORED
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
from openai import OpenAI
import requests
import base64
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_bcrypt import Bcrypt
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user

# --- Initialization & Setup ---
app = Flask(__name__)
CORS(app, supports_credentials=True)
dotenv_path = os.path.join(os.path.dirname(__file__), '.env')
if os.path.exists(dotenv_path): load_dotenv(dotenv_path)

# --- App Configuration ---
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'a_default_secret_key_for_development_12345')
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///site.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# --- Extensions Initialization ---
db = SQLAlchemy(app)
migrate = Migrate(app, db)
bcrypt = Bcrypt(app)
login_manager = LoginManager(app)

# --- API Clients Setup ---
openai_client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
EBAY_PROD_CLIENT_ID = os.environ.get("EBAY_PROD_CLIENT_ID")
EBAY_PROD_CLIENT_SECRET = os.environ.get("EBAY_PROD_CLIENT_SECRET")
ETSY_API_KEY = os.environ.get("ETSY_API_KEY")
ebay_oauth_token = None
ebay_token_expiry = 0

# --- Database Models ---
@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

class User(db.Model, UserMixin):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(60), nullable=False)
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

class RecipeItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    quantity = db.Column(db.Float, nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('product.id'), nullable=False)
    material_id = db.Column(db.Integer, db.ForeignKey('material.id'), nullable=False)
    material = db.relationship('Material')

# --- User Authentication Endpoints ---
@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json()
    if User.query.filter_by(email=data['email']).first():
        return jsonify({"error": "Email already registered"}), 409
    hashed_password = bcrypt.generate_password_hash(data['password']).decode('utf-8')
    user = User(email=data['email'], password=hashed_password)
    db.session.add(user)
    db.session.commit()
    login_user(user)
    return jsonify({"message": "User registered and logged in", "user": {"email": user.email}}), 201

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    user = User.query.filter_by(email=data['email']).first()
    if user and bcrypt.check_password_hash(user.password, data['password']):
        login_user(user, remember=True)
        return jsonify({"message": "Logged in successfully", "user": {"email": user.email}}), 200
    return jsonify({"error": "Invalid credentials"}), 401

@app.route('/api/logout', methods=['POST'])
@login_required
def logout():
    logout_user()
    return jsonify({"message": "Logged out successfully"}), 200

@app.route('/api/check_session', methods=['GET'])
def check_session():
    if current_user.is_authenticated:
        return jsonify({"logged_in": True, "user": {"email": current_user.email}})
    return jsonify({"logged_in": False})

# --- SECURED Workshop Manager Endpoints ---
@app.route('/api/workshop', methods=['GET'])
@login_required
def get_workshop_data():
    user_materials = Material.query.filter_by(user_id=current_user.id).all()
    user_products = Product.query.filter_by(user_id=current_user.id).all()
    materials_data = [{'id': m.id, 'name': m.name, 'cost': m.cost, 'quantity': m.quantity, 'unit': m.unit} for m in user_materials]
    products_data = [{'id': p.id, 'name': p.name, 'recipe': [{'material_id': ri.material_id, 'quantity': ri.quantity} for ri in p.recipe]} for p in user_products]
    materials_dict = {m['id']: m for m in materials_data}
    for m in materials_data:
        m['cost_per_unit'] = round(m['cost'] / m['quantity'], 4) if m.get('quantity', 0) > 0 else 0
    for p in products_data:
        p['cogs'] = round(sum((materials_dict.get(ri['material_id'], {}).get('cost_per_unit', 0) * ri['quantity']) for ri in p['recipe']), 2)
    return jsonify({"materials": materials_data, "products": products_data})

@app.route('/api/materials', methods=['POST'])
@login_required
def add_material():
    data = request.get_json()
    new_material = Material(name=data['name'], cost=float(data['cost']), quantity=float(data['quantity']), unit=data['unit'], owner=current_user)
    db.session.add(new_material)
    db.session.commit()
    return jsonify({"message": "Material added"}), 201

@app.route('/api/materials/<int:material_id>', methods=['DELETE'])
@login_required
def delete_material(material_id):
    material = Material.query.get_or_404(material_id)
    if material.user_id != current_user.id: return jsonify({"error": "Unauthorized"}), 403
    db.session.delete(material)
    db.session.commit()
    return jsonify({"message": "Material deleted"}), 200

@app.route('/api/products', methods=['POST'])
@login_required
def add_product():
    data = request.get_json()
    new_product = Product(name=data['name'], owner=current_user)
    for item in data['recipe']:
        recipe_item = RecipeItem(material_id=int(item['material_id']), quantity=float(item['quantity']), product=new_product)
        db.session.add(recipe_item)
    db.session.add(new_product)
    db.session.commit()
    return jsonify({"message": "Product added"}), 201

@app.route('/api/products/<int:product_id>', methods=['DELETE'])
@login_required
def delete_product(product_id):
    product = Product.query.get_or_404(product_id)
    if product.user_id != current_user.id: return jsonify({"error": "Unauthorized"}), 403
    db.session.delete(product)
    db.session.commit()
    return jsonify({"message": "Product deleted"}), 200

# --- PUBLIC Market Analysis Endpoints ---
MOCK_ETSY_DATA = { "count": 3, "results": [ {"listing_id": 1, "title": "Handmade Terrazzo Coaster Set - Monochrome", "price": {"amount": 2200, "divisor": 100, "currency_code": "GBP"}, "tags": ["terrazzo coaster", "jesmonite", "handmade gift"]}, {"listing_id": 2, "title": "Minimalist Oval Jesmonite Tray - Sage Green", "price": {"amount": 2650, "divisor": 100, "currency_code": "GBP"}, "tags": ["jesmonite tray", "sage green decor", "jewellery dish"]}, {"listing_id": 3, "title": "Concrete Plant Pot - Industrial Style Decor", "price": {"amount": 1900, "divisor": 100, "currency_code": "GBP"}, "tags": ["concrete planter", "industrial decor", "succulent pot"]}, ]}

def get_ebay_oauth_token():
    global ebay_oauth_token, ebay_token_expiry
    if ebay_oauth_token and time.time() < ebay_token_expiry:
        return ebay_oauth_token
    url = "https://api.ebay.com/identity/v1/oauth2/token"
    credentials = f"{EBAY_PROD_CLIENT_ID}:{EBAY_PROD_CLIENT_SECRET}"
    base64_credentials = base64.b64encode(credentials.encode()).decode()
    headers = {"Content-Type": "application/x-www-form-urlencoded", "Authorization": f"Basic {base64_credentials}"}
    body = {"grant_type": "client_credentials", "scope": "https://api.ebay.com/oauth/api_scope"}
    try:
        response = requests.post(url, headers=headers, data=body); response.raise_for_status()
        data = response.json(); ebay_oauth_token = data['access_token']
        ebay_token_expiry = time.time() + (data['expires_in'] - 300)
        return ebay_oauth_token
    except requests.exceptions.RequestException: return None

def search_ebay_production(search_term):
    token = get_ebay_oauth_token()
    if not token: return []
    url = "https://api.ebay.com/buy/browse/v1/item_summary/search"; headers = {"Authorization": f"Bearer {token}", "X-EBAY-C-MARKETPLACE-ID": "EBAY_GB"}; params = {"q": search_term, "limit": 100}
    try:
        response = requests.get(url, headers=headers, params=params); response.raise_for_status()
        data = response.json(); normalized_results = []
        for item in data.get('itemSummaries', []):
            if 'price' in item and 'value' in item['price']:
                normalized_results.append({'listing_id': item['itemId'], 'title': item['title'], 'price': {'amount': int(float(item['price']['value']) * 100), 'divisor': 100, 'currency_code': item['price']['currency']}, 'source': 'eBay'})
        return normalized_results
    except: return []

def analyse_prices(item_list):
    if not item_list: return {"count": 0, "average_price": 0, "min_price": 0, "max_price": 0}
    prices = [(item['price']['amount'] / item['price']['divisor']) for item in item_list]
    return {"count": len(prices), "average_price": round(statistics.mean(prices), 2), "min_price": round(min(prices), 2), "max_price": round(max(prices), 2)}

@app.route("/api/analyse", methods=["GET"])
def analyse_market():
    try:
        material_cost = float(request.args.get('cost', 0)); search_query = request.args.get('query', 'jesmonite tray')
    except (ValueError, TypeError): return jsonify({"error": "Invalid request parameters"}), 400
    etsy_listings = MOCK_ETSY_DATA["results"]; 
    for listing in etsy_listings: listing['source'] = 'Etsy'
    ebay_listings = search_ebay_production(search_query)
    etsy_analysis = analyse_prices(etsy_listings); ebay_analysis = analyse_prices(ebay_listings); combined_analysis = analyse_prices(etsy_listings + ebay_listings)
    average_price = combined_analysis['average_price']
    PLATFORM_FEE_PERCENTAGE, PLATFORM_FIXED_FEE, SHIPPING_COST = 0.10, 0.20, 3.20
    scenarios = []; pricing_tiers = {"The Budget Leader": average_price * 0.9, "The Competitor": average_price, "The Premium Brand": average_price * 1.15}
    for name, price in pricing_tiers.items():
        fees = (price * PLATFORM_FEE_PERCENTAGE) + PLATFORM_FIXED_FEE; profit = price - material_cost - fees - SHIPPING_COST
        scenarios.append({"name": name, "price": round(price, 2), "profit": round(profit, 2)})
    all_tags = [tag for item in etsy_listings if item.get("tags") for tag in item["tags"]]
    top_keywords = [tag for tag, count in Counter(all_tags).most_common(10)]
    full_response = {"listings": {"etsy": etsy_listings, "ebay": ebay_listings}, "analysis": {"overall": combined_analysis, "etsy": etsy_analysis, "ebay": ebay_analysis}, "profit_scenarios": scenarios, "seo_analysis": {"top_keywords": top_keywords}}
    return jsonify(full_response)

if __name__ == "__main__":
    app.run(debug=True)