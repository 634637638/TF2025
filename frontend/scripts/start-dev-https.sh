#!/usr/bin/env bash

set -euo pipefail

TF_FRONTEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ ! -s "${TF_FRONTEND_DIR}/ssl/local-dev-key.pem" || ! -s "${TF_FRONTEND_DIR}/ssl/local-dev-cert.pem" ]]; then
  echo "HTTPS 开发证书尚未就绪，请先在前端目录执行 npm run cert:local -- <本机局域网 IP>。" >&2
  exit 1
fi

cd "${TF_FRONTEND_DIR}"
export TF_USE_HTTPS=true
echo "正在启动 HTTPS 开发服务，访问地址以 Vite 输出为准。"
exec npm run dev -- "$@"
