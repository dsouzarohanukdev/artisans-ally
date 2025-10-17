import os
import statistics
import time
import json
from collections import Counter
from dotenv import load_dotenv
from flask import Flask, jsonify, request, redirect
from flask_cors import CORS
from openai import OpenAI
import requests
import base64
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_bcrypt import Bcrypt
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user

# --- Step 1: Initialize extensions without an app instance ---
db = SQLAlchemy()
migrate = Migrate()
bcrypt = Bcrypt()
login_manager = LoginManager()

# --- API Clients Setup (will be loaded by create_app) ---
EBAY_PROD_CLIENT_ID = None
EBAY_PROD_CLIENT_SECRET = None
EBAY_PROD_RUNAME = None
openai_client = None
ebay_app_oauth_token = None
ebay_app_token_expiry = 0

# --- Database Models ---
@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

class User(db.Model, UserMixin):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(60), nullable=False)
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

# --- The App Factory Function ---
def create_app():
    app = Flask(__name__)
    
    dotenv_path = os.path.join(os.path.dirname(__file__), '.env')
    if os.path.exists(dotenv_path):
        load_dotenv(dotenv_path)

    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'a_default_secret_key_for_development_12345')
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///site.db'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['SESSION_COOKIE_SAMESITE'] = 'None'
    app.config['SESSION_COOKIE_SECURE'] = True
    
    # Initialize globals inside the factory
    global EBAY_PROD_CLIENT_ID, EBAY_PROD_CLIENT_SECRET, EBAY_PROD_RUNAME, openai_client
    EBAY_PROD_CLIENT_ID = os.environ.get("EBAY_PROD_CLIENT_ID")
    EBAY_PROD_CLIENT_SECRET = os.environ.get("EBAY_PROD_CLIENT_SECRET")
    EBAY_PROD_RUNAME = os.environ.get("EBAY_PROD_RUNAME")
    openai_client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

    # Step 2: Initialize extensions with the app instance
    db.init_app(app)
    migrate.init_app(app, db)
    bcrypt.init_app(app)
    login_manager.init_app(app)
    
    CORS(app, resources={r"/api/*": {"origins": ["http://localhost:3000", "https://freefileconverter.co.uk"]}}, supports_credentials=True)

    # All routes must be defined inside the app context
    with app.app_context():
        # --- Helper Functions (defined inside context) ---
        def get_ebay_app_oauth_token():
            global ebay_app_oauth_token, ebay_app_token_expiry
            if ebay_app_oauth_token and time.time() < ebay_app_token_expiry: return ebay_app_oauth_token
            url = "https://api.ebay.com/identity/v1/oauth2/token"
            credentials = f"{EBAY_PROD_CLIENT_ID}:{EBAY_PROD_CLIENT_SECRET}"
            base64_credentials = base64.b64encode(credentials.encode()).decode()
            headers = {"Content-Type": "application/x-www-form-urlencoded", "Authorization": f"Basic {base64_credentials}"}
            body = {"grant_type": "client_credentials", "scope": "https://api.ebay.com/oauth/api_scope"}
            try:
                response = requests.post(url, headers=headers, data=body); response.raise_for_status()
                data = response.json(); ebay_app_oauth_token = data['access_token']
                ebay_app_token_expiry = time.time() + (data['expires_in'] - 300)
                return ebay_app_oauth_token
            except: return None

        def search_ebay_production(search_term, category_id=None, exclude_item_id=None):
            token = get_ebay_app_oauth_token()
            if not token: return []
            url = "https://api.ebay.com/buy/browse/v1/item_summary/search"; headers = {"Authorization": f"Bearer {token}", "X-EBAY-C-MARKETPLACE-ID": "EBAY_GB"}; 
            params = {"q": search_term, "limit": 100}
            if category_id:
                params['category_ids'] = category_id
                params['limit'] = 50
            if exclude_item_id:
                params['filter'] = f"itemId:-{{{exclude_item_id}}}"
            try:
                response = requests.get(url, headers=headers, params=params); response.raise_for_status()
                data = response.json(); normalized_results = []
                for item in data.get('itemSummaries', []):
                    if 'price' in item and 'value' in item['price']:
                        normalized_results.append({'listing_id': item['itemId'], 'title': item['title'], 'price': {'amount': int(float(item['price']['value']) * 100), 'divisor': 100, 'currency_code': item['price']['currency']}, 'source': 'eBay'})
                return normalized_results
            except Exception as e: 
                print(f"!!! eBay Browse API Error: {e}"); return []

        def analyse_prices(item_list):
            if not item_list: return {"count": 0, "average_price": 0, "min_price": 0, "max_price": 0}
            prices = [(item['price']['amount'] / item['price']['divisor']) for item in item_list]
            return {"count": len(prices), "average_price": round(statistics.mean(prices), 2), "min_price": round(min(prices), 2), "max_price": round(max(prices), 2)}
        
        def get_ebay_user_access_token(user):
            if not user.ebay_token: return None
            url = "https://api.ebay.com/identity/v1/oauth2/token"
            credentials = f"{EBAY_PROD_CLIENT_ID}:{EBAY_PROD_CLIENT_SECRET}"
            base64_credentials = base64.b64encode(credentials.encode()).decode()
            headers = { "Content-Type": "application/x-www-form-urlencoded", "Authorization": f"Basic {base64_credentials}" }
            body = { "grant_type": "refresh_token", "refresh_token": user.ebay_token.refresh_token, "scope": "https://api.ebay.com/oauth/api_scope/sell.inventory" }
            try:
                response = requests.post(url, headers=headers, data=body); response.raise_for_status()
                data = response.json()
                return data['access_token']
            except Exception as e:
                print(f"!!! Could not refresh eBay user access token: {e}"); return None
        
        def ensure_merchant_location(user_access_token, location_key="ALLY_DEFAULT"):
            headers = {"Authorization": f"Bearer {user_access_token}", "Content-Type": "application/json", "Accept": "application/json"}
            check_url = f"https://api.ebay.com/sell/inventory/v1/location/{location_key}"
            check_response = requests.get(check_url, headers=headers)
            if check_response.status_code == 200:
                print(f"✅ Inventory location '{location_key}' already exists.")
                return True
            
            print(f"⚙️ Creating new inventory location '{location_key}'...")
            create_url = f"https://api.ebay.com/sell/inventory/v1/location/{location_key}"
            
            # This is the new, more complete payload that will be accepted.
            payload = {
                "location": {
                    "address": {
                        "addressLine1": "Apartment 705, West One Panorama",
                        "addressLine2": "18 Fitzwilliam Street",
                        "city": "Sheffield",
                        "stateOrProvince": "South Yorkshire",
                        "postalCode": "S1 4JQ",
                        "country": "GB"
                    }
                },
                "name": "Primary Dispatch Location",
                "merchantLocationStatus": "ENABLED",
                "locationTypes": ["WAREHOUSE"]
            }
            
            # The method for creating a location is POST.
            create_response = requests.post(create_url, headers=headers, json=payload)
            
            if create_response.status_code in [200, 201, 204]:
                print(f"✅ Inventory location '{location_key}' created successfully.")
                return True
            else:
                print(f"❌ Failed to create inventory location: {create_response.text}")
                return False

        # --- Endpoint Definitions ---
        @app.route('/api/register', methods=['POST'])
        def register():
            data = request.get_json()
            if User.query.filter_by(email=data['email']).first(): return jsonify({"error": "Email already registered"}), 409
            hashed_password = bcrypt.generate_password_hash(data['password']).decode('utf-8')
            user = User(email=data['email'], password=hashed_password)
            db.session.add(user); db.session.commit(); login_user(user)
            return jsonify({"message": "User registered", "user": {"email": user.email}}), 201
        @app.route('/api/login', methods=['POST'])
        def login():
            data = request.get_json()
            user = User.query.filter_by(email=data['email']).first()
            if user and bcrypt.check_password_hash(user.password, data['password']):
                login_user(user, remember=True)
                return jsonify({"message": "Logged in", "user": {"email": user.email}}), 200
            return jsonify({"error": "Invalid credentials"}), 401
        @app.route('/api/logout', methods=['POST'])
        @login_required
        def logout():
            logout_user(); return jsonify({"message": "Logged out"}), 200
        @app.route('/api/check_session', methods=['GET'])
        def check_session():
            if current_user.is_authenticated:
                return jsonify({"logged_in": True, "user": {"email": current_user.email, "has_ebay_token": hasattr(current_user, 'ebay_token') and current_user.ebay_token is not None}})
            return jsonify({"logged_in": False})
        
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
            data = request.get_json(); new_material = Material(name=data['name'], cost=float(data['cost']), quantity=float(data['quantity']), unit=data['unit'], owner=current_user)
            db.session.add(new_material); db.session.commit(); return jsonify({"message": "Material added"}), 201
        
        @app.route('/api/materials/<int:material_id>', methods=['DELETE'])
        @login_required
        def delete_material(material_id):
            material = Material.query.get_or_404(material_id)
            if material.user_id != current_user.id: return jsonify({"error": "Unauthorized"}), 403
            db.session.delete(material); db.session.commit(); return jsonify({"message": "Material deleted"}), 200
        
        @app.route('/api/products', methods=['POST'])
        @login_required
        def add_product():
            data = request.get_json(); new_product = Product(name=data['name'], owner=current_user)
            for item in data['recipe']:
                recipe_item = RecipeItem(material_id=int(item['material_id']), quantity=float(item['quantity']), product=new_product)
                db.session.add(recipe_item)
            db.session.add(new_product); db.session.commit(); return jsonify({"message": "Product added"}), 201

        @app.route('/api/products/<int:product_id>', methods=['DELETE'])
        @login_required
        def delete_product(product_id):
            product = Product.query.get_or_404(product_id)
            if product.user_id != current_user.id: return jsonify({"error": "Unauthorized"}), 403
            db.session.delete(product); db.session.commit(); return jsonify({"message": "Product deleted"}), 200
        
        @app.route("/api/analyse", methods=["GET"])
        def analyse_market():
            try: material_cost = float(request.args.get('cost', 0)); search_query = request.args.get('query', 'jesmonite tray')
            except (ValueError, TypeError): return jsonify({"error": "Invalid request parameters"}), 400
            etsy_listings = []
            ebay_listings = search_ebay_production(search_query)
            etsy_analysis = analyse_prices(etsy_listings); ebay_analysis = analyse_prices(ebay_listings); combined_analysis = analyse_prices(etsy_listings + ebay_listings)
            average_price = combined_analysis['average_price']
            PLATFORM_FEE_PERCENTAGE, PLATFORM_FIXED_FEE, SHIPPING_COST = 0.10, 0.20, 3.20
            scenarios = []; pricing_tiers = {"The Budget Leader": average_price * 0.9, "The Competitor": average_price, "The Premium Brand": average_price * 1.15}
            for name, price in pricing_tiers.items():
                fees = (price * PLATFORM_FEE_PERCENTAGE) + PLATFORM_FIXED_FEE; profit = price - material_cost - fees - SHIPPING_COST
                scenarios.append({"name": name, "price": round(price, 2), "profit": round(profit, 2)})
            full_response = {"listings": {"etsy": etsy_listings, "ebay": ebay_listings}, "analysis": {"overall": combined_analysis, "etsy": etsy_analysis, "ebay": ebay_analysis}, "profit_scenarios": scenarios}
            return jsonify(full_response)
        
        @app.route('/api/related-items/<item_id>', methods=['GET'])
        def get_related_items(item_id):
            return jsonify({"listings": []})
        
        @app.route('/api/ebay/get-auth-url', methods=['GET'])
        @login_required
        def get_ebay_auth_url():
            base_url = "https://auth.ebay.com/oauth2/authorize"
            scope = "https://api.ebay.com/oauth/api_scope/sell.inventory"
            state = str(current_user.id) 
            auth_url = (f"{base_url}?client_id={EBAY_PROD_CLIENT_ID}&response_type=code"
                        f"&redirect_uri={EBAY_PROD_RUNAME}&scope={scope}&state={state}")
            return jsonify({"auth_url": auth_url})
        
        @app.route('/api/ebay/callback', methods=['GET'])
        def ebay_callback():
            auth_code = request.args.get('code'); user_id = request.args.get('state')
            live_frontend_url = "https://freefileconverter.co.uk"
            if not auth_code or not user_id: return redirect(f'{live_frontend_url}/publisher?error=true')
            url = "https://api.ebay.com/identity/v1/oauth2/token"
            credentials = f"{EBAY_PROD_CLIENT_ID}:{EBAY_PROD_CLIENT_SECRET}"
            base64_credentials = base64.b64encode(credentials.encode()).decode()
            headers = {"Content-Type": "application/x-www-form-urlencoded", "Authorization": f"Basic {base64_credentials}"}
            body = {"grant_type": "authorization_code", "code": auth_code, "redirect_uri": EBAY_PROD_RUNAME}
            try:
                response = requests.post(url, headers=headers, data=body); response.raise_for_status()
                data = response.json()
                user = User.query.get(int(user_id))
                if user:
                    if not user.ebay_token: user.ebay_token = EbayToken(user_id=user.id)
                    user.ebay_token.refresh_token = data['refresh_token']
                    user.ebay_token.refresh_token_expiry = time.time() + data['refresh_token_expires_in']
                    db.session.commit()
                    return redirect(f'{live_frontend_url}/publisher?success=true')
            except Exception as e:
                print(f"!!! Error exchanging eBay auth code: {e}")
            return redirect(f'{live_frontend_url}/publisher?error=true')

        @app.route('/api/ebay/create-draft', methods=['POST'])
        @login_required
        def create_ebay_draft():
            data = request.get_json()
            title = data.get('title'); description = data.get('description'); price = data.get('price')
            user_access_token = get_ebay_user_access_token(current_user)
            if not user_access_token:
                return jsonify({"error": "Could not authenticate with eBay. Please reconnect your account."}), 500
            
            if not ensure_merchant_location(user_access_token):
                return jsonify({"error": "Could not verify or create your eBay inventory location."}), 500
                
            sku = f"ALLY-{int(time.time())}"
            inventory_url = f"https://api.ebay.com/sell/inventory/v1/inventory_item/{sku}"
            inventory_headers = {"Authorization": f"Bearer {user_access_token}", "Content-Type": "application/json", "Content-Language": "en-GB"}
            inventory_payload = {"product": { "title": title, "description": description }, "condition": "NEW", "packageWeightAndSize": {"dimensions": { "height": 10, "length": 10, "width": 10, "unit": "CENTIMETER" }, "weight": { "value": 250, "unit": "GRAM" }}, "availability": { "shipToLocationAvailability": { "quantity": 1 } }}
            response = None 
            try:
                response = requests.put(inventory_url, headers=inventory_headers, json=inventory_payload)
                response.raise_for_status()
                offer_url = "https://api.ebay.com/sell/inventory/v1/offer"
                offer_payload = {"sku": sku, "marketplaceId": "EBAY_GB", "format": "FIXED_PRICE", "listingDescription": description, "availableQuantity": 1, "pricingSummary": {"price": { "value": str(price), "currency": "GBP" }}, "listingPolicies": {"fulfillmentPolicyId": "375545969023", "paymentPolicyId": "375545763023", "returnPolicyId": "375545771023"}, "categoryId": "11700", "merchantLocationKey": "ALLY_DEFAULT"}
                response = requests.post(offer_url, headers=inventory_headers, json=offer_payload)
                response.raise_for_status()
                offer_data = response.json()
                return jsonify({"message": "Successfully created a draft offer on eBay!", "offerId": offer_data.get('offerId')}), 201
            except requests.exceptions.HTTPError as e:
                error_details = "No details provided."
                try: error_details = e.response.json()
                except: error_details = e.response.text
                print(f"!!! HTTP Error creating eBay draft: {e}"); print(f"--- eBay Full Error Response: {error_details} ---")
                return jsonify({"error": "Failed to create draft on eBay.", "details": error_details}), 500
            except Exception as e:
                print(f"!!! An unexpected error occurred creating eBay draft: {e}")
                return jsonify({"error": "An unknown error occurred"}), 500

    return app

app = create_app()

if __name__ == '__main__':
    app.run(debug=True)