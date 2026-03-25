#!/usr/bin/env bash
set -euo pipefail

# Trade Import Dashboard deployment script
# Usage:
#   DOMAIN=your-domain.example.com ./deploy.sh
# Optional overrides:
#   APP_NAME=tradeimport-dashboard APP_PORT=8081 APP_BASE_DIR=/var/www ./deploy.sh
#   BACKEND_SERVICE_NAME=tradeimport-dashboard ./deploy.sh

DOMAIN="${DOMAIN:-}"
APP_NAME="${APP_NAME:-tradeimport-dashboard}"
APP_PORT="${APP_PORT:-8081}"
APP_BASE_DIR="${APP_BASE_DIR:-/var/www}"
APP_DIR="${APP_BASE_DIR}/${APP_NAME}"
BACKEND_SERVICE_NAME="${BACKEND_SERVICE_NAME:-${APP_NAME}}"

# Optional DB vars for first-time env file creation only.
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USER:-}"
DB_PASSWORD="${DB_PASSWORD:-}"
DB_NAME="${DB_NAME:-}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ -z "${DOMAIN}" ]]; then
  echo "ERROR: DOMAIN is required. Example: DOMAIN=dashboard.example.com ./deploy.sh"
  exit 1
fi

if [[ "${EUID}" -eq 0 ]]; then
  SUDO=""
else
  SUDO="sudo"
fi

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "ERROR: '$1' is not installed or not in PATH"
    exit 1
  }
}

require_cmd rsync
require_cmd go
require_cmd npm
require_cmd nginx
require_cmd systemctl

echo "==> Deploying ${APP_NAME} to ${APP_DIR}"
echo "==> Using domain: ${DOMAIN}"

echo "==> Ensuring deployment directories"
${SUDO} mkdir -p "${APP_DIR}/backend" "${APP_DIR}/frontend"
${SUDO} chown -R "${USER}:${USER}" "${APP_DIR}"

echo "==> Building backend binary"
cd "${SCRIPT_DIR}/backend"
go mod tidy
go build -o "${APP_DIR}/backend/${APP_NAME}-server" ./cmd/server

ENV_FILE="${APP_DIR}/backend/.env"
if [[ ! -f "${ENV_FILE}" ]]; then
  if [[ -z "${DB_USER}" || -z "${DB_PASSWORD}" || -z "${DB_NAME}" ]]; then
    echo "ERROR: ${ENV_FILE} does not exist. For first deploy, provide DB_USER, DB_PASSWORD, and DB_NAME."
    echo "Example: DOMAIN=${DOMAIN} DB_USER=appuser DB_PASSWORD=secret DB_NAME=tradeimportdb ./deploy.sh"
    exit 1
  fi

  echo "==> Creating backend env file (first deploy)"
  cat > "${ENV_FILE}" <<EOF
APP_PORT=${APP_PORT}
DB_HOST=${DB_HOST}
DB_PORT=${DB_PORT}
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}
DB_NAME=${DB_NAME}
ALLOWED_ORIGIN=https://${DOMAIN}
EOF
else
  echo "==> Backend env exists at ${ENV_FILE} (kept as-is)"
fi

echo "==> Building frontend"
cd "${SCRIPT_DIR}/frontend"
if ! npm ci; then
  echo "==> npm ci failed (lock file out of sync). Falling back to npm install."
  npm install
fi
npm run build -- --configuration production

FRONT_BUILD_DIR="${SCRIPT_DIR}/frontend/dist/shila-dashboard/browser"
if [[ ! -d "${FRONT_BUILD_DIR}" ]]; then
  FRONT_BUILD_DIR="${SCRIPT_DIR}/frontend/dist/shila-dashboard"
fi

if [[ ! -d "${FRONT_BUILD_DIR}" ]]; then
  echo "ERROR: Frontend build output not found in dist/shila-dashboard[/browser]"
  exit 1
fi

echo "==> Syncing frontend assets"
rsync -av --delete "${FRONT_BUILD_DIR}/" "${APP_DIR}/frontend/"

INDEX_FILE="${APP_DIR}/frontend/index.html"
if [[ ! -f "${INDEX_FILE}" ]]; then
  echo "ERROR: ${INDEX_FILE} not found after frontend sync"
  exit 1
fi

echo "==> Injecting runtime API base into frontend index"
if grep -q 'window.SHILA_API_BASE=' "${INDEX_FILE}"; then
  sed -i 's#window.SHILA_API_BASE=.*#window.SHILA_API_BASE="https://'"${DOMAIN}"'/api";</script>#g' "${INDEX_FILE}"
else
  sed -i '/<head>/a\  <script>window.SHILA_API_BASE="https://'"${DOMAIN}"'/api";</script>' "${INDEX_FILE}"
fi

echo "==> Writing systemd service: ${BACKEND_SERVICE_NAME}.service"
${SUDO} tee "/etc/systemd/system/${BACKEND_SERVICE_NAME}.service" >/dev/null <<EOF
[Unit]
Description=Trade Import Dashboard Backend
After=network.target mysql.service

[Service]
User=www-data
Group=www-data
WorkingDirectory=${APP_DIR}/backend
ExecStart=${APP_DIR}/backend/${APP_NAME}-server
Restart=always
RestartSec=5
Environment=GIN_MODE=release

[Install]
WantedBy=multi-user.target
EOF

echo "==> Writing Nginx site: /etc/nginx/sites-available/${APP_NAME}"
${SUDO} tee "/etc/nginx/sites-available/${APP_NAME}" >/dev/null <<EOF
server {
    listen 80;
    server_name ${DOMAIN};

    root ${APP_DIR}/frontend;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location /api/ {
      proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

if [[ ! -L "/etc/nginx/sites-enabled/${APP_NAME}" ]]; then
  ${SUDO} ln -s "/etc/nginx/sites-available/${APP_NAME}" "/etc/nginx/sites-enabled/${APP_NAME}"
fi

CERT_FULLCHAIN="/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"
CERT_PRIVKEY="/etc/letsencrypt/live/${DOMAIN}/privkey.pem"
if [[ -f "${CERT_FULLCHAIN}" && -f "${CERT_PRIVKEY}" ]]; then
  echo "==> SSL certificate found. Enabling HTTPS server block."
  ${SUDO} tee "/etc/nginx/sites-available/${APP_NAME}" >/dev/null <<EOF
server {
    listen 80;
    server_name ${DOMAIN};
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name ${DOMAIN};

    ssl_certificate ${CERT_FULLCHAIN};
    ssl_certificate_key ${CERT_PRIVKEY};

    root ${APP_DIR}/frontend;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location /api/ {
      proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF
fi

echo "==> Setting ownership and permissions"
${SUDO} chown -R www-data:www-data "${APP_DIR}"
${SUDO} find "${APP_DIR}" -type d -exec chmod 755 {} \;
${SUDO} find "${APP_DIR}" -type f -exec chmod 644 {} \;
${SUDO} chmod 755 "${APP_DIR}/backend/${APP_NAME}-server"

echo "==> Reloading services"
${SUDO} systemctl daemon-reload
${SUDO} systemctl enable "${BACKEND_SERVICE_NAME}"
${SUDO} systemctl restart "${BACKEND_SERVICE_NAME}"
${SUDO} nginx -t
${SUDO} systemctl reload nginx

echo "==> Deployment completed"
echo "Backend service status:"
${SUDO} systemctl --no-pager --full status "${BACKEND_SERVICE_NAME}" | sed -n '1,15p'

echo ""
echo "If HTTPS is not enabled yet, run:"
echo "  sudo certbot --nginx -d ${DOMAIN}"
