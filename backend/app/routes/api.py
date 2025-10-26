import os
import statistics
import time
import base64
from flask import jsonify, request, redirect, current_app, Blueprint
from flask_login import login_required, current_user
import requests
from ..extensions import db
from ..models import User, EbayToken

# --- API Clients & Globals ---
# These will be initialized by the app factory
EBAY_PROD_CLIENT_ID = None
EBAY_PROD_CLIENT_SECRET = None
EBAY_PROD_RUNAME = None
ebay_app_oauth_token = None
ebay_app_token_expiry = 0

# Create a Blueprint for our external API routes
api_bp = Blueprint('api_bp', __name__)

# --- Helper Functions ---
# This function will be called by the app factory to load the keys
def init_api_keys(app):
    """Initializes API keys from the app's config."""
    global EBAY_PROD_CLIENT_ID, EBAY_PROD_CLIENT_SECRET, EBAY_PROD_RUNAME
    EBAY_PROD_CLIENT_ID = app.config.get("EBAY_PROD_CLIENT_ID")
    EBAY_PROD_CLIENT_SECRET = app.config.get("EBAY_PROD_CLIENT_SECRET")
    EBAY_PROD_RUNAME = app.config.get("EBAY_PROD_RUNAME")

def get_ebay_app_oauth_token():
    global ebay_app_oauth_token, ebay_app_token_expiry, EBAY_PROD_CLIENT_ID, EBAY_PROD_CLIENT_SECRET
    
    if ebay_app_oauth_token and time.time() < ebay_app_token_expiry: 
        return ebay_app_oauth_token
    
    url = "https://api.ebay.com/identity/v1/oauth2/token"
    credentials = f"{EBAY_PROD_CLIENT_ID}:{EBAY_PROD_CLIENT_SECRET}"
    base64_credentials = base64.b64encode(credentials.encode()).decode()
    headers = {"Content-Type": "application/x-www-form-urlencoded", "Authorization": f"Basic {base64_credentials}"}
    body = {"grant_type": "client_credentials", "scope": "https://api.ebay.com/oauth/api_scope"}
    
    try:
        response = requests.post(url, headers=headers, data=body)
        response.raise_for_status()
        data = response.json()
        ebay_app_oauth_token = data['access_token']
        ebay_app_token_expiry = time.time() + (data['expires_in'] - 300)
        return ebay_app_oauth_token
    except Exception as e:
        print(f"!!! Error getting eBay App token: {e}")
        return None

def search_ebay_production(search_term, marketplace_id='EBAY_GB', category_id=None, exclude_item_id=None):
    token = get_ebay_app_oauth_token()
    if not token: 
        return []
    
    url = "https://api.ebay.com/buy/browse/v1/item_summary/search"
    headers = {"Authorization": f"Bearer {token}", "X-EBAY-C-MARKETPLACE-ID": marketplace_id}
    params = {"q": search_term, "limit": 100}
    if category_id:
        params['category_ids'] = category_id
        params['limit'] = 50
    if exclude_item_id:
        params['filter'] = f"itemId:-{{{exclude_item_id}}}"
        
    try:
        response = requests.get(url, headers=headers, params=params)
        response.raise_for_status()
        data = response.json()
        normalized_results = []
        for item in data.get('itemSummaries', []):
            if 'price' in item and 'value' in item['price']:
                normalized_results.append({
                    'listing_id': item['itemId'], 
                    'title': item['title'], 
                    'price': {
                        'amount': int(float(item['price']['value']) * 100), 
                        'divisor': 100, 
                        'currency_code': item['price']['currency']
                    }, 
                    'source': 'eBay'
                })
        return normalized_results
    except Exception as e: 
        print(f"!!! eBay Browse API Error: {e}")
        return []

def analyse_prices(item_list):
    if not item_list: 
        return {"count": 0, "average_price": 0, "min_price": 0, "max_price": 0}
    prices = [(item['price']['amount'] / item['price']['divisor']) for item in item_list]
    return {
        "count": len(prices), 
        "average_price": round(statistics.mean(prices), 2), 
        "min_price": round(min(prices), 2), 
        "max_price": round(max(prices), 2)
    }

