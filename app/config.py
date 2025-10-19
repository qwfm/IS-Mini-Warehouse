# app/config.py
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    # читаємо .env
    model_config = SettingsConfigDict(env_file=".env")

    DATABASE_URL: str
    AUTH0_DOMAIN: str = ""
    AUTH0_AUDIENCE: str = ""
    AUTH0_NAMESPACE: str = "https://mini-warehouse.example/"
    FASTAPI_HOST: str = "0.0.0.0"
    FASTAPI_PORT: int = 8000

    # dev toggle for bypassing Auth (use "1" or "true" in .env to enable)
    AUTH_DISABLED: bool = False

settings = Settings()
