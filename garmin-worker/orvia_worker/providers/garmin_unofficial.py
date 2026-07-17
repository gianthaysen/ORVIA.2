"""Garmin-Provider über python-garminconnect 0.3.2 (inoffizielle API).

Fehler werden auf die provider-neutralen Klassen aus base.py gemappt.
KEINE Logs von Credentials, Tokens oder Roh-Payloads (Design §7).

Migrationsweg (Design §8): dieses Modul wird durch garmin_official.py ersetzt,
der Rest der Pipeline bleibt unverändert.
"""

from __future__ import annotations

import logging
from typing import Any, Callable

from .. import normalize
from .base import (
    AuthError,
    MfaRequired,
    NormalizedActivity,
    NormalizedDevice,
    NormalizedMetric,
    ProviderError,
    ProviderUnavailable,
    RateLimited,
)

logger = logging.getLogger("orvia.provider.garmin")

PROVIDER_TYPE = "garmin_unofficial"


def _map_exception(e: Exception) -> ProviderError:
    """garminconnect/garth/HTTP-Fehler -> eigene Fehlerklassen (ohne Payloads)."""
    try:
        from garminconnect import (  # type: ignore
            GarminConnectAuthenticationError,
            GarminConnectConnectionError,
            GarminConnectTooManyRequestsError,
        )
    except Exception:  # pragma: no cover — Bibliothek fehlt nur in Sonderfällen
        GarminConnectAuthenticationError = ()  # type: ignore
        GarminConnectConnectionError = ()  # type: ignore
        GarminConnectTooManyRequestsError = ()  # type: ignore

    if isinstance(e, GarminConnectAuthenticationError):
        return AuthError("Garmin-Authentifizierung fehlgeschlagen")
    if isinstance(e, GarminConnectTooManyRequestsError):
        return RateLimited("Garmin-Rate-Limit erreicht")
    if isinstance(e, GarminConnectConnectionError):
        return ProviderUnavailable("Garmin nicht erreichbar")
    status = getattr(getattr(e, "response", None), "status_code", None)
    if status == 401:
        return AuthError("Garmin-Session ungültig")
    if status == 429:
        return RateLimited("Garmin-Rate-Limit erreicht")
    return ProviderUnavailable(f"Garmin-Abruf fehlgeschlagen ({type(e).__name__})")


class GarminUnofficialProvider:
    """Implementiert das HealthDataProvider-Protocol via garminconnect.

    `api` ist injizierbar (Tests: Fixture-Fake mit denselben Methodennamen).
    """

    provider_type = PROVIDER_TYPE

    def __init__(self, api: Any = None) -> None:
        self._api = api
        # Bei MfaRequired gehaltene Live-Login-Instanz (gleicher Prozess).
        self._pending_garmin: Any = None

    # -- Kategorie->Metrik-Vertrag für die Capability-Maschine ----------------
    @property
    def daily_category_metrics(self) -> dict[str, list[str]]:
        return {k: list(v[1]) for k, v in normalize.DAILY_CATEGORIES.items()}

    @property
    def performance_category_metrics(self) -> dict[str, list[str]]:
        return {k: list(v[1]) for k, v in normalize.PERFORMANCE_CATEGORIES.items()}

    # -- Auth -----------------------------------------------------------------

    def _new_garmin(self, email: str | None = None, password: str | None = None):
        from garminconnect import Garmin  # lazy: import-safe für Tests

        return Garmin(email=email, password=password, return_on_mfa=True)

    def connect(self, email: str, password: str, mfa_code: str | None = None) -> str:
        """Login mit Credentials. Rückgabe: Token-String (client.dumps()).

        Passwort wird nur transient für diesen Request verwendet und nie
        gespeichert oder geloggt. Bei MFA ohne Code -> MfaRequired mit
        serialisierbarem client_state.
        """
        garmin = self._new_garmin(email, password)
        try:
            mfa_status, _ = garmin.login()
        except Exception as e:
            raise _map_exception(e) from None
        if mfa_status == "needs_mfa":
            if mfa_code:
                return self._complete_mfa(garmin, mfa_code)
            self._pending_garmin = garmin
            raise MfaRequired(self._serialize_mfa_state(garmin))
        self._api = garmin
        return garmin.client.dumps()

    def resume_mfa(self, client_state: dict, mfa_code: str) -> str:
        """MFA-Fortsetzung aus serialisiertem Zustand (Prozess-Neustart-Fall)."""
        garmin = self._new_garmin()
        try:
            self._restore_mfa_state(garmin, client_state)
        except Exception:
            raise AuthError("MFA-Zustand nicht wiederherstellbar") from None
        return self._complete_mfa(garmin, mfa_code)

    def resume_mfa_live(self, garmin: Any, mfa_code: str) -> str:
        """MFA-Fortsetzung mit noch lebender Garmin-Instanz (gleicher Prozess)."""
        return self._complete_mfa(garmin, mfa_code)

    def resume_pending(self, mfa_code: str) -> str:
        """MFA-Fortsetzung mit der bei connect() gehaltenen Instanz."""
        if self._pending_garmin is None:
            raise AuthError("Kein offener MFA-Vorgang in diesem Prozess")
        tokens = self._complete_mfa(self._pending_garmin, mfa_code)
        self._pending_garmin = None
        return tokens

    def _complete_mfa(self, garmin: Any, mfa_code: str) -> str:
        try:
            garmin.client.resume_login(None, mfa_code)
        except Exception as e:
            raise _map_exception(e) from None
        self._api = garmin
        return garmin.client.dumps()

    def login_with_tokens(self, token_str: str) -> None:
        """Session aus gespeicherten Tokens (>512 Zeichen -> als String erkannt)."""
        garmin = self._new_garmin()
        try:
            garmin.login(token_str)
        except Exception as e:
            raise _map_exception(e) from None
        self._api = garmin

    # -- MFA-Zustand serialisieren -------------------------------------------
    # garminconnect 0.3.2 hält den MFA-Zwischenzustand auf der Client-Instanz
    # (_mfa_session mit Cookies, _mfa_login_params, _mfa_post_headers, ...).
    # Für Prozess-Neustarts serialisieren wir die reinen Daten + Cookies und
    # bauen die Session beim Resume neu auf.
    # FIXTURE-ANNAHME: gegen Live-API verifizieren — Cookie-basierte
    # MFA-Session-Rekonstruktion; primärer Pfad ist die im Prozess gehaltene
    # Live-Instanz (api.py PENDING_MFA).

    @staticmethod
    def _serialize_mfa_state(garmin: Any) -> dict:
        client = garmin.client
        cookies: dict[str, str] = {}
        sess = getattr(client, "_mfa_session", None)
        jar = getattr(sess, "cookies", None)
        if jar is not None:
            try:
                cookies = dict(jar.get_dict())  # requests + curl_cffi
            except Exception:
                try:
                    cookies = {c.name: c.value for c in jar}
                except Exception:
                    cookies = {}
        return {
            "flow": getattr(client, "_mfa_flow", "portal"),
            "method": getattr(client, "_mfa_method", "email"),
            "login_params": dict(getattr(client, "_mfa_login_params", {}) or {}),
            "post_headers": dict(getattr(client, "_mfa_post_headers", {}) or {}),
            "service_url": getattr(client, "_mfa_service_url", None),
            "cookies": cookies,
        }

    @staticmethod
    def _restore_mfa_state(garmin: Any, state: dict) -> None:
        client = garmin.client
        client._mfa_flow = state.get("flow", "portal")
        client._mfa_method = state.get("method", "email")
        client._mfa_login_params = dict(state.get("login_params", {}))
        client._mfa_post_headers = dict(state.get("post_headers", {}))
        if state.get("service_url"):
            client._mfa_service_url = state["service_url"]
        try:
            from curl_cffi import requests as cffi_requests  # type: ignore

            sess = cffi_requests.Session(impersonate="chrome")
        except Exception:
            import requests as _requests

            sess = _requests.Session()
        for name, value in (state.get("cookies") or {}).items():
            try:
                sess.cookies.set(name, value)
            except Exception:
                continue
        client._mfa_session = sess

    # -- Abrufe ---------------------------------------------------------------

    def _require_api(self) -> Any:
        if self._api is None:
            raise AuthError("Provider nicht eingeloggt")
        return self._api

    def _call(self, fn: Callable, *args) -> Any:
        try:
            return fn(*args)
        except Exception as e:
            mapped = _map_exception(e)
            logger.warning("Garmin-Abruf %s: %s", getattr(fn, "__name__", "?"), mapped.code)
            raise mapped from None

    def get_devices(self) -> list[NormalizedDevice]:
        api = self._require_api()
        raw = self._call(api.get_devices)
        last_used_id = None
        primary_id = None
        try:
            last_used = api.get_device_last_used()
            # FIXTURE-ANNAHME: gegen Live-API verifizieren — Feld lastUsedDeviceId.
            if isinstance(last_used, dict):
                last_used_id = last_used.get("lastUsedDeviceId")
        except Exception:
            pass  # optionaler Kontext — Geräteliste bleibt gültig
        try:
            primary = api.get_primary_training_device()
            # FIXTURE-ANNAHME: gegen Live-API verifizieren — Feld
            # primaryTrainingDevice.deviceId.
            if isinstance(primary, dict):
                primary_id = (
                    (primary.get("primaryTrainingDevice") or {}).get("deviceId")
                    if isinstance(primary.get("primaryTrainingDevice"), dict)
                    else primary.get("deviceId")
                )
        except Exception:
            pass
        return normalize.normalize_devices(raw, last_used_id, primary_id)

    def get_profile_metrics(self) -> dict[str, Any]:
        api = self._require_api()
        out: dict[str, Any] = {}
        try:
            full_name = api.get_full_name()
            if full_name:
                out["displayName"] = full_name
        except Exception:
            pass
        try:
            unit_system = api.get_unit_system()
            if unit_system:
                out["unitSystem"] = unit_system
        except Exception:
            pass
        return out

    def _fetch_daily_raw(self, category: str, d: str) -> Any:
        api = self._require_api()
        if category == "summary":
            return self._call(api.get_user_summary, d)
        if category == "rhr":
            return self._call(api.get_rhr_day, d)
        if category == "hrv":
            return self._call(api.get_hrv_data, d)
        if category == "sleep":
            return self._call(api.get_sleep_data, d)
        if category == "stress":
            return self._call(api.get_stress_data, d)
        if category == "body_battery":
            return self._call(api.get_body_battery, d, d)
        if category == "spo2":
            return self._call(api.get_spo2_data, d)
        if category == "respiration":
            return self._call(api.get_respiration_data, d)
        if category == "floors":
            return self._call(api.get_floors, d)
        if category == "intensity":
            return self._call(api.get_intensity_minutes_data, d)
        if category == "training_readiness":
            return self._call(api.get_training_readiness, d)
        if category == "weigh_ins":
            return self._call(api.get_daily_weigh_ins, d)
        if category == "body_composition":
            return self._call(api.get_body_composition, d, d)
        raise ValueError(f"Unbekannte Tages-Kategorie: {category}")

    def get_daily_metrics(self, category: str, metric_date: str) -> list[NormalizedMetric]:
        if category == "sleep":
            return self.get_sleep(metric_date)
        if category in ("weigh_ins", "body_composition"):
            return self.get_body_composition_metrics(category, metric_date)
        raw = self._fetch_daily_raw(category, metric_date)
        return normalize.normalize_category(
            category, raw, provider=self.provider_type, metric_date=metric_date
        )

    def get_sleep(self, metric_date: str) -> list[NormalizedMetric]:
        raw = self._fetch_daily_raw("sleep", metric_date)
        return normalize.normalize_category(
            "sleep", raw, provider=self.provider_type, metric_date=metric_date
        )

    def get_body_composition_metrics(
        self, category: str, metric_date: str
    ) -> list[NormalizedMetric]:
        raw = self._fetch_daily_raw(category, metric_date)
        return normalize.normalize_category(
            category, raw, provider=self.provider_type, metric_date=metric_date
        )

    # Protocol-Alias (base.py): Körperzusammensetzung eines Tages.
    def get_body_composition(self, metric_date: str) -> list[NormalizedMetric]:
        return self.get_body_composition_metrics("body_composition", metric_date)

    def get_performance_metrics(self, category: str, metric_date: str) -> list[NormalizedMetric]:
        api = self._require_api()
        if category == "training_status":
            raw = self._call(api.get_training_status, metric_date)
        elif category == "max_metrics":
            raw = self._call(api.get_max_metrics, metric_date)
        elif category == "race_predictions":
            raw = self._call(api.get_race_predictions)
        elif category == "endurance":
            raw = self._call(api.get_endurance_score, metric_date, metric_date)
        elif category == "hill":
            raw = self._call(api.get_hill_score, metric_date, metric_date)
        elif category == "running_tolerance":
            raw = self._call(api.get_running_tolerance, metric_date, metric_date)
        elif category == "lactate":
            raw = self._call(lambda: api.get_lactate_threshold(latest=True))
        elif category == "ftp":
            raw = self._call(api.get_cycling_ftp)
        elif category == "fitness_age":
            raw = self._call(api.get_fitnessage_data, metric_date)
        else:
            raise ValueError(f"Unbekannte Leistungs-Kategorie: {category}")
        return normalize.normalize_category(
            category, raw, provider=self.provider_type, metric_date=metric_date
        )

    def get_activities(self, start_date: str, end_date: str) -> list[NormalizedActivity]:
        api = self._require_api()
        raw = self._call(api.get_activities_by_date, start_date, end_date)
        out: list[NormalizedActivity] = []
        for entry in raw if isinstance(raw, list) else []:
            act = normalize.normalize_activity(entry)
            if act is not None:
                out.append(act)
        return out
