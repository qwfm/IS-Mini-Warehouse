import json, requests
from jose import jwt
from fastapi import HTTPException, Header
from functools import lru_cache

AUTH0_DOMAIN = "dev-jfd3ljasjnugzic6.eu.auth0.com"
API_AUDIENCE = "https://mini-warehouse.example/api"
ALGS = ["RS256"]

@lru_cache
def jwks():
    url = f"https://{AUTH0_DOMAIN}/.well-known/jwks.json"
    return requests.get(url, timeout=5).json()

def require_auth(authorization: str = Header(...)):
    try:
        token = authorization.split()[1]
        unverified = jwt.get_unverified_header(token)
        key = next(k for k in jwks()["keys"] if k["kid"] == unverified["kid"])
        payload = jwt.decode(
            token,
            key,
            algorithms=ALGS,
            audience=API_AUDIENCE,
            issuer=f"https://{AUTH0_DOMAIN}/"
        )
        return payload
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Unauthorized: {e}")
