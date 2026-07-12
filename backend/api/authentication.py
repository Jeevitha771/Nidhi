import os
import requests
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from django.contrib.auth.models import User
from django.conf import settings

# Token issued by the local /api/login/ endpoint when ENVIRONMENT=nexusserver.
NEXUS_LOCAL_TOKEN = 'nexusserver-local-token'

class RubixTokenAuthentication(BaseAuthentication):
    """
    Custom authentication class that verifies a token against the Rubix IT Solutions IdP.
    """
    def authenticate(self, request):
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return None

        token = auth_header.split(' ')[1]

        # Local login mode for the 'nexusserver' deployment (no Rubix IdP reachable)
        if os.environ.get('ENVIRONMENT', '').lower() == 'nexusserver' and token == NEXUS_LOCAL_TOKEN:
            user, _ = User.objects.get_or_create(username='jeevitha')
            user.role = 'founding_engineer'
            return (user, token)

        # Call the Rubix IdP introspection or userinfo endpoint
        # The main Django OAuth toolkit typically provides an introspection endpoint 
        # or we can simply verify it against a protected resource on Rubix
        rubix_introspect_url = getattr(settings, 'RUBIX_INTROSPECT_URL', 'https://rubix.novamymentor.cloud/o/introspect/')
        
        data = {
            'token': token.decode('utf-8') if isinstance(token, bytes) else token,
            # If Rubix requires client id/secret for introspection, we provide them
            'client_id': os.environ.get('OAUTH_CLIENT_ID', 'nidhi_client_id_123'),
            'client_secret': os.environ.get('OAUTH_CLIENT_SECRET', 'nidhi_client_secret_xyz789_very_long_string_for_security'),
        }
        
        try:
            response = requests.post(rubix_introspect_url, data=data, timeout=5)
            if response.status_code == 200:
                token_data = response.json()
                if token_data.get('active'):
                    # Create or retrieve a local Django User to satisfy DRF
                    username = token_data.get('username') or 'sso_user'
                    user, created = User.objects.get_or_create(username=username)
                    
                    # We can attach the Rubix token metadata to the user or request for later use
                    request.sso_user_id = username
                    user.role = token_data.get('role', 'employee')
                    print("USER ROLE ASSIGNED:", user.role)
                    
                    return (user, token)
                else:
                    raise AuthenticationFailed('Token is inactive or expired')
            else:
                # Fallback: if introspection is not available on Rubix, we might just call a protected endpoint
                # like /api/user/ to see if the token is accepted.
                profile_url = "http://172.21.0.1:8000/api/profile/" # example protected endpoint
                profile_resp = requests.get(profile_url, headers={'Authorization': f'Bearer {token}'}, timeout=5)
                if profile_resp.status_code == 200:
                    profile_data = profile_resp.json()
                    username = profile_data.get('username') or 'sso_user'
                    user, created = User.objects.get_or_create(username=username)
                    # Hardcode role for known admins
                    if username in ['aadi', 'admin', 'aadisheshu']:
                        user.role = 'founding_engineer'
                    else:
                        user.role = 'employee'
                    return (user, token)
                else:
                    raise AuthenticationFailed('Invalid Rubix SSO token')

        except requests.exceptions.RequestException as e:
            raise AuthenticationFailed(f'Could not verify token with Rubix IdP: {str(e)}')
            
        return None
