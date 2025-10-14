import os
import statistics
import time
import json
from collections import Counter
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
from openai import OpenAI
import requests
import base64

# --- Initialization & Setup ---
app = Flask(__name__)
CORS(app)
load_dotenv()
openai_client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
ETSY_API_KEY = os.environ.get("ETSY_API_KEY")
DATABASE_FILE = 'database.json'
EBAY_PROD_CLIENT_ID = os.environ.get("EBAY_PROD_CLIENT_ID")
EBAY_PROD_CLIENT_SECRET = os.environ.get("EBAY_PROD_CLIENT_SECRET")
ebay_oauth_token = None
ebay_token_expiry = 0

# --- Database Helper Functions ---
def read_db():
    if not os.path.exists(DATABASE_FILE): write_db({"materials": [], "products": []})
    with open(DATABASE_FILE, 'r', encoding='utf-8') as f: return json.load(f)
def write_db(data):
    with open(DATABASE_FILE, 'w', encoding='utf-8') as f: json.dump(data, f, indent=4)
MOCK_ETSY_DATA = { "count": 3, "results": [ {"listing_id": 1, "title": "Handmade Terrazzo Coaster Set - Monochrome", "price": {"amount": 2200, "divisor": 100, "currency_code": "GBP"}, "tags": ["terrazzo coaster", "jesmonite", "handmade gift"]}, {"listing_id": 2, "title": "Minimalist Oval Jesmonite Tray - Sage Green", "price": {"amount": 2650, "divisor": 100, "currency_code": "GBP"}, "tags": ["jesmonite tray", "sage green decor", "jewellery dish"]}, {"listing_id": 3, "title": "Concrete Plant Pot - Industrial Style Decor", "price": {"amount": 1900, "divisor": 100, "currency_code": "GBP"}, "tags": ["concrete planter", "industrial decor", "succulent pot"]}, ]}

# --- OAuth Token Function ---
def get_ebay_oauth_token():
    global ebay_oauth_token, ebay_token_expiry
    if ebay_oauth_token and time.time() < ebay_token_expiry:
        print("--- Using cached eBay OAuth token. ---"); return ebay_oauth_token
    print("--- Requesting new eBay Application OAuth token... ---")
    url = "https://api.ebay.com/identity/v1/oauth2/token"
    credentials = f"{EBAY_PROD_CLIENT_ID}:{EBAY_PROD_CLIENT_SECRET}"
    base64_credentials = base64.b64encode(credentials.encode()).decode()
    headers = {"Content-Type": "application/x-www-form-urlencoded", "Authorization": f"Basic {base64_credentials}"}
    body = {"grant_type": "client_credentials", "scope": "https://api.ebay.com/oauth/api_scope"}
    try:
        response = requests.post(url, headers=headers, data=body); response.raise_for_status()
        data = response.json(); ebay_oauth_token = data['access_token']
        ebay_token_expiry = time.time() + (data['expires_in'] - 300)
        print("--- Successfully obtained new eBay OAuth token. ---"); return ebay_oauth_token
    except requests.exceptions.RequestException as e:
        print(f"!!! Failed to get eBay OAuth token: {e.response.text if e.response else e}"); return None

# --- Live API Search Functions ---
def search_etsy_production(search_term):
    print(f"\n--- Attempting Etsy PRODUCTION Search for '{search_term}' ---")
    if not ETSY_API_KEY: print("ERROR: Etsy API Key is not set in the .env file."); return []
    url = "https://openapi.etsy.com/v3/application/listings/active"; headers = {"x-api-key": ETSY_API_KEY}; params = {"keywords": search_term, "limit": 100, "sort_on": "score", "sort_order": "desc", "region": "GB"}
    try:
        response = requests.get(url, headers=headers, params=params); response.raise_for_status()
        response_data = response.json(); normalized_results = []
        for listing in response_data.get('results', []): normalized_results.append({'listing_id': listing.get('listing_id'), 'title': listing.get('title'), 'price': {'amount': listing['price']['amount'], 'divisor': listing['price']['divisor'], 'currency_code': listing['price']['currency_code']}, 'source': 'Etsy'})
        print(f"Found {len(normalized_results)} items on Etsy PRODUCTION for '{search_term}'"); return normalized_results
    except requests.exceptions.HTTPError as e:
        if e.response.status_code == 403: print("--- Etsy API Error: 403 Forbidden (Key likely inactive) ---")
        else: print(f"Etsy API request failed with status code {e.response.status_code}: {e}")
        return []
    except Exception as e: print(f"An unexpected error occurred during the Etsy search: {e}"); return []
def search_ebay_production(search_term, category_id=None, exclude_item_id=None):
    print(f"\n--- Attempting eBay PRODUCTION Search using Browse API for '{search_term}' ---")
    token = get_ebay_oauth_token()
    if not token: return []
    url = "https://api.ebay.com/buy/browse/v1/item_summary/search"; headers = {"Authorization": f"Bearer {token}", "X-EBAY-C-MARKETPLACE-ID": "EBAY_GB"}; 
    params = {"q": search_term, "limit": 50} # Limit related items for speed
    if category_id:
        params['category_ids'] = category_id
    if exclude_item_id:
        # A more robust filter to exclude an item ID
        params['filter'] = f"itemId:-{{{exclude_item_id}}}"

    try:
        response = requests.get(url, headers=headers, params=params); response.raise_for_status()
        data = response.json(); normalized_results = []
        for item in data.get('itemSummaries', []):
            if 'price' in item and 'value' in item['price']:
                normalized_results.append({'listing_id': item['itemId'], 'title': item['title'], 'price': {'amount': int(float(item['price']['value']) * 100), 'divisor': 100, 'currency_code': item['price']['currency']}, 'source': 'eBay'})
        print(f"Found {len(normalized_results)} items on eBay PRODUCTION for '{search_term}'"); return normalized_results
    except requests.exceptions.HTTPError as e:
        print(f"!!! eBay Browse API Error: {e.response.status_code} - {e.response.text}"); return []
    except Exception as e: print(f"An unexpected error occurred during the eBay Browse API search: {e}"); return []
def analyse_prices(item_list):
    if not item_list: return {"count": 0, "average_price": 0, "min_price": 0, "max_price": 0}
    prices = [(item['price']['amount'] / item['price']['divisor']) for item in item_list]
    return {"count": len(prices), "average_price": round(statistics.mean(prices), 2), "min_price": round(min(prices), 2), "max_price": round(max(prices), 2)}
    
# --- (Workshop and other endpoints are correct and unchanged) ---
@app.route('/api/workshop', methods=['GET'])
def get_workshop_data():
    db_data = read_db(); materials_dict = {m['id']: m for m in db_data.get('materials', [])}
    for material in db_data.get('materials', []):
        if material.get('quantity', 0) > 0: material['cost_per_unit'] = round(material.get('cost', 0) / material.get('quantity', 1), 4)
        else: material['cost_per_unit'] = 0
    for product in db_data.get('products', []):
        total_cost = 0;
        for item in product.get('recipe', []):
            material = materials_dict.get(int(item.get('material_id')))
            if material and material.get('quantity', 0) > 0:
                cost_per_unit = material.get('cost', 0) / material.get('quantity', 1)
                total_cost += cost_per_unit * float(item.get('quantity', 0))
        product['cogs'] = round(total_cost, 2)
    return jsonify(db_data)
@app.route('/api/materials', methods=['POST'])
def add_material():
    new_material = request.get_json(); db_data = read_db()
    new_material['id'] = int(time.time() * 1000)
    new_material['cost'] = float(new_material.get('cost', 0)); new_material['quantity'] = float(new_material.get('quantity', 0))
    db_data['materials'].append(new_material)
    write_db(db_data); return jsonify(new_material), 201
@app.route('/api/materials/<int:material_id>', methods=['DELETE'])
def delete_material(material_id):
    db_data = read_db(); db_data['materials'] = [m for m in db_data['materials'] if m['id'] != material_id]
    write_db(db_data); return jsonify({"message": "Material deleted"}), 200
@app.route('/api/products', methods=['POST'])
def add_product():
    new_product_data = request.get_json(); db_data = read_db()
    new_product = {'id': int(time.time() * 1000), 'name': new_product_data.get('name'), 'recipe': new_product_data.get('recipe', [])}
    db_data['products'].append(new_product)
    write_db(db_data); return jsonify(new_product), 201
@app.route('/api/products/<int:product_id>', methods=['DELETE'])
def delete_product(product_id):
    db_data = read_db(); db_data['products'] = [p for p in db_data['products'] if p['id'] != product_id]
    write_db(db_data); return jsonify({"message": "Product deleted"}), 200
