"""Provider-neutrale Verträge: Fehlerklassen, Normalized*-Modelle, Protocol.

Der Wechsel zur offiziellen Garmin-API (oder Apple Health / Strava) ersetzt
nur die Provider-Implementierung — alles ab Normalisierung arbeitet
ausschließlich mit diesen Typen (Design §1/§8).
"""

from __future__ import annotations

from typing import Any, Optional, Protocol, runtime_checkable

from pydantic import BaseModel, ConfigDict


# ---------------------------------------------------------------------------
# Fehlerklassen (provider-neutral)
# ---------------------------------------------------------------------------

class ProviderError(RuntimeError):
    """Basisklasse. Nachrichten dürfen KEINE Credentials/Tokens enthalten."""

    code = "PROVIDER_ERROR"


class AuthError(ProviderError):
    """Login abgelehnt / Tokens ungültig -> reauth_required (fail closed)."""

    code = "AUTH_FAILED"


class MfaRequired(ProviderError):
    """MFA nötig. `client_state` ist ein opakes, serialisierbares Dict."""

    code = "MFA_REQUIRED"

    def __init__(self, client_state: dict | None = None) -> None:
        super().__init__("MFA erforderlich")
        self.client_state = client_state or {}


class RateLimited(ProviderError):
    code = "RATE_LIMITED"


class ProviderUnavailable(ProviderError):
    code = "PROVIDER_UNAVAILABLE"


# ---------------------------------------------------------------------------
# Normalisierte Modelle (provider-neutral)
# ---------------------------------------------------------------------------

class NormalizedMetric(BaseModel):
    model_config = ConfigDict(frozen=True)

    metric_type: str
    value_numeric: Optional[float] = None
    value_text: Optional[str] = None
    unit: Optional[str] = None
    metric_date: str  # ISO YYYY-MM-DD (Nutzer-Zeitzone)
    measured_at: Optional[str] = None  # ISO-Timestamp, wenn bekannt
    source_type: str  # 'device_measurement' | 'provider_calculation'
    source_record_id: str
    device_hint: Optional[str] = None  # z.B. 'smart_scale' | 'watch'
    quality: Optional[str] = None
    confidence: Optional[str] = None


class NormalizedDevice(BaseModel):
    model_config = ConfigDict(frozen=True)

    provider_device_id: str
    unit_id: Optional[str] = None
    product_id: Optional[str] = None
    device_name: Optional[str] = None
    model_name: Optional[str] = None
    device_type: str = "other"
    software_version: Optional[str] = None
    is_primary_wearable: bool = False
    is_primary_training_device: bool = False
    is_last_used: bool = False


class NormalizedActivity(BaseModel):
    model_config = ConfigDict(frozen=True)

    source_record_id: str
    sport_raw: str
    sport_id: str
    started_at: Optional[str] = None
    ended_at: Optional[str] = None
    duration_seconds: Optional[float] = None
    summary: dict[str, Any] = {}
    metrics: dict[str, Any] = {}


# ---------------------------------------------------------------------------
# Provider-Protocol
# ---------------------------------------------------------------------------

@runtime_checkable
class HealthDataProvider(Protocol):
    """Vertrag für Provider-Implementierungen (sync, wird im Thread ausgeführt).

    Fetch-Methoden geben Roh-Dicts NICHT nach außen — sie liefern bereits
    Normalized*-Objekte. `daily_category_metrics`/`performance_category_metrics`
    nennen je Abruf-Kategorie die potenziell emittierten Metrik-IDs
    (für die Capability-Zustandsmaschine).
    """

    provider_type: str
    daily_category_metrics: dict[str, list[str]]
    performance_category_metrics: dict[str, list[str]]

    def connect(self, email: str, password: str, mfa_code: str | None = None) -> str:
        """Login; Rückgabe Token-String. Raises MfaRequired/AuthError/..."""
        ...

    def resume_mfa(self, client_state: dict, mfa_code: str) -> str:
        """MFA-Fortsetzung; Rückgabe Token-String."""
        ...

    def login_with_tokens(self, token_str: str) -> None:
        """Session aus gespeicherten Tokens herstellen (kein Passwort)."""
        ...

    def get_devices(self) -> list[NormalizedDevice]: ...

    def get_profile_metrics(self) -> dict[str, Any]:
        """Provider-Status (displayName, unitSystem, ...) für data_providers."""
        ...

    def get_daily_metrics(self, category: str, metric_date: str) -> list[NormalizedMetric]:
        """Ein Abruf je Kategorie aus `daily_category_metrics`.

        Delegiert für 'sleep' bzw. 'weigh_ins'/'body_composition' an die
        benannten Methoden unten.
        """
        ...

    def get_sleep(self, metric_date: str) -> list[NormalizedMetric]: ...

    def get_body_composition(self, metric_date: str) -> list[NormalizedMetric]: ...

    def get_performance_metrics(self, category: str, metric_date: str) -> list[NormalizedMetric]:
        """Ein Abruf je Kategorie aus `performance_category_metrics` (nur 'heute')."""
        ...

    def get_activities(self, start_date: str, end_date: str) -> list[NormalizedActivity]: ...
