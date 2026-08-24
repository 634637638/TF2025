#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
CERT_DIR="${FRONTEND_DIR}/ssl"
CONFIG_FILE="${SCRIPT_DIR}/local-https-openssl.cnf"
TF_LOCAL_IP="${1:-}"

if [[ -z "${TF_LOCAL_IP}" ]] && command -v ipconfig >/dev/null 2>&1; then
  TF_LOCAL_IP="$(ipconfig getifaddr en0 2>/dev/null || true)"
fi

if [[ -z "${TF_LOCAL_IP}" ]]; then
  echo "Usage: npm run cert:local -- <LAN-IP>" >&2
  exit 1
fi

export TF_LOCAL_IP
mkdir -p "${CERT_DIR}"

if [[ ! -f "${CERT_DIR}/local-ca-key.pem" || ! -f "${CERT_DIR}/local-ca.pem" ]]; then
  openssl genrsa -out "${CERT_DIR}/local-ca-key.pem" 2048
  openssl req -x509 -new -sha256 -days 3650 \
    -key "${CERT_DIR}/local-ca-key.pem" \
    -out "${CERT_DIR}/local-ca.pem" \
    -subj "/CN=TF2025 Local Development CA/O=TF2025"
fi

openssl genrsa -out "${CERT_DIR}/local-dev-key.pem" 2048
openssl req -new -sha256 \
  -key "${CERT_DIR}/local-dev-key.pem" \
  -out "${CERT_DIR}/local-dev.csr" \
  -config "${CONFIG_FILE}"
openssl x509 -req -sha256 -days 825 \
  -in "${CERT_DIR}/local-dev.csr" \
  -CA "${CERT_DIR}/local-ca.pem" \
  -CAkey "${CERT_DIR}/local-ca-key.pem" \
  -CAcreateserial \
  -out "${CERT_DIR}/local-dev-cert.pem" \
  -extfile "${CONFIG_FILE}" \
  -extensions v3_req
openssl x509 -in "${CERT_DIR}/local-ca.pem" -outform der -out "${CERT_DIR}/local-ca.cer"
rm -f "${CERT_DIR}/local-dev.csr" "${CERT_DIR}/local-ca.srl"

echo "Local HTTPS certificate created for localhost, 127.0.0.1 and ${TF_LOCAL_IP}."
echo "CA certificate for phones: ${CERT_DIR}/local-ca.cer"