@app.route('/api/related-items/<item_id>', methods=['GET'])
def get_related_items(item_id):
    print(f"\n--- Finding items related to eBay item ID: {item_id} ---")
    token = get_ebay_oauth_token()
    if not token: return jsonify({"error": "Could not authenticate with eBay"}), 500
    try:
        item_url = f"https://api.ebay.com/buy/browse/v1/item/{item_id}"
        headers = {"Authorization": f"Bearer {token}", "X-EBAY-C-MARKETPLACE-ID": "EBAY_GB"}
        item_response = requests.get(item_url, headers=headers); item_response.raise_for_status()
        item_data = item_response.json()
        
        category_id = item_data.get('categoryPath', '').split('|')[0]
        original_title = item_data.get('title')

        if not category_id or not original_title:
            print("--- Could not determine category or title for related search. ---")
            return jsonify({"listings": []})

        print(f"--- Original item is in category {category_id}. Searching for similar items... ---")
        related_listings = search_ebay_production(search_term=original_title, category_id=category_id, exclude_item_id=item_id)
        return jsonify({"listings": related_listings})

    except requests.exceptions.HTTPError as e:
        print(f"!!! Error fetching related items: {e.response.status_code} - {e.response.text}")
        return jsonify({"error": "Failed to fetch related items from eBay"}), 500
    except Exception as e:
        print(f"An unexpected error occurred in get_related_items: {e}")
        return jsonify({"error": "An unexpected error occurred"}), 500

# --- Main Analysis & AI Endpoints ---
@app.route("/api/analyse", methods=["GET"])
def analyse_market():
    try: material_cost = float(request.args.get('cost', 0)); search_query = request.args.get('query', 'jesmonite tray')
    except (ValueError, TypeError): return jsonify({"error": "Invalid request parameters"}), 400
    etsy_listings = MOCK_ETSY_DATA["results"]; 
    for listing in etsy_listings: listing['source'] = 'Etsy'
    # etsy_listings = search_etsy_production(search_query)
    ebay_listings = search_ebay_production(search_query)
    etsy_analysis = analyse_prices(etsy_listings); ebay_analysis = analyse_prices(ebay_listings); combined_analysis = analyse_prices(etsy_listings + ebay_listings)
    average_price = combined_analysis['average_price']
    PLATFORM_FEE_PERCENTAGE, PLATFORM_FIXED_FEE, SHIPPING_COST = 0.10, 0.20, 3.20
    scenarios = []; pricing_tiers = {"The Budget Leader": average_price * 0.9, "The Competitor": average_price, "The Premium Brand": average_price * 1.15}
    for name, price in pricing_tiers.items():
        fees = (price * PLATFORM_FEE_PERCENTAGE) + PLATFORM_FIXED_FEE; profit = price - material_cost - fees - SHIPPING_COST
        scenarios.append({"name": name, "price": round(price, 2), "profit": round(profit, 2)})
    all_tags = [tag for item in etsy_listings if item.get("tags") for tag in item["tags"]]
    tag_counts = Counter(all_tags); top_keywords = [tag for tag, count in tag_counts.most_common(10)]
    full_response = {"listings": {"etsy": etsy_listings, "ebay": ebay_listings}, "analysis": {"overall": combined_analysis, "etsy": etsy_analysis, "ebay": ebay_analysis}, "profit_scenarios": scenarios, "seo_analysis": {"top_keywords": top_keywords}}
    return jsonify(full_response)
@app.route("/api/generate-content", methods=["POST"])
def generate_content():
    data = request.get_json(); keywords = data.get("keywords")
    if not keywords: return jsonify({"error": "No keywords provided"}), 400
    keyword_string = ", ".join(keywords)
    try:
        prompt = f"""You are an expert Etsy SEO and copywriter...""" # Truncated
        completion = openai_client.chat.completions.create(model="gpt-gpt-3.5-turbo", messages=[{"role": "system", "content": "You are a helpful assistant designed to output JSON."}, {"role": "user", "content": prompt}], response_format={"type": "json_object"})
        ai_response = completion.choices[0].message.content
        print("Successfully received response from OpenAI."); return ai_response, 200, {'Content-Type': 'application/json'}
    except Exception as e:
        print(f"Error calling OpenAI API: {e}"); return jsonify({"error": "Failed to generate content from AI."}), 500
if __name__ == "__main__":
    app.run(debug=True)