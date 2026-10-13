#!/bin/bash
# ============================================================
# Install / reinstall BotVPN2 (Ripzz Store) - ANTI TUMPANG TINDIH
# Jalankan sebagai root di VPS:
#   bash <(curl -sL https://raw.githubusercontent.com/ajijainalganteng-wq/BotVPN2/main/install.sh)
# Script ini memastikan hanya 1 instance bot yang jalan (via PM2).
# ============================================================
set -u

REPO="https://github.com/ajijainalganteng-wq/BotVPN2.git"
DIR="/root/BotVPN2"
PMNAME="ripzz-store-ppob"

echo "==> 1/5 Matikan SEMUA instance bot lama (agar tidak tumpang tindih)..."
pm2 delete "$PMNAME" 2>/dev/null
pkill -f "[n]ode $DIR/app.js" 2>/dev/null
sleep 2

echo "==> 2/5 Pastikan node & pm2 terinstall..."
command -v node >/dev/null || { apt-get update -qq && apt-get install -y -qq nodejs npm; }
command -v pm2 >/dev/null || npm i -g pm2 --no-audit --no-fund

echo "==> 3/5 Ambil kode terbaru..."
if [ -d "$DIR/.git" ]; then
  git -C "$DIR" pull --ff-only
else
  git clone "$REPO" "$DIR"
fi

echo "==> 4/5 Install dependencies..."
cd "$DIR" && npm install --omit=dev --no-audit --no-fund 2>&1 | tail -1

echo "==> 5/5 Jalankan 1 instance via PM2..."
pm2 start "$DIR/app.js" --name "$PMNAME"
pm2 save >/dev/null 2>&1

echo ""
echo "OK - bot jalan 1 instance via PM2 (cek: pm2 ls | grep $PMNAME)"
echo "Mulai sekarang JANGAN start manual pakai nohup - cukup jalankan script ini."
