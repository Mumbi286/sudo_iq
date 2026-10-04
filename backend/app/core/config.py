from pathlib import Path
from typing import Tuple

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# backend/.env, found the same way whichever folder a command is run from
ENV_FILE = Path(__file__).resolve().parents[2] / ".env"


def _seconds(csv_minutes: str) -> Tuple[int, int, int]:
    resend, call, unreachable = (int(float(m) * 60) for m in csv_minutes.split(","))
    return resend, call, unreachable


class Settings(BaseSettings):
    DATABASE_URL: str

    # Auth
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    # One operator shift
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    # First admin, created by the seed script if both are set
    FIRST_ADMIN_EMAIL: str = ""
    FIRST_ADMIN_PASSWORD: str = ""

    # SMS: simulated | africastalking
    SMS_PROVIDER: str = "simulated"
    AT_USERNAME: str = "sandbox"
    AT_API_KEY: str = ""
    AT_SENDER_ID: str = ""
    # WhatsApp: simulated | twilio
    WHATSAPP_PROVIDER: str = "simulated"
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    # Twilio WhatsApp sandbox number (or your approved WhatsApp sender), E.164
    TWILIO_WHATSAPP_FROM: str = "+14155238886"
    # The "join <code>" words from the Twilio sandbox page; shown to judges as a QR code
    TWILIO_SANDBOX_JOIN_CODE: str = ""
    # Reject webhook calls that are not signed by Twilio
    TWILIO_VALIDATE_SIGNATURE: bool = True
    # Public HTTPS URL of this API as Twilio sees it (the tunnel URL); needed for signature checks
    PUBLIC_BASE_URL: str = ""

    # Unit costs used for the cost-per-alert figure (verify current provider rates)
    SMS_UNIT_COST_KES: float = 1.0
    WHATSAPP_UNIT_COST_KES: float = 1.0
    VOICE_UNIT_COST_KES: float = 4.0

    # Escalation: minutes after the alert to resend, call, then mark unreachable
    ESCALATION_MINUTES_EVACUATE: str = "5,10,20"
    ESCALATION_MINUTES_WARNING: str = "15,30,60"
    # Demo mode: the same steps in seconds so a whole flood plays out in under a minute
    SIMULATION: bool = True
    SIMULATION_ESCALATION_SECONDS: str = "10,20,30"

    # Comma-separated browser origins
    CORS_ALLOW_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174"

    model_config = SettingsConfigDict(env_file=ENV_FILE, env_file_encoding="utf-8")

    # Neon / Render give postgres:// or postgresql:// URLs; SQLAlchemy with psycopg 3 needs postgresql+psycopg://
    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def normalize_database_url(cls, value: str) -> str:
        if isinstance(value, str):
            for prefix in ("postgres://", "postgresql://"):
                if value.startswith(prefix):
                    return "postgresql+psycopg://" + value[len(prefix):]
        return value

    # Seconds from alert to (resend, call, unreachable) for a severity
    def escalation_seconds(self, severity: str) -> Tuple[int, int, int]:
        if self.SIMULATION:
            resend, call, unreachable = (int(s) for s in self.SIMULATION_ESCALATION_SECONDS.split(","))
            return resend, call, unreachable
        if severity == "EVACUATE":
            return _seconds(self.ESCALATION_MINUTES_EVACUATE)
        return _seconds(self.ESCALATION_MINUTES_WARNING)


settings = Settings()
