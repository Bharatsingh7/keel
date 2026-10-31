# OrbitDock - Next-Gen Intelligent Docker Container Platform
FROM python:3.12-slim

WORKDIR /app

# Install system dependencies (curl, docker CLI client)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install uv package manager
COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

# Copy project files
COPY pyproject.toml /app/
RUN uv pip install --system --no-cache -r <(uv pip compile pyproject.toml)

COPY orbitdock/ /app/orbitdock/

EXPOSE 9090

ENV ORBITDOCK_PORT=9090
ENV ORBITDOCK_HOST=0.0.0.0
ENV DOCKER_HOST=unix:///var/run/docker.sock

CMD ["python", "-m", "orbitdock.main", "--port", "9090", "--host", "0.0.0.0"]
