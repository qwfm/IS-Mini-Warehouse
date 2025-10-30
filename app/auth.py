import json
import requests
import os
from jose import jwt
from jose.exceptions import JWTError, ExpiredSignatureError
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from functools import lru_cache
from .config import settings

if getattr(settings, "AUTH_DISABLED", False):
    def get_current_user_dummy(*args, **kwargs):
        return {
            "sub": "dev|1",
            "email": "dev@example.com",
            f"{settings.AUTH0_NAMESPACE}roles": ["storekeeper", "admin"],
            "roles": ["storekeeper", "admin"]
        }

    def get_current_user(credentials=None):
        return get_current_user_dummy()

    def require_role(role: str):
        def _role_checker(payload = None):
            return get_current_user_dummy()
        return _role_checker
    
auth_scheme = HTTPBearer()

@lru_cache()
def get_jwks():
    jwks_url = f"https://{settings.AUTH0_DOMAIN}/.well-known/jwks.json"
    r = requests.get(jwks_url, timeout=5)
    r.raise_for_status()
    return r.json()

# helper: find the correct key from jwks by kid
def get_public_key_for_token(token: str):
    unverified_header = jwt.get_unverified_header(token)
    kid = unverified_header.get("kid")
    if not kid:
        raise HTTPException(status_code=401, detail="Invalid token header: kid missing")
    jwks = get_jwks()
    key = None
    for k in jwks.get("keys", []):
        if k.get("kid") == kid:
            key = k
            break
    if key is None:
        raise HTTPException(status_code=401, detail="Appropriate JWK not found")
    # python-jose can decode using the JWK directly (pass the dict via json.dumps)
    return key


def verify_jwt(token: str):
    key = get_public_key_for_token(token)
    try:
        payload = jwt.decode(
            token,
            key=json.dumps(key),
            algorithms=["RS256"],
            audience=settings.AUTH0_AUDIENCE,
            issuer=f"https://{settings.AUTH0_DOMAIN}/",
        )
    except ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except JWTError as e:
        raise HTTPException(status_code=401, detail=f"Token invalid: {str(e)}")
    return payload


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(auth_scheme)):
    token = credentials.credentials
    payload = verify_jwt(token)
    return payload


def require_role(role: str):
    def role_checker(payload = Depends(get_current_user)):
        roles = payload.get(settings.AUTH0_NAMESPACE + 'roles') or payload.get('roles') or []
        if not isinstance(roles, list):
            raise HTTPException(status_code=403, detail="Roles claim malformed")
        if role not in roles:
            raise HTTPException(status_code=403, detail="Insufficient role")
        return payload
    return role_checker
