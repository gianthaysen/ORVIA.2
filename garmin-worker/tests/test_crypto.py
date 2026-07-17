import pytest
from cryptography.fernet import Fernet

from orvia_worker.crypto import CryptoError, TokenCrypto


def _crypto(version=1):
    return TokenCrypto({version: Fernet.generate_key().decode()}, version)


def test_roundtrip():
    c = _crypto()
    ciphertext, version = c.encrypt_str("geheimer-token-string")
    assert version == 1
    assert ciphertext != "geheimer-token-string"
    assert c.decrypt_str(ciphertext, version) == "geheimer-token-string"


def test_wrong_key_fails():
    c1 = _crypto()
    c2 = _crypto()
    ciphertext, version = c1.encrypt_str("abc")
    with pytest.raises(CryptoError):
        c2.decrypt_str(ciphertext, version)


def test_key_version_rotation():
    old_key = Fernet.generate_key().decode()
    old = TokenCrypto({1: old_key}, 1)
    ciphertext, _ = old.encrypt_str("legacy-token")

    new = TokenCrypto({1: old_key, 2: Fernet.generate_key().decode()}, 2)
    # alte Version bleibt entschlüsselbar
    assert new.decrypt_str(ciphertext, 1) == "legacy-token"
    # neue Verschlüsselung nutzt aktive Version
    ct2, v2 = new.encrypt_str("new-token")
    assert v2 == 2
    assert new.decrypt_str(ct2, 2) == "new-token"


def test_unknown_key_version_raises():
    c = _crypto()
    ciphertext, _ = c.encrypt_str("x")
    with pytest.raises(CryptoError):
        c.decrypt_str(ciphertext, 99)


def test_missing_active_key_raises():
    with pytest.raises(CryptoError):
        TokenCrypto({1: Fernet.generate_key().decode()}, 2)
