import sqlite3
import json
import os

# Connect to server SQLite database
conn = sqlite3.connect("/opt/mnrouter/data/mnrouter.db")
c = conn.cursor()

# 1. Clear old kiro models
c.execute("DELETE FROM models WHERE provider = 'kiro'")
print("Cleared old kiro models from server DB")

# 2. Insert new 8 Kiro models
models = [
    ("qwen3-coder-next", "kiro", "qwen3-coder-next", "Qwen3 Coder Next (Kiro)", 1, 5, 200000, 32000, 0, 0, 0, 0),
    ("deepseek-3.2", "kiro", "deepseek-3.2", "DeepSeek 3.2 (Kiro)", 1, 10, 200000, 32000, 0, 0, 0, 0),
    ("minimax-m2.5", "kiro", "minimax-m2.5", "MiniMax M2.5 (Kiro)", 1, 15, 200000, 32000, 0, 0, 0, 0),
    ("glm-5", "kiro", "glm-5", "GLM 5 (Kiro)", 1, 20, 200000, 32000, 0, 0, 0, 0),
    ("claude-sonnet-4.5-thinking", "kiro", "claude-sonnet-4.5", "Claude Sonnet 4.5 (Thinking) (Kiro)", 1, 25, 200000, 64000, 0, 0, 0, 0),
    ("claude-sonnet-4.5", "kiro", "claude-sonnet-4.5", "Claude Sonnet 4.5 (Kiro)", 1, 30, 200000, 64000, 0, 0, 0, 0),
    ("claude-sonnet-4", "kiro", "claude-sonnet-4", "Claude Sonnet 4 (Kiro)", 1, 35, 200000, 64000, 0, 0, 0, 0),
    ("claude-haiku-4.5", "kiro", "claude-haiku-4.5", "Claude Haiku 4.5 (Kiro)", 1, 40, 200000, 64000, 0, 0, 0, 0),
]

for m in models:
    c.execute("""
        INSERT INTO models (id, provider, upstream_model, display_name, enabled, priority, context_window, max_output, price_in, price_out, price_cache_read, price_cache_write, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch() * 1000)
        ON CONFLICT(id) DO UPDATE SET
            upstream_model = excluded.upstream_model,
            display_name = excluded.display_name,
            enabled = excluded.enabled,
            priority = excluded.priority,
            context_window = excluded.context_window,
            max_output = excluded.max_output,
            price_in = excluded.price_in,
            price_out = excluded.price_out
    """, m)
print(f"Inserted/updated {len(models)} Kiro models on server DB")

# 3. Read accounts JSON
with open("/opt/mnrouter/scripts/kiro-accounts.json") as f:
    accounts = json.load(f)

# Delete existing kiro connections
c.execute("DELETE FROM provider_connections WHERE provider = 'kiro'")
print("Cleared old kiro connections from server DB")

import uuid
for acc in accounts:
    cid = str(uuid.uuid4())
    data = {
        "accessToken": acc["accessToken"],
        "refreshToken": acc["refreshToken"],
        "expiresAt": acc["expiresAt"],
        "email": acc["email"],
        "ssoOnly": True,
        "ssoClientId": acc["clientId"],
        "ssoClientSecret": acc["clientSecret"],
        "ssoRegion": "us-east-1"
    }
    c.execute("""
        INSERT INTO provider_connections (id, provider, label, auth_type, priority, is_active, status, data, created_at, updated_at)
        VALUES (?, 'kiro', ?, 'oauth', 50, 1, 'active', ?, unixepoch() * 1000, unixepoch() * 1000)
    """, (cid, acc["label"], json.dumps(data)))
    print(f"+ Inserted Kiro account: {acc['label']}")

conn.commit()
conn.close()
print("All done successfully on server SQLite database!")
