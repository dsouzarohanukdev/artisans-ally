import os
from flask import jsonify, request, current_app, Blueprint
import sib_api_v3_sdk
from sib_api_v3_sdk.rest import ApiException

# Create a Blueprint for our general routes
general_bp = Blueprint('general_bp', __name__)

@general_bp.route('/api/contact', methods=['POST'])
def contact_form():
    data = request.get_json()
    name = data.get('name')
    email = data.get('email')
    message = data.get('message')

    if not name or not email or not message:
        return jsonify({"error": "All fields are required."}), 400

    # Get Brevo keys from the app's config
    brevo_api_key = current_app.config.get('BREVO_API_KEY')
    your_contact_email = current_app.config.get('CONTACT_EMAIL') 

    if not brevo_api_key or not your_contact_email:
        print("!!! ERROR: BREVO_API_KEY or CONTACT_EMAIL is not set in config.")
        return jsonify({"error": "Server is not configured for mail."}), 500

    # We do the replacement *before* the f-string to avoid the backslash error
    formatted_message = message.replace('\n', '<br>')    
    
    subject = f"New Contact Form Message from {name}"
    html_content = f"""<html><body>
        <h2>New Contact Form Submission</h2>
        <p><strong>Name:</strong> {name}</p>
        <p><strong>Email:</strong> {email}</p>
        <hr>
        <p><strong>Message:</strong></p>
        <p>{formatted_message}</p>
        </body></html>
        """
    
    # This is who the email is FROM (your verified sender)
    sender = {"name": "Artisan's Ally Contact Form", "email": "noreply@freefileconverter.co.uk"}
    # This is who the email is TO (you)
    to = [{"email": your_contact_email}]
    
    send_smtp_email = sib_api_v3_sdk.SendSmtpEmail(
        to=to,
        html_content=html_content,
        sender=sender,
        subject=subject
    )

    try:
        # --- Brevo API v3 Configuration ---
        configuration = sib_api_v3_sdk.Configuration()
        configuration.api_key['api-key'] = brevo_api_key
        api_instance = sib_api_v3_sdk.TransactionalEmailsApi(sib_api_v3_sdk.ApiClient(configuration))
        
        api_instance.send_transac_email(send_smtp_email)
        return jsonify({"message": "Thank you for your message! We will get back to you soon."}), 200
    except ApiException as e:
        print(f"!!! Brevo API Exception in contact_form: {e}")
        return jsonify({"error": "An internal error occurred sending the email."}), 500
    except Exception as e:
        print(f"!!! Error in contact_form: {e}")
        return jsonify({"error": "An internal error occurred."}), 500