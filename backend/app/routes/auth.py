import os
import time
from flask import Flask, jsonify, request, redirect, current_app
from flask_login import login_user, logout_user, login_required, current_user
from flask import Blueprint
import sib_api_v3_sdk
from sib_api_v3_sdk.rest import ApiException
from itsdangerous import URLSafeTimedSerializer, SignatureExpired, BadTimeSignature
from ..extensions import db, bcrypt
from ..models import User

# Create a Blueprint, which is like a "mini-app" for our auth routes
auth_bp = Blueprint('auth_bp', __name__)

@auth_bp.route('/api/register', methods=['POST'])
def register():
    data = request.get_json()
    if User.query.filter_by(email=data['email']).first(): 
        return jsonify({"error": "Email already registered"}), 409
    
    hashed_password = bcrypt.generate_password_hash(data['password']).decode('utf-8')
    user = User(
        email=data['email'], 
        password=hashed_password, 
        currency=data.get('currency', 'GBP')
    )
    db.session.add(user)
    db.session.commit()
    login_user(user)
    
    return jsonify({
        "message": "User registered", 
        "user": {
            "email": user.email, 
            "currency": user.currency,
            "has_ebay_token": False 
        }
    }), 201

@auth_bp.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    user = User.query.filter_by(email=data['email']).first()
    
    if user and bcrypt.check_password_hash(user.password, data['password']):
        login_user(user, remember=True)
        return jsonify({
            "message": "Logged in", 
            "user": {
                "email": user.email, 
                "currency": user.currency,
                "has_ebay_token": hasattr(user, 'ebay_token') and user.ebay_token is not None
            }
        }), 200
        
    return jsonify({"error": "Invalid credentials"}), 401

@auth_bp.route('/api/logout', methods=['POST'])
@login_required
def logout():
    logout_user()
    return jsonify({"message": "Logged out"}), 200

@auth_bp.route('/api/check_session', methods=['GET'])
def check_session():
    if current_user.is_authenticated:
        return jsonify({
            "logged_in": True, 
            "user": {
                "email": current_user.email, 
                "has_ebay_token": hasattr(current_user, 'ebay_token') and current_user.ebay_token is not None, 
                "currency": current_user.currency
            }
        })
    return jsonify({"logged_in": False})

@auth_bp.route('/api/user/settings', methods=['PUT'])
@login_required
def update_settings():
    data = request.get_json()
    if 'currency' in data:
        current_user.currency = data['currency']
        db.session.commit()
        return jsonify({
            "message": "Settings updated", 
            "user": {
                "email": current_user.email, 
                "currency": current_user.currency,
                "has_ebay_token": hasattr(current_user, 'ebay_token') and current_user.ebay_token is not None
            }
        }), 200
    return jsonify({"error": "No valid settings provided"}), 400

@auth_bp.route('/api/forgot-password', methods=['POST'])
def forgot_password():
    data = request.get_json()
    email = data.get('email')
    user = User.query.filter_by(email=email).first()
    
    if not user:
        # Silently succeed to prevent email enumeration
        return jsonify({"message": "If an account with this email exists, a reset link has been sent."}), 200

    try:
        s = URLSafeTimedSerializer(current_app.config['SECRET_KEY'])
        token = s.dumps(user.email, salt='password-reset-salt')
        
        user.reset_token = token
        user.reset_token_expiry = int(time.time()) + 3600 # 1 hour
        db.session.commit()

        # Use the frontend URL from config
        reset_url = f"{current_app.config['FRONTEND_URL']}/reset-password/{token}"
        
        configuration = sib_api_v3_sdk.Configuration()
        configuration.api_key['api-key'] = os.environ.get('BREVO_API_KEY')

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
        
        return jsonify({"message": "If an account with this email exists, a reset link has been sent."}), 200

    except ApiException as e:
        print(f"!!! Brevo API Exception in forgot_password: {e}")
        return jsonify({"error": "An internal error occurred sending the email."}), 500
    except Exception as e:
        print(f"!!! Error in forgot_password: {e}")
        return jsonify({"error": "An internal error occurred."}), 500

@auth_bp.route('/api/reset-password', methods=['POST'])
def reset_password():
    data = request.get_json()
    token = data.get('token')
    new_password = data.get('password')
    
    if not token or not new_password:
        return jsonify({"error": "Invalid request."}), 400

    try:
        s = URLSafeTimedSerializer(current_app.config['SECRET_KEY'])
        email = s.loads(token, salt='password-reset-salt', max_age=3600)
        
        user = User.query.filter_by(email=email).first()
        
        if not user or user.reset_token != token or (user.reset_token_expiry and user.reset_token_expiry < int(time.time())):
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

# --- CHANGE PASSWORD ENDPOINT ---
@auth_bp.route('/api/user/change-password', methods=['PUT'])
@login_required
def change_password():
    data = request.get_json()
    current_password = data.get('currentPassword')
    new_password = data.get('newPassword')

    if not current_password or not new_password:
        return jsonify({"error": "Missing fields"}), 400

    # Check if the current password is correct
    if not bcrypt.check_password_hash(current_user.password, current_password):
        return jsonify({"error": "Current password is incorrect"}), 403 # 403 Forbidden

    # Hash the new password and save it
    current_user.password = bcrypt.generate_password_hash(new_password).decode('utf-8')
    db.session.commit()

    return jsonify({"message": "Password updated successfully"}), 200