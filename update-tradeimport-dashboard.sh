#!/usr/bin/env bash
set -euo pipefail

# Quick update script for Trade Import Dashboard on VPS.
# Run from anywhere: bash /var/www/tradeimport-dashboard-src/update-tradeimport-dashboard.sh

REPO_DIR="${REPO_DIR:-/var/www/tradeimport-dashboard-src}"
DOMAIN="${DOMAIN:-shila-dashboard.duckdns.org}"
SERVICE_NAME="${SERVICE_NAME:-tradeimport-dashboard}"

# Use isolated Go toolchain if available, otherwise keep current PATH.
if [[ -x "/opt/go1.22.12/bin/go" ]]; then
  export PATH="/opt/go1.22.12/bin:${PATH}"
fi
export GOTOOLCHAIN="${GOTOOLCHAIN:-local}"

echo "==> Updating Trade Import Dashboard"
echo "==> Repo: ${REPO_DIR}"
echo "==> Domain: ${DOMAIN}"

cd "${REPO_DIR}"

echo "==> Pulling latest changes"
git pull

echo "==> Running deployment"
SKIP_NGINX_CONFIG=1 DOMAIN="${DOMAIN}" bash deploy.sh

echo "==> Checking backend service"
sudo systemctl status "${SERVICE_NAME}" --no-pager -l | sed -n '1,20p'

echo "==> Health checks"
curl -fsS "http://127.0.0.1:8081/health"
echo
curl -fsS "https://${DOMAIN}/api/sla" >/dev/null
echo "HTTPS API check: OK"

echo "==> Update completed successfully"
