"""Curated 1-Click Launch Presets & Templates for popular container services."""
import secrets
from typing import Any, Dict, List

def generate_secure_password(length: int = 16) -> str:
    alphabet = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "".join(secrets.choice(alphabet) for _ in range(length))

def get_presets() -> List[Dict[str, Any]]:
    return [
        {
            "id": "postgres",
            "name": "PostgreSQL 16",
            "category": "Database",
            "icon": "database",
            "description": "Powerful open-source object-relational database system.",
            "image": "postgres:16-alpine",
            "default_port": 5432,
            "container_port": 5432,
            "volumes": [
                {"container_path": "/var/lib/postgresql/data", "host_path": "orbitdock_pg_data", "type": "volume"}
            ],
            "env": [
                {"key": "POSTGRES_USER", "value": "postgres"},
                {"key": "POSTGRES_PASSWORD", "value": generate_secure_password()},
                {"key": "POSTGRES_DB", "value": "app"}
            ],
            "restart_policy": "unless-stopped"
        },
        {
            "id": "redis",
            "name": "Redis 7",
            "category": "Database",
            "icon": "zap",
            "description": "In-memory data structure store used as a database, cache, and message broker.",
            "image": "redis:7-alpine",
            "default_port": 6379,
            "container_port": 6379,
            "volumes": [
                {"container_path": "/data", "host_path": "orbitdock_redis_data", "type": "volume"}
            ],
            "command": ["redis-server", "--appendonly", "yes"],
            "restart_policy": "unless-stopped"
        },
        {
            "id": "nginx",
            "name": "Nginx Alpine",
            "category": "Web Server",
            "icon": "globe",
            "description": "High-performance HTTP server and reverse proxy.",
            "image": "nginx:alpine",
            "default_port": 8080,
            "container_port": 80,
            "volumes": [
                {"container_path": "/usr/share/nginx/html", "host_path": "orbitdock_nginx_html", "type": "volume"}
            ],
            "restart_policy": "unless-stopped"
        },
        {
            "id": "mariadb",
            "name": "MariaDB 11",
            "category": "Database",
            "icon": "database",
            "description": "Fast, scalable, and robust open-source relational database.",
            "image": "mariadb:11",
            "default_port": 3306,
            "container_port": 3306,
            "volumes": [
                {"container_path": "/var/lib/mysql", "host_path": "orbitdock_mariadb_data", "type": "volume"}
            ],
            "env": [
                {"key": "MARIADB_ROOT_PASSWORD", "value": generate_secure_password()},
                {"key": "MARIADB_DATABASE", "value": "app"},
                {"key": "MARIADB_USER", "value": "appuser"},
                {"key": "MARIADB_PASSWORD", "value": generate_secure_password()}
            ],
            "restart_policy": "unless-stopped"
        },
        {
            "id": "mongodb",
            "name": "MongoDB 7",
            "category": "Database",
            "icon": "layers",
            "description": "Document-based distributed database designed for modern applications.",
            "image": "mongo:7",
            "default_port": 27017,
            "container_port": 27017,
            "volumes": [
                {"container_path": "/data/db", "host_path": "orbitdock_mongo_data", "type": "volume"}
            ],
            "env": [
                {"key": "MONGO_INITDB_ROOT_USERNAME", "value": "admin"},
                {"key": "MONGO_INITDB_ROOT_PASSWORD", "value": generate_secure_password()}
            ],
            "restart_policy": "unless-stopped"
        },
        {
            "id": "caddy",
            "name": "Caddy 2",
            "category": "Web Server",
            "icon": "shield-check",
            "description": "Enterprise-ready open-source web server with automatic HTTPS.",
            "image": "caddy:2-alpine",
            "default_port": 80,
            "container_port": 80,
            "volumes": [
                {"container_path": "/data", "host_path": "orbitdock_caddy_data", "type": "volume"},
                {"container_path": "/config", "host_path": "orbitdock_caddy_config", "type": "volume"}
            ],
            "restart_policy": "unless-stopped"
        },
        {
            "id": "grafana",
            "name": "Grafana OSS",
            "category": "Monitoring",
            "icon": "activity",
            "description": "Operational dashboards, metrics visualization, and alerting platform.",
            "image": "grafana/grafana:latest",
            "default_port": 3000,
            "container_port": 3000,
            "volumes": [
                {"container_path": "/var/lib/grafana", "host_path": "orbitdock_grafana_data", "type": "volume"}
            ],
            "restart_policy": "unless-stopped"
        },
        {
            "id": "uptime_kuma",
            "name": "Uptime Kuma",
            "category": "Monitoring",
            "icon": "radio",
            "description": "Self-hosted monitoring tool for HTTP, TCP, Ping, and DNS services.",
            "image": "louislam/uptime-kuma:1",
            "default_port": 3001,
            "container_port": 3001,
            "volumes": [
                {"container_path": "/app/data", "host_path": "orbitdock_kuma_data", "type": "volume"}
            ],
            "restart_policy": "unless-stopped"
        }
    ]
