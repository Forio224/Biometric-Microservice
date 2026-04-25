from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = Field(
        default="postgresql+psycopg://postgres:123@localhost:5432/dna",
        alias="DATABASE_URL",
    )
    allowed_origins: list[str] = Field(
        default=[
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ],
        alias="ALLOWED_ORIGINS",
    )
    verify_rate_limit_per_minute: int = Field(default=30, alias="VERIFY_RATE_LIMIT_PER_MINUTE")

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")
    

settings = Settings()