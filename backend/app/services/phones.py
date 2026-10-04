import re

# Kenyan mobile numbers: 07xx / 01xx local format, 2547xx / 2541xx, or +254...
_LOCAL_KE = re.compile(r"^0([17]\d{8})$")
_INTL_NO_PLUS = re.compile(r"^(254[17]\d{8})$")


# Normalise a phone number to E.164 (+2547...), so the same person always matches one household.
# Strips a "whatsapp:" prefix, spaces and dashes; numbers from other countries pass through with a +.
def normalize_phone(raw: str) -> str:
    phone = raw.strip()
    if phone.lower().startswith("whatsapp:"):
        phone = phone[len("whatsapp:"):]
    phone = re.sub(r"[\s\-()]", "", phone)

    if match := _LOCAL_KE.match(phone):
        return f"+254{match.group(1)}"
    if match := _INTL_NO_PLUS.match(phone):
        return f"+{match.group(1)}"
    if not phone.startswith("+"):
        phone = f"+{phone}"
    return phone
