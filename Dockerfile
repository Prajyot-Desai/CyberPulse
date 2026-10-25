# ==============================================================================
# CyberPulse — Multi-Stage Production Dockerfile
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Frontend Build Stage
# ------------------------------------------------------------------------------
FROM node:20-alpine AS frontend-builder

WORKDIR /build/frontend

# Copy package manifests first for reproducible dependency caching
COPY frontend/package.json frontend/package-lock.json ./

# Deterministic clean install using lockfile
RUN npm ci

# Copy frontend source code and configuration
COPY frontend/ ./

# Run production build (tsc -b && vite build)
RUN npm run build

# ------------------------------------------------------------------------------
# Stage 2: Production Python Runtime Stage
# ------------------------------------------------------------------------------
FROM python:3.12-slim AS runner

# Optimize Python execution in container
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/backend \
    PORT=8000 \
    BACKEND_HOST=0.0.0.0 \
    FRONTEND_DIST_DIR=/app/frontend/dist

WORKDIR /app

# Create a non-root system group and user
RUN groupadd -r cyberpulse && useradd -r -g cyberpulse -d /app -s /sbin/nologin cyberpulse

# Install backend dependencies
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy backend application code
COPY backend/app ./backend/app

# Copy built frontend assets from builder stage
COPY --from=frontend-builder --chown=cyberpulse:cyberpulse /build/frontend/dist ./frontend/dist

# Ensure proper non-root ownership
RUN chown -R cyberpulse:cyberpulse /app

# Switch to non-root user
USER cyberpulse

# Expose default HTTP port
EXPOSE 8000

# Health check probe against root /health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request, os; port = os.environ.get('PORT', '8000'); urllib.request.urlopen(f'http://127.0.0.1:{port}/health')" || exit 1

# Start Uvicorn bound to 0.0.0.0 with dynamic $PORT support
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --app-dir backend"]
