from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# backend/.env, found the same way whichever folder a command is run from
ENV_FILE = Path(__file__).resolve().parents[2] / ".env"


class Settings(BaseSettings):
    DATABASE_URL: str
    # simulated | africastalking
    SMS_PROVIDER: str = "simulated"
    AT_USERNAME: str = "sandbox"
    AT_API_KEY: str = ""
    # Shortens escalation timers to seconds for the demo
    SIMULATION: bool = True
    # Comma-separated browser origins
    CORS_ALLOW_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"

    model_config = SettingsConfigDict(env_file=ENV_FILE, env_file_encoding="utf-8")


settings = Settings()
