# Inventory fingerprint normalization

- Corrected on 2026-09-30 after the publication seal detected a fingerprint mismatch.
- Original browser inventory fingerprint: `d50a014a5d7909e4dbc84c037abcd4b3c9b33f22135223b7e6cc15131c374282`.
- Canonical repository fingerprint: `737f6acf105de30a425a51b135fd2b8026a8c49699d12efc0c5e4291cf1aa8ca`.
- The difference is only line-ending normalization: `scripts/inventory.mjs` hashes UTF-8 text after converting CRLF to LF.
- Verified all 57 original inventory inputs against the current files: 57 matched byte-for-byte using the original method, 20 also matched after normalization, and none mismatched.
- The original inventory remains in `inventory-skill.json`; `inventory.json`, `observations.json`, and the reproducibility builder now use the canonical fingerprint. Observation rows and timestamps were not changed.
