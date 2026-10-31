"""Embedded SQLite database for OrbitDock persistent state and audit logs."""
import sqlite3
import json
from typing import Any, Dict, List, Optional
from datetime import datetime, timezone
from orbitdock.backend.core.config import DB_PATH

def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def init_db() -> None:
    """Initialize database tables with WAL mode for high concurrency."""
    with get_connection() as conn:
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.execute("PRAGMA synchronous=NORMAL;")
        
        # User settings / preferences
        conn.execute("""
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
        """)
        
        # Stacks metadata
        conn.execute("""
            CREATE TABLE IF NOT EXISTS stacks (
                name TEXT PRIMARY KEY,
                path TEXT NOT NULL,
                compose_content TEXT NOT NULL,
                env_content TEXT DEFAULT '',
                status TEXT DEFAULT 'stopped',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
        """)
        
        # Audit & Event logs (autoheal actions, security audits, container restarts)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS audit_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                event_type TEXT NOT NULL,
                target_type TEXT NOT NULL,
                target_id TEXT NOT NULL,
                target_name TEXT NOT NULL,
                details TEXT NOT NULL
            );
        """)
        
        # Historical metrics snapshots for memory leak analysis
        conn.execute("""
            CREATE TABLE IF NOT EXISTS metrics_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                container_id TEXT NOT NULL,
                timestamp REAL NOT NULL,
                cpu_percent REAL NOT NULL,
                mem_bytes REAL NOT NULL,
                mem_limit REAL NOT NULL
            );
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_metrics_container ON metrics_history(container_id, timestamp);")
        conn.commit()

def log_event(event_type: str, target_type: str, target_id: str, target_name: str, details: Dict[str, Any]) -> None:
    now = datetime.now(timezone.utc).isoformat()
    with get_connection() as conn:
        conn.execute(
            "INSERT INTO audit_logs (timestamp, event_type, target_type, target_id, target_name, details) VALUES (?, ?, ?, ?, ?, ?)",
            (now, event_type, target_type, target_id, target_name, json.dumps(details))
        )
        conn.commit()

def get_recent_audit_logs(limit: int = 50) -> List[Dict[str, Any]]:
    with get_connection() as conn:
        cursor = conn.execute("SELECT * FROM audit_logs ORDER BY id DESC LIMIT ?", (limit,))
        rows = cursor.fetchall()
        result = []
        for r in rows:
            result.append({
                "id": r["id"],
                "timestamp": r["timestamp"],
                "event_type": r["event_type"],
                "target_type": r["target_type"],
                "target_id": r["target_id"],
                "target_name": r["target_name"],
                "details": json.loads(r["details"]) if r["details"] else {}
            })
        return result

def save_setting(key: str, value: Any) -> None:
    now = datetime.now(timezone.utc).isoformat()
    with get_connection() as conn:
        conn.execute(
            "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at",
            (key, json.dumps(value), now)
        )
        conn.commit()

def get_setting(key: str, default: Any = None) -> Any:
    with get_connection() as conn:
        cursor = conn.execute("SELECT value FROM settings WHERE key = ?", (key,))
        row = cursor.fetchone()
        if row:
            try:
                return json.loads(row["value"])
            except Exception:
                return row["value"]
        return default