def get_ebay_user_access_token(user):
    if not user.ebay_token: 
        return None
    
    url = "https://api.ebay.com/identity/v1/oauth2/token"
    credentials = f"{EBAY_PROD_CLIENT_ID}:{EBAY_PROD_CLIENT_SECRET}"
    base64_credentials = base64.b64encode(credentials.encode()).decode()
    headers = { "Content-Type": "application/x-www-form-urlencoded", "Authorization": f"Basic {base64_credentials}" }
    body = { 
        "grant_type": "refresh_token", 
        "refresh_token": user.ebay_token.refresh_token, 
        "scope": "https://api.ebay.com/oauth/api_scope/sell.inventory" 
    }
    try:
        response = requests.post(url, headers=headers, data=body)
        response.raise_for_status()
        data = response.json()
        return data['access_token']
    except Exception as e:
        print(f"!!! Could not refresh eBay user access token: {e}")
        return None

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
        "location": { "address": { "country": "GB" } }, # Simple address, eBay will ask user to fill it out later
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

# --- API Endpoint Definitions ---

@api_bp.route("/api/analyse", methods=["GET"])
def analyse_market():
    try: 
        material_cost = float(request.args.get('cost', 0))
        search_query = request.args.get('query', 'jesmonite tray')
        marketplace_id = request.args.get('marketplace', 'EBAY_GB')
    except (ValueError, TypeError): 
        return jsonify({"error": "Invalid request parameters"}), 400
    
    ebay_listings = search_ebay_production(search_query, marketplace_id=marketplace_id)
    ebay_analysis = analyse_prices(ebay_listings)
    average_price = ebay_analysis['average_price'] if ebay_analysis['count'] > 0 else 0
    
    PLATFORM_FEE_PERCENTAGE, PLATFORM_FIXED_FEE, SHIPPING_COST = 0.10, 0.20, 3.20 # This might need to be dynamic later
    scenarios = []
    pricing_tiers = {
        "The Budget Leader": average_price * 0.9, 
        "The Competitor": average_price, 
        "The Premium Brand": average_price * 1.15
    }
    
    for name, price in pricing_tiers.items():
        fees = (price * PLATFORM_FEE_PERCENTAGE) + PLATFORM_FIXED_FEE
        profit = price - material_cost - fees - SHIPPING_COST
        scenarios.append({"name": name, "price": round(price, 2), "profit": round(profit, 2)})
    
    full_response = {
        "listings": {"etsy": [], "ebay": ebay_listings}, 
        "analysis": {"overall": ebay_analysis, "etsy": analyse_prices([]), "ebay": ebay_analysis}, 
        "profit_scenarios": scenarios
    }
    return jsonify(full_response)

@api_bp.route('/api/related-items/<item_id>', methods=['GET'])
def get_related_items(item_id):
    token = get_ebay_app_oauth_token()
    if not token: 
        return jsonify({"error": "Could not authenticate with eBay"}), 500
    
    try:
        marketplace_id = 'EBAY_GB' # Default to GB for now
        item_url = f"https://api.ebay.com/buy/browse/v1/item/{item_id}"
        headers = {"Authorization": f"Bearer {token}", "X-EBAY-C-MARKETPLACE-ID": marketplace_id}
        
        item_response = requests.get(item_url, headers=headers)
        item_response.raise_for_status()
        item_data = item_response.json()
        
        category_id = item_data.get('categoryPath', '').split('|')[0]
        original_title = item_data.get('title')
        
        if not category_id or not original_title: 
            return jsonify({"listings": []})
            
        related_listings = search_ebay_production(
            search_term=original_title, 
            marketplace_id=marketplace_id, 
            category_id=category_id, 
            exclude_item_id=item_id
        )
        return jsonify({"listings": related_listings})
    except Exception as e:
        print(f"An unexpected error occurred in get_related_items: {e}")
        return jsonify({"error": "An unexpected error occurred"}), 500

@api_bp.route('/api/ebay/get-auth-url', methods=['GET'])
@login_required
def get_ebay_auth_url():
    base_url = "https://auth.ebay.com/oauth2/authorize"
    scope = "https://api.ebay.com/oauth/api_scope/sell.inventory"
    state = str(current_user.id) 
    auth_url = (f"{base_url}?client_id={EBAY_PROD_CLIENT_ID}&response_type=code"
                f"&redirect_uri={EBAY_PROD_RUNAME}&scope={scope}&state={state}")
    return jsonify({"auth_url": auth_url})

