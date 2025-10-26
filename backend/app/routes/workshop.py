from flask import jsonify, request
from flask_login import login_required, current_user
from flask import Blueprint
from ..extensions import db
from ..models import Material, Product, RecipeItem, User

# Create a Blueprint for our workshop routes
workshop_bp = Blueprint('workshop_bp', __name__)

@workshop_bp.route('/api/workshop', methods=['GET'])
@login_required
def get_workshop_data():
    user_materials = Material.query.filter_by(user_id=current_user.id).all()
    user_products = Product.query.filter_by(user_id=current_user.id).all()
    
    materials_data = [{'id': m.id, 'name': m.name, 'cost': m.cost, 'quantity': m.quantity, 'unit': m.unit} for m in user_materials]
    products_data = []
    
    # Create a dictionary for easy lookup
    materials_dict = {m.id: m for m in user_materials}
    
    # Calculate cost per unit for each material
    for m_data in materials_data:
        material = materials_dict.get(m_data['id'])
        if material and material.quantity > 0:
            m_data['cost_per_unit'] = round(material.cost / material.quantity, 4)
        else:
            m_data['cost_per_unit'] = 0
            
    # Calculate costs for each product
    for p in user_products:
        material_cost = 0
        for ri in p.recipe:
            # Find the material's cost per unit from our pre-calculated list
            material_info = next((m for m in materials_data if m['id'] == ri.material_id), None)
            cost_per_unit = material_info.get('cost_per_unit', 0) if material_info else 0
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

# --- Material Routes ---

@workshop_bp.route('/api/materials', methods=['POST'])
@login_required
def add_material():
    data = request.get_json()
    new_material = Material(
        name=data['name'], 
        cost=float(data['cost']), 
        quantity=float(data['quantity']), 
        unit=data['unit'], 
        owner=current_user
    )
    db.session.add(new_material)
    db.session.commit()
    return jsonify({"message": "Material added"}), 201

@workshop_bp.route('/api/materials/<int:material_id>', methods=['PUT'])
@login_required
def update_material(material_id):
    material = Material.query.get_or_404(material_id)
    if material.user_id != current_user.id: 
        return jsonify({"error": "Unauthorized"}), 403
    
    data = request.get_json()
    material.name = data['name']
    material.cost = float(data['cost'])
    material.quantity = float(data['quantity'])
    material.unit = data['unit']
    db.session.commit()
    return jsonify({"message": "Material updated"}), 200

@workshop_bp.route('/api/materials/<int:material_id>', methods=['DELETE'])
@login_required
def delete_material(material_id):
    material = Material.query.get_or_404(material_id)
    if material.user_id != current_user.id: 
        return jsonify({"error": "Unauthorized"}), 403
    
    db.session.delete(material)
    db.session.commit()
    return jsonify({"message": "Material deleted"}), 200

# --- Product Routes ---

@workshop_bp.route('/api/products', methods=['POST'])
@login_required
def add_product():
    data = request.get_json()
    new_product = Product(
        name=data['name'], 
        owner=current_user,
        labour_hours=float(data.get('labour_hours', 0)),
        hourly_rate=float(data.get('hourly_rate', 0)),
        profit_margin=float(data.get('profit_margin', 100))
    )
    db.session.add(new_product)
    db.session.commit() # Commit to get product.id

    for item in data['recipe']:
        recipe_item = RecipeItem(
            material_id=int(item['material_id']), 
            quantity=float(item['quantity']), 
            product_id=new_product.id
        )
        db.session.add(recipe_item)
    db.session.commit()
    return jsonify({"message": "Product added"}), 201

@workshop_bp.route('/api/products/<int:product_id>', methods=['PUT'])
@login_required
def update_product(product_id):
    product = Product.query.get_or_404(product_id)
    if product.user_id != current_user.id: 
        return jsonify({"error": "Unauthorized"}), 403
    
    data = request.get_json()
    
    product.name = data['name']
    product.labour_hours = float(data.get('labour_hours', 0))
    product.hourly_rate = float(data.get('hourly_rate', 0))
    product.profit_margin = float(data.get('profit_margin', 100))
    
    # Recreate the recipe
    RecipeItem.query.filter_by(product_id=product.id).delete()
    for item in data['recipe']:
        recipe_item = RecipeItem(
            material_id=int(item['material_id']), 
            quantity=float(item['quantity']), 
            product_id=product.id
        )
        db.session.add(recipe_item)
    
    db.session.commit()
    return jsonify({"message": "Product updated"}), 200

@workshop_bp.route('/api/products/<int:product_id>', methods=['DELETE'])
@login_required
def delete_product(product_id):
    product = Product.query.get_or_404(product_id)
    if product.user_id != current_user.id: 
        return jsonify({"error": "Unauthorized"}), 403
    
    db.session.delete(product)
    db.session.commit()
    return jsonify({"message": "Product deleted"}), 200