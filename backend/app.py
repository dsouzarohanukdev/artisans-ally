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
import sib_api_v3_sdk
from sib_api_v3_sdk.rest import ApiException
from itsdangerous import URLSafeTimedSerializer, SignatureExpired, BadTimeSignature

# --- Step 1: Initialize extensions ---
db = SQLAlchemy()
migrate = Migrate()
bcrypt = Bcrypt()
login_manager = LoginManager()

# --- API Clients Setup ---
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
    currency = db.Column(db.String(3), nullable=False, default='GBP')
    reset_token = db.Column(db.String(100), unique=True, nullable=True)
    reset_token_expiry = db.Column(db.BigInteger, nullable=True)
    
    ebay_token = db.relationship('EbayToken', backref='user', uselist=False, cascade="all, delete-orphan")
    materials = db.relationship('Material', backref='owner', lazy=True, cascade="all, delete-orphan")
    products = db.relationship('Product', backref='owner', lazy=True, cascade="all, delete-orphan")

class Material(db.Model): id = db.Column(db.Integer, primary_key=True); name = db.Column(db.String(100), nullable=False); cost = db.Column(db.Float, nullable=False); quantity = db.Column(db.Float, nullable=False); unit = db.Column(db.String(20), nullable=False); user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
class Product(db.Model): id = db.Column(db.Integer, primary_key=True); name = db.Column(db.String(100), nullable=False); user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False); recipe = db.relationship('RecipeItem', backref='product', lazy=True, cascade="all, delete-orphan"); labour_hours = db.Column(db.Float, nullable=False, default=0); hourly_rate = db.Column(db.Float, nullable=False, default=0); profit_margin = db.Column(db.Float, nullable=False, default=100)
class RecipeItem(db.Model): id = db.Column(db.Integer, primary_key=True); quantity = db.Column(db.Float, nullable=False); product_id = db.Column(db.Integer, db.ForeignKey('product.id'), nullable=False); material_id = db.Column(db.Integer, db.ForeignKey('material.id'), nullable=False); material = db.relationship('Material')
class EbayToken(db.Model): id = db.Column(db.Integer, primary_key=True); refresh_token = db.Column(db.String(500), nullable=False); refresh_token_expiry = db.Column(db.BigInteger, nullable=False); user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)

# --- The App Factory Function ---
def create_app():
    app = Flask(__name__)
    
    dotenv_path = os.path.join(os.path.dirname(__file__), '.env')
    if os.path.exists(dotenv_path):
        load_dotenv(dotenv_path)

    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY')
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['SESSION_COOKIE_SAMESITE'] = 'None'
    app.config['SESSION_COOKIE_SECURE'] = True
        
    # --- UPGRADED: Database Configuration ---
    MYSQL_USER = os.environ.get('MYSQL_USER')
    MYSQL_PASSWORD = os.environ.get('MYSQL_PASSWORD')
    MYSQL_HOST = os.environ.get('MYSQL_HOST')
    MYSQL_DB = os.environ.get('MYSQL_DB')
    LIVE_DB_URL = f"mysql+pymysql://{MYSQL_USER}:{MYSQL_PASSWORD}@{MYSQL_HOST}/{MYSQL_DB}"
    app.config['SQLALCHEMY_DATABASE_URI'] = LIVE_DB_URL if MYSQL_USER else 'sqlite:///site.db'
    
    global EBAY_PROD_CLIENT_ID, EBAY_PROD_CLIENT_SECRET, EBAY_PROD_RUNAME, openai_client
    EBAY_PROD_CLIENT_ID = os.environ.get("EBAY_PROD_CLIENT_ID")
    EBAY_PROD_CLIENT_SECRET = os.environ.get("EBAY_PROD_CLIENT_SECRET")
    EBAY_PROD_RUNAME = os.environ.get("EBAY_PROD_RUNAME")
    openai_client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

    db.init_app(app)
    migrate.init_app(app, db)
    bcrypt.init_app(app)
    login_manager.init_app(app)
    
    CORS(app, resources={r"/api/*": {"origins": [
        "http://localhost:3000", 
        "https://artisans-ally-git-main-dsouzarohanukdev.vercel.app", 
        "https://freefileconverter.co.uk", 
        "https://www.freefileconverter.co.uk"
    ]}}, supports_credentials=True)

    with app.app_context():
        # --- (All helper functions are unchanged) ---
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
        
        def search_ebay_production(search_term, marketplace_id='EBAY_GB', category_id=None, exclude_item_id=None):
            token = get_ebay_app_oauth_token()
            if not token: return []
            url = "https://api.ebay.com/buy/browse/v1/item_summary/search"
            headers = {"Authorization": f"Bearer {token}", "X-EBAY-C-MARKETPLACE-ID": marketplace_id}
            params = {"q": search_term, "limit": 100}
            if category_id:
                params['category_ids'] = category_id; params['limit'] = 50
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
            payload = {
                "location": { "address": { "country": "GB" } },
                "name": "Primary dispatch location",
                "merchantLocationStatus": "ENABLED",
                "locationTypes": ["WAREHOUSE"]
            }
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
            user = User(email=data['email'], password=hashed_password, currency=data.get('currency', 'GBP'))
            db.session.add(user); db.session.commit(); login_user(user)
            return jsonify({"message": "User registered", "user": {"email": user.email, "currency": user.currency}}), 201
        
        @app.route('/api/login', methods=['POST'])
        def login():
            data = request.get_json()
            user = User.query.filter_by(email=data['email']).first()
            if user and bcrypt.check_password_hash(user.password, data['password']):
                login_user(user, remember=True)
                return jsonify({"message": "Logged in", "user": {"email": user.email, "currency": user.currency}}), 200
            return jsonify({"error": "Invalid credentials"}), 401

        @app.route('/api/logout', methods=['POST'])
        @login_required
        def logout():
            logout_user(); return jsonify({"message": "Logged out"}), 200

        @app.route('/api/check_session', methods=['GET'])
        def check_session():
            if current_user.is_authenticated:
                return jsonify({"logged_in": True, "user": {"email": current_user.email, "has_ebay_token": hasattr(current_user, 'ebay_token') and current_user.ebay_token is not None, "currency": current_user.currency}})
            return jsonify({"logged_in": False})
        
        @app.route('/api/user/settings', methods=['PUT'])
        @login_required
        def update_settings():
            data = request.get_json()
            if 'currency' in data:
                current_user.currency = data['currency']
                db.session.commit()
                return jsonify({"message": "Settings updated", "user": {"email": current_user.email, "currency": current_user.currency}}), 200
            return jsonify({"error": "No valid settings provided"}), 400
        
        # --- UPGRADED: FORGOT PASSWORD ENDPOINT (using Brevo API) ---
        @app.route('/api/forgot-password', methods=['POST'])
        def forgot_password():
            data = request.get_json()
            email = data.get('email')
            user = User.query.filter_by(email=email).first()
            
            if not user:
                return jsonify({"message": "If an account with this email exists, a reset link has been sent."}), 200

            try:
                s = URLSafeTimedSerializer(app.config['SECRET_KEY'])
                token = s.dumps(user.email, salt='password-reset-salt')
                
                user.reset_token = token
                user.reset_token_expiry = int(time.time()) + 3600 # 1 hour
                db.session.commit()

                reset_url = f"https://www.freefileconverter.co.uk/reset-password/{token}"
                
                # --- NEW Brevo API v3 Configuration ---
                configuration = sib_api_v3_sdk.Configuration()
                configuration.api_key['api-key'] = os.environ.get('BREVO_API_KEY') # <-- This is the correct key name

                api_instance = sib_api_v3_sdk.TransactionalEmailsApi(sib_api_v3_sdk.ApiClient(configuration))
                
                subject = "Password Reset Request for Artisan's Ally"
                html_content = f"""<html><body>
                    <p>Hello,</p>
                    <p>Someone (hopefully you) requested a password reset for your Artisan's Ally account.</p>
                    <p>If this was you, please click the link below to reset your password. The link is valid for 1 hour.</p>
                    <p><a href="{reset_url}">Click here to reset your password</a></p>
                    <p>If you did not request this, please ignore this email.</p>
                    <p>Thanks,<br/>The Artisan's Ally Team</p>
                    </body></html>
                    """
                # This 'sender' email must be one you have verified with Brevo
                sender = {"name":"Artisan's Ally","email":"noreply@freefileconverter.co.uk"}
                to = [{"email":user.email}]
                
                send_smtp_email = sib_api_v3_sdk.SendSmtpEmail(
                    to=to, 
                    html_content=html_content,
                    sender=sender, 
                    subject=subject
                )

                api_instance.send_transac_email(send_smtp_email)
                # --- End of Brevo Code ---
                
                return jsonify({"message": "If an account with this email exists, a reset link has been sent."}), 200

            except ApiException as e:
                print(f"!!! Brevo API Exception in forgot_password: {e}")
                return jsonify({"error": "An internal error occurred sending the email."}), 500
            except Exception as e:
                print(f"!!! Error in forgot_password: {e}")
                return jsonify({"error": "An internal error occurred."}), 500

        @app.route('/api/reset-password', methods=['POST'])
        def reset_password():
            data = request.get_json()
            token = data.get('token')
            new_password = data.get('password')
            
            if not token or not new_password:
                return jsonify({"error": "Invalid request."}), 400

            try:
                s = URLSafeTimedSerializer(app.config['SECRET_KEY'])
                email = s.loads(token, salt='password-reset-salt', max_age=3600)
                
                user = User.query.filter_by(email=email).first()
                
                if not user or user.reset_token != token or user.reset_token_expiry < int(time.time()):
                    return jsonify({"error": "The reset link is invalid or has expired."}), 400
                    
                user.password = bcrypt.generate_password_hash(new_password).decode('utf-8')
                user.reset_token = None
                user.reset_token_expiry = None
                db.session.commit()
                
                return jsonify({"message": "Password reset successfully. Please log in."}), 200
                
            except SignatureExpired:
                return jsonify({"error": "The reset link has expired."}), 400
            except BadTimeSignature:
                return jsonify({"error": "The reset link is invalid."}), 400
            except Exception as e:
                print(f"!!! Error in reset_password: {e}")
                return jsonify({"error": "An invalid or expired link was used."}), 400

        @app.route('/api/workshop', methods=['GET'])
        @login_required
        def get_workshop_data():
            user_materials = Material.query.filter_by(user_id=current_user.id).all()
            user_products = Product.query.filter_by(user_id=current_user.id).all()
            materials_data = [{'id': m.id, 'name': m.name, 'cost': m.cost, 'quantity': m.quantity, 'unit': m.unit} for m in user_materials]
            products_data = []
            materials_dict = {m.id: m for m in user_materials}
            for m in materials_data:
                m['cost_per_unit'] = round(m['cost'] / m['quantity'], 4) if m.get('quantity', 0) > 0 else 0
            for p in user_products:
                material_cost = 0
                for ri in p.recipe:
                    material = materials_dict.get(ri.material_id)
                    if material:
                        cost_per_unit = round(material.cost / material.quantity, 4) if material.quantity > 0 else 0
                        material_cost += cost_per_unit * ri.quantity
                
                material_cost = round(material_cost, 2)
                labour_cost = round(p.labour_hours * p.hourly_rate, 2)
                total_cost = material_cost + labour_cost
                suggested_price = round(total_cost * (1 + (p.profit_margin / 100)), 2)
                
                products_data.append({
                    'id': p.id, 'name': p.name,
                    'recipe': [{'material_id': ri.material_id, 'quantity': ri.quantity} for ri in p.recipe],
                    'labour_hours': p.labour_hours, 'hourly_rate': p.hourly_rate, 'profit_margin': p.profit_margin,
                    'material_cost': material_cost, 'labour_cost': labour_cost, 'total_cost': total_cost, 'suggested_price': suggested_price
                })
            return jsonify({"materials": materials_data, "products": products_data})

        @app.route('/api/materials', methods=['POST'])
        @login_required
        def add_material():
            data = request.get_json(); new_material = Material(name=data['name'], cost=float(data['cost']), quantity=float(data['quantity']), unit=data['unit'], owner=current_user)
            db.session.add(new_material); db.session.commit(); return jsonify({"message": "Material added"}), 201
        
        @app.route('/api/materials/<int:material_id>', methods=['PUT'])
        @login_required
        def update_material(material_id):
            material = Material.query.get_or_404(material_id)
            if material.user_id != current_user.id: return jsonify({"error": "Unauthorized"}), 403
            data = request.get_json()
            material.name = data['name']
            material.cost = float(data['cost'])
            material.quantity = float(data['quantity'])
            material.unit = data['unit']
            db.session.commit()
            return jsonify({"message": "Material updated"}), 200

        @app.route('/api/materials/<int:material_id>', methods=['DELETE'])
        @login_required
        def delete_material(material_id):
            material = Material.query.get_or_404(material_id)
            if material.user_id != current_user.id: return jsonify({"error": "Unauthorized"}), 403
            db.session.delete(material); db.session.commit(); return jsonify({"message": "Material deleted"}), 200
        
        @app.route('/api/products', methods=['POST'])
        @login_required
        def add_product():
            data = request.get_json()
            new_product = Product(
                name=data['name'], owner=current_user,
                labour_hours=float(data.get('labour_hours', 0)),
                hourly_rate=float(data.get('hourly_rate', 0)),
                profit_margin=float(data.get('profit_margin', 100))
            )
            db.session.add(new_product); db.session.commit() 
            for item in data['recipe']:
                recipe_item = RecipeItem(material_id=int(item['material_id']), quantity=float(item['quantity']), product_id=new_product.id)
                db.session.add(recipe_item)
            db.session.commit()
            return jsonify({"message": "Product added"}), 201
        
        @app.route('/api/products/<int:product_id>', methods=['PUT'])
        @login_required
        def update_product(product_id):
            product = Product.query.get_or_404(product_id)
            if product.user_id != current_user.id: return jsonify({"error": "Unauthorized"}), 403
            data = request.get_json()
            
            product.name = data['name']
            product.labour_hours = float(data.get('labour_hours', 0))
            product.hourly_rate = float(data.get('hourly_rate', 0))
            product.profit_margin = float(data.get('profit_margin', 100))
            
            RecipeItem.query.filter_by(product_id=product.id).delete()
            for item in data['recipe']:
                recipe_item = RecipeItem(material_id=int(item['material_id']), quantity=float(item['quantity']), product_id=product.id)
                db.session.add(recipe_item)
            
            db.session.commit()
            return jsonify({"message": "Product updated"}), 200

        @app.route('/api/products/<int:product_id>', methods=['DELETE'])
        @login_required
        def delete_product(product_id):
            product = Product.query.get_or_404(product_id)
            if product.user_id != current_user.id: return jsonify({"error": "Unauthorized"}), 403
            db.session.delete(product); db.session.commit(); return jsonify({"message": "Product deleted"}), 200
        
        @app.route("/api/analyse", methods=["GET"])
        def analyse_market():
            try: 
                material_cost = float(request.args.get('cost', 0))
                search_query = request.args.get('query', 'jesmonite tray')
                marketplace_id = request.args.get('marketplace', 'EBAY_GB')
            except (ValueError, TypeError): return jsonify({"error": "Invalid request parameters"}), 400
            
            etsy_listings = [] 
            ebay_listings = search_ebay_production(search_query, marketplace_id=marketplace_id)
            
            ebay_analysis = analyse_prices(ebay_listings)
            average_price = ebay_analysis['average_price'] if ebay_analysis['count'] > 0 else 0
            
            PLATFORM_FEE_PERCENTAGE, PLATFORM_FIXED_FEE, SHIPPING_COST = 0.10, 0.20, 3.20
            scenarios = []; pricing_tiers = {"The Budget Leader": average_price * 0.9, "The Competitor": average_price, "The Premium Brand": average_price * 1.15}
            for name, price in pricing_tiers.items():
                fees = (price * PLATFORM_FEE_PERCENTAGE) + PLATFORM_FIXED_FEE; profit = price - material_cost - fees - SHIPPING_COST
                scenarios.append({"name": name, "price": round(price, 2), "profit": round(profit, 2)})
            
            full_response = {
                "listings": {"etsy": [], "ebay": ebay_listings}, 
                "analysis": {"overall": ebay_analysis, "etsy": analyse_prices([]), "ebay": ebay_analysis}, 
                "profit_scenarios": scenarios
            }
            return jsonify(full_response)
        
        @app.route('/api/related-items/<item_id>', methods=['GET'])
        def get_related_items(item_id):
            token = get_ebay_app_oauth_token()
            if not token: return jsonify({"error": "Could not authenticate with eBay"}), 500
            try:
                marketplace_id = 'EBAY_GB' # Default to GB for now
                item_url = f"https://api.ebay.com/buy/browse/v1/item/{item_id}"
                headers = {"Authorization": f"Bearer {token}", "X-EBAY-C-MARKETPLACE-ID": marketplace_id}
                item_response = requests.get(item_url, headers=headers); item_response.raise_for_status()
                item_data = item_response.json()
                category_id = item_data.get('categoryPath', '').split('|')[0]
                original_title = item_data.get('title')
                if not category_id or not original_title: return jsonify({"listings": []})
                related_listings = search_ebay_production(search_term=original_title, marketplace_id=marketplace_id, category_id=category_id, exclude_item_id=item_id)
                return jsonify({"listings": related_listings})
            except Exception as e:
                print(f"An unexpected error occurred in get_related_items: {e}")
                return jsonify({"error": "An unexpected error occurred"}), 500
        
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
            # This must point to your VERCEL frontend URL
            live_frontend_url = "https://www.freefileconverter.co.uk"
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
                offer_url = f"https://api.ebay.com/sell/inventory/v1/offer"
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