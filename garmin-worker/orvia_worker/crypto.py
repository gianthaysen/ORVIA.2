"""Fernet-Verschlüsselung für Provider-Credentials.

key_version-fähig: der aktive Key verschlüsselt, alte Keys (nach Rotation)
können weiterhin entschlüsseln. Klartext-Tokens verlassen dieses Modul nie
Richtung Logs.
"""

from __future__ import annotations

from cryptography.fernet import Fernet, InvalidToken


class CryptoError(RuntimeError):
    """Ver-/Entschlüsselung fehlgeschlagen (ohne sensible Details)."""


class TokenCrypto:
    def __init__(self, keys: dict[int, str], active_version: int) -> None:
        if active_version not in keys:
            raise CryptoError(f"Aktive key_version {active_version} hat keinen Key")
        self._fernets: dict[int, Fernet] = {}
        for version, key in keys.items():
            try:
                self._fernets[version] = Fernet(key.encode("utf-8"))
            except Exception as e:  # ungültiges Key-Format
                raise CryptoError(f"Ungültiger Fernet-Key für version {version}") from e
        self.active_version = active_version

    @classmethod
    def from_settings(cls, settings) -> "TokenCrypto":
        keys = dict(settings.token_encryption_legacy_keys)
        keys[settings.token_encryption_key_version] = settings.token_encryption_key
        return cls(keys, settings.token_encryption_key_version)

    def encrypt_str(self, plain: str) -> tuple[str, int]:
        """Verschlüsselt mit dem aktiven Key; Rückgabe (ciphertext, key_version)."""
        token = self._fernets[self.active_version].encrypt(plain.encode("utf-8"))
        return token.decode("utf-8"), self.active_version

    def decrypt_str(self, ciphertext: str, key_version: int) -> str:
        fernet = self._fernets.get(key_version)
        if fernet is None:
            raise CryptoError(f"Kein Key für key_version {key_version}")
        try:
            return fernet.decrypt(ciphertext.encode("utf-8")).decode("utf-8")
        except InvalidToken as e:
            raise CryptoError("Entschlüsselung fehlgeschlagen") from e