@api_bp.route('/api/ebay/callback', methods=['GET'])
def ebay_callback():
    auth_code = request.args.get('code')
    user_id = request.args.get('state')
    
    # This must point to your VERCEL frontend URL
    live_frontend_url = current_app.config.get('FRONTEND_URL', 'http://localhost:3000')
    
    if not auth_code or not user_id: 
        return redirect(f'{live_frontend_url}/publisher?error=true')
    
    url = "https://api.ebay.com/identity/v1/oauth2/token"
    credentials = f"{EBAY_PROD_CLIENT_ID}:{EBAY_PROD_CLIENT_SECRET}"
    base64_credentials = base64.b64encode(credentials.encode()).decode()
    headers = {"Content-Type": "application/x-www-form-urlencoded", "Authorization": f"Basic {base64_credentials}"}
    body = {"grant_type": "authorization_code", "code": auth_code, "redirect_uri": EBAY_PROD_RUNAME}
    
    try:
        response = requests.post(url, headers=headers, data=body)
        response.raise_for_status()
        data = response.json()
        
        user = User.query.get(int(user_id))
        if user:
            if not user.ebay_token: 
                user.ebay_token = EbayToken(user_id=user.id)
            user.ebay_token.refresh_token = data['refresh_token']
            user.ebay_token.refresh_token_expiry = time.time() + data['refresh_token_expires_in']
            db.session.commit()
            return redirect(f'{live_frontend_url}/publisher?success=true')
            
    except Exception as e:
        print(f"!!! Error exchanging eBay auth code: {e}")
        
    return redirect(f'{live_frontend_url}/publisher?error=true')

@api_bp.route('/api/ebay/create-draft', methods=['POST'])
@login_required
def create_ebay_draft():
    data = request.get_json()
    title = data.get('title')
    description = data.get('description')
    price = data.get('price')
    
    user_access_token = get_ebay_user_access_token(current_user)
    if not user_access_token:
        return jsonify({"error": "Could not authenticate with eBay. Please reconnect your account."}), 500
    
    if not ensure_merchant_location(user_access_token):
        return jsonify({"error": "Could not verify or create your eBay inventory location."}), 500
        
    sku = f"ALLY-{int(time.time())}"
    inventory_url = f"https://api.ebay.com/sell/inventory/v1/inventory_item/{sku}"
    inventory_headers = {"Authorization": f"Bearer {user_access_token}", "Content-Type": "application/json", "Content-Language": "en-GB"}
    inventory_payload = {
        "product": { "title": title, "description": description }, 
        "condition": "NEW", 
        "packageWeightAndSize": {
            "dimensions": { "height": 10, "length": 10, "width": 10, "unit": "CENTIMETER" }, 
            "weight": { "value": 250, "unit": "GRAM" }
        }, 
        "availability": { "shipToLocationAvailability": { "quantity": 1 } }
    }
    
    response = None 
    try:
        response = requests.put(inventory_url, headers=inventory_headers, json=inventory_payload)
        response.raise_for_status()
        
        offer_url = f"https://api.ebay.com/sell/inventory/v1/offer"
        offer_payload = {
            "sku": sku, 
            "marketplaceId": "EBAY_GB", 
            "format": "FIXED_PRICE", 
            "listingDescription": description, 
            "availableQuantity": 1, 
            "pricingSummary": {"price": { "value": str(price), "currency": "GBP" }}, 
            "listingPolicies": {
                "fulfillmentPolicyId": "375545969023", 
                "paymentPolicyId": "375545763023", 
                "returnPolicyId": "375545771023"
            }, 
            "categoryId": "11700", 
            "merchantLocationKey": "ALLY_DEFAULT"
        }
        response = requests.post(offer_url, headers=inventory_headers, json=offer_payload)
        response.raise_for_status()
        
        offer_data = response.json()
        return jsonify({"message": "Successfully created a draft offer on eBay!", "offerId": offer_data.get('offerId')}), 201
        
    except requests.exceptions.HTTPError as e:
        error_details = "No details provided."
        try: 
            error_details = e.response.json()
        except: 
            error_details = e.response.text
        print(f"!!! HTTP Error creating eBay draft: {e}")
        print(f"--- eBay Full Error Response: {error_details} ---")
        return jsonify({"error": "Failed to create draft on eBay.", "details": error_details}), 500
    except Exception as e:
        print(f"!!! An unexpected error occurred creating eBay draft: {e}")
        return jsonify({"error": "An unknown error occurred"}), 500