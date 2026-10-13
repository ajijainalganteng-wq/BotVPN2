#!/bin/bash
# Cara BENAR menjalankan bot Ripzz Store — pengganti nohup manual.
# Pakai: bot-ripzz
# - Membunuh instance liar (hasil start manual/nohup) agar tidak rebutan token Telegram
# - Menjalankan bot via PM2 (PM2 otomatis menghidupkan lagi bila proses mati; VPS reboot pun ikut hidup)
pkill -f "[n]ode /root/BotVPN2/app.js"
sleep 2
pm2 delete ripzz-store-ppob 2>/dev/null
pm2 start /root/BotVPN2/app.js --name ripzz-store-ppob
pm2 save >/dev/null 2>&1
echo "OK - bot jalan via PM2 (cek: pm2 ls | grep ripzz)"
