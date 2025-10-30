from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env")

    DATABASE_URL: str = "postgresql://postgres:1234@localhost:5432/mini-warehouse"
    AUTH0_DOMAIN: str = "dev-jfd3ljasjnugzic6.eu.auth0.com"
    AUTH0_AUDIENCE: str = "https://mini-warehouse.example/api"
    AUTH0_NAMESPACE: str = "https://mini-warehouse.example/"
    FASTAPI_HOST: str = "0.0.0.0"
    FASTAPI_PORT: int = 8000

    # dev toggle for bypassing Auth 
    AUTH_DISABLED: bool = False

settings = Settings()
