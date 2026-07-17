"""Worker-Konfiguration aus Umgebungsvariablen.

Fail-fast bei fehlenden Pflicht-Variablen, aber import-safe: das Modul liest
die Umgebung erst, wenn `Settings.from_env()` / `get_settings()` aufgerufen
wird — Tests können `Settings` direkt mit Werten konstruieren.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field

REQUIRED_VARS = (
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "TOKEN_ENCRYPTION_KEY",
)


class ConfigError(RuntimeError):
    """Fehlende oder ungültige Worker-Konfiguration."""


def _int_env(env: dict, name: str, default: int) -> int:
    raw = (env.get(name) or "").strip()
    if not raw:
        return default
    try:
        return int(raw)
    except ValueError as e:
        raise ConfigError(f"{name} muss eine Ganzzahl sein, nicht {raw!r}") from e


def _parse_legacy_keys(raw: str) -> dict[int, str]:
    """Parst "1:key,2:key" zu {1: key, 2: key}."""
    out: dict[int, str] = {}
    for part in (raw or "").split(","):
        part = part.strip()
        if not part:
            continue
        version_str, _, key = part.partition(":")
        try:
            version = int(version_str)
        except ValueError as e:
            raise ConfigError(
                "TOKEN_ENCRYPTION_LEGACY_KEYS: Format 'version:key,version:key'"
            ) from e
        if not key:
            raise ConfigError("TOKEN_ENCRYPTION_LEGACY_KEYS: leerer Key")
        out[version] = key
    return out


@dataclass(frozen=True)
class Settings:
    supabase_url: str
    supabase_service_role_key: str
    token_encryption_key: str
    token_encryption_key_version: int = 1
    token_encryption_legacy_keys: dict[int, str] = field(default_factory=dict)
    sync_interval_minutes: int = 30
    sync_backfill_days: int = 30
    default_timezone: str = "Europe/Vienna"
    allowed_origins: tuple[str, ...] = ()
    port: int = 8000
    log_level: str = "INFO"

    @classmethod
    def from_env(cls, env: dict | None = None) -> "Settings":
        env = dict(os.environ) if env is None else env
        missing = [name for name in REQUIRED_VARS if not (env.get(name) or "").strip()]
        if missing:
            # Fail-fast, aber ohne Werte zu loggen (Secrets).
            raise ConfigError(
                "Fehlende Pflicht-Umgebungsvariablen: " + ", ".join(missing)
            )
        origins = tuple(
            o.strip()
            for o in (env.get("ALLOWED_ORIGINS") or "").split(",")
            if o.strip()
        )
        return cls(
            supabase_url=env["SUPABASE_URL"].strip().rstrip("/"),
            supabase_service_role_key=env["SUPABASE_SERVICE_ROLE_KEY"].strip(),
            token_encryption_key=env["TOKEN_ENCRYPTION_KEY"].strip(),
            token_encryption_key_version=_int_env(
                env, "TOKEN_ENCRYPTION_KEY_VERSION", 1
            ),
            token_encryption_legacy_keys=_parse_legacy_keys(
                env.get("TOKEN_ENCRYPTION_LEGACY_KEYS", "")
            ),
            sync_interval_minutes=_int_env(env, "SYNC_INTERVAL_MINUTES", 30),
            sync_backfill_days=_int_env(env, "SYNC_BACKFILL_DAYS", 30),
            default_timezone=(env.get("DEFAULT_TIMEZONE") or "Europe/Vienna").strip(),
            allowed_origins=origins,
            port=_int_env(env, "PORT", 8000),
            log_level=(env.get("LOG_LEVEL") or "INFO").strip().upper(),
        )


_settings: Settings | None = None


def get_settings() -> Settings:
    """Lazy Singleton — liest die Umgebung beim ersten Zugriff (fail-fast)."""
    global _settings
    if _settings is None:
        _settings = Settings.from_env()
    return _settings
