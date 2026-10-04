from enum import Enum


# How urgent an alert is; drives the escalation timers
class Severity(str, Enum):
    WARNING = "WARNING"
    EVACUATE = "EVACUATE"


# What raised the alert
class AlertSource(str, Enum):
    MANUAL = "MANUAL"
    WEATHER = "WEATHER"
    SIMULATION = "SIMULATION"


# Where a household is in the escalation state machine (see plan.md §4)
class CheckinState(str, Enum):
    SENT = "SENT"
    RESENT = "RESENT"
    CALLING = "CALLING"
    UNREACHABLE = "UNREACHABLE"
    NEEDS_HELP = "NEEDS_HELP"
    ASSIGNED = "ASSIGNED"
    SAFE = "SAFE"
    RESCUED = "RESCUED"
    CLOSED = "CLOSED"


# Final states: the escalation engine ignores these
CLOSED_STATES = (CheckinState.SAFE, CheckinState.RESCUED, CheckinState.CLOSED)

# States where we know what happened to the household (the "accounted for" metric)
ACCOUNTED_STATES = (
    CheckinState.SAFE, CheckinState.NEEDS_HELP, CheckinState.ASSIGNED,
    CheckinState.RESCUED, CheckinState.CLOSED,
)


# Who a staff account is
class UserRole(str, Enum):
    ADMIN = "ADMIN"
    OPERATOR = "OPERATOR"
    RESPONDER = "RESPONDER"


# How a household is reached (and which channel a message used)
class Channel(str, Enum):
    SMS = "SMS"
    WHATSAPP = "WHATSAPP"


# Direction of an SMS relative to us
class MessageDirection(str, Enum):
    INBOUND = "INBOUND"
    OUTBOUND = "OUTBOUND"
