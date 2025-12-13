import requests
import os
import time

# --- Configuration ---
username = os.environ['PA_USERNAME']
token = os.environ['PA_API_TOKEN']
domain = 'pythonanywhere.com'
host = f'https://www.{domain}/api/v0/user/{username}/'
headers = {'Authorization': f'Token {token}'}

def run():
    # 1. Start a Console to run git pull
    print("🚀 Starting deployment...")
    console_resp = requests.post(f'{host}consoles/', headers=headers, json={'executable': 'bash'})
    if not console_resp.ok:
        print(f"❌ Failed to create console: {console_resp.text}")
        exit(1)
    
    console_id = console_resp.json()['id']
    print(f"✅ Console {console_id} created.")

    # 2. Send the update command
    # We navigate to the folder and pull. The '\n' simulates pressing Enter.
    command = "cd artisans-ally && git pull\n"
    requests.post(f'{host}consoles/{console_id}/send_input/', headers=headers, json={'input': command})
    print("⬇️  Pulling latest code from GitHub...")
    
    # 3. Wait for the pull to finish (approx 15 seconds)
    time.sleep(15)
    
    # 4. Kill the console (Cleanup)
    requests.delete(f'{host}consoles/{console_id}/', headers=headers)
    print("🧹 Cleanup complete.")

    # 5. Reload the Web App
    print("🔄 Reloading Web App...")
    reload_resp = requests.post(f'{host}webapps/{username}.{domain}/reload/', headers=headers)
    
    if reload_resp.ok:
        print("✨ DEPLOYMENT SUCCESSFUL! The live site is updated.")
    else:
        print(f"❌ Failed to reload webapp: {reload_resp.text}")
        exit(1)

if __name__ == '__main__':
    run()