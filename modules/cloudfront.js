/**
 * cloudfront.js -- Manajemen CloudFront untuk BotVPN2
 *
 * Fitur:
 *  - Buat akun VMess/VLess/Trojan/SSH via CloudFront
 *  - Trial akun via CloudFront
 *  - Lihat daftar akun CloudFront
 *  - Hapus akun CloudFront
 *  - Cek status setup CloudFront di server
 *  - Info domain CloudFront per server
 *
 * Arsitektur:
 *  Modul ini memanggil CF API di server (port 5889, endpoint /cf/*).
 *  Server harus menjalankan cf-api-server (lihat setup-cloudfront-ws.sh).
 *  Kredensial CF dibaca dari /root/.cf-creds di server (tidak dikirim ke bot).
 *
 * Pola mengikuti modules/create.js (axios + sqlite3 + Promise).
 */

const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./sellvpn.db');

const CF_API_PORT = 5889;

function getServer(serverId) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM Server WHERE id = ?', [serverId], (err, server) => {
      if (err || !server) return reject(new Error('Server tidak ditemukan'));
      resolve(server);
    });
  });
}

function cfApi(server, path, params = {}) {
  const qs = new URLSearchParams(params).toString();
  const url = `http://${server.domain}:${CF_API_PORT}/cf/${path}?${qs}`;
  return axios.get(url, { timeout: 15000 });
}

function validUsername(username) {
  return typeof username === 'string' && /^[a-zA-Z0-9]{3,20}$/.test(username);
}

// ---------------------------------------------------------------------------
// CREATE (VMess / VLess / Trojan / SSH via CloudFront)
// ---------------------------------------------------------------------------

async function _createCF(proto, username, exp, serverId, extra = {}) {
  if (!validUsername(username)) {
    return '❌ Username tidak valid. Gunakan 3-20 karakter huruf/angka tanpa spasi.';
  }
  let server;
  try {
    server = await getServer(serverId);
  } catch (e) {
    return '❌ Gagal: Server tidak ditemukan. Silakan coba lagi.';
  }
  if (!server.cloudfront) {
    return '❌ Domain CloudFront belum diset untuk server ini.\nMinta admin set via menu Server > Edit CloudFront.';
  }
  try {
    const res = await cfApi(server, `create-${proto}`, { user: username, exp, ...extra });
    const d = res.data;
    if (d.status !== 'success') {
      return `❌ Gagal: ${d.message || 'unknown error'}`;
    }
    return { message: d.message, link: d.link, data: d.data };
  } catch (error) {
    console.error(`Error create CF ${proto}:`, error.message);
    return '❌ Gagal membuat akun CloudFront. Pastikan cf-api berjalan di server.';
  }
}

async function createvmess_cf(username, exp, serverId) {
  return _createCF('vmess', username, exp, serverId);
}
async function createvless_cf(username, exp, serverId) {
  return _createCF('vless', username, exp, serverId);
}
async function createtrojan_cf(username, exp, serverId) {
  return _createCF('trojan', username, exp, serverId);
}
async function createssh_cf(username, password, exp, serverId) {
  if (!password || password.length < 3) {
    return '❌ Password minimal 3 karakter.';
  }
  return _createCF('ssh', username, exp, serverId, { password });
}

// ---------------------------------------------------------------------------
// TRIAL (1 hari, username otomatis)
// ---------------------------------------------------------------------------

async function _trialCF(proto, serverId, extra = {}) {
  const rand = Math.random().toString(36).slice(2, 6);
  const username = `trial-cf-${proto}${rand}`;
  const result = await _createCF(proto, username, 1, serverId, extra);
  return result;
}

async function trialvmess_cf(serverId) { return _trialCF('vmess', serverId); }
async function trialvless_cf(serverId) { return _trialCF('vless', serverId); }
async function trialtrojan_cf(serverId) { return _trialCF('trojan', serverId); }
async function trialssh_cf(serverId) {
  const rand = Math.random().toString(36).slice(2, 6);
  return _trialCF('ssh', serverId, { password: `trial${rand}` });
}

// ---------------------------------------------------------------------------
// LIST / DELETE / STATUS / INFO
// ---------------------------------------------------------------------------

async function list_cf_users(serverId, proto = null) {
  let server;
  try {
    server = await getServer(serverId);
  } catch (e) {
    return '❌ Gagal: Server tidak ditemukan.';
  }
  try {
    const res = await cfApi(server, 'list', proto ? { proto } : {});
    const d = res.data;
    if (d.status !== 'success') return `❌ Gagal: ${d.message || 'unknown error'}`;
    const users = d.users || [];
    if (!users.length) return '📋 Tidak ada user CloudFront di server ini.';
    let msg = `📋 *User CloudFront* (${users.length})\n\n`;
    for (const u of users) {
      const mark = u.expired ? '🔴' : '🟢';
      msg += `${mark} \`${u.username}\` [${u.proto}] exp: \`${u.exp}\`\n`;
    }
    return msg;
  } catch (error) {
    console.error('Error list CF:', error.message);
    return '❌ Gagal mengambil daftar user CloudFront.';
  }
}

async function delete_cf_user(username, proto, serverId) {
  let server;
  try {
    server = await getServer(serverId);
  } catch (e) {
    return '❌ Gagal: Server tidak ditemukan.';
  }
  try {
    const res = await cfApi(server, 'delete', { user: username, proto });
    const d = res.data;
    return d.status === 'success'
      ? `✅ User CloudFront \`${username}\` [${proto}] dihapus.`
      : `❌ Gagal: ${d.message || 'unknown error'}`;
  } catch (error) {
    console.error('Error delete CF:', error.message);
    return '❌ Gagal menghapus user CloudFront.';
  }
}

async function check_cf_status(serverId) {
  let server;
  try {
    server = await getServer(serverId);
  } catch (e) {
    return '❌ Gagal: Server tidak ditemukan.';
  }
  try {
    const res = await cfApi(server, 'status');
    const d = res.data;
    if (d.status !== 'success') return `❌ CF API error: ${d.message || 'unknown'}`;
    const c = d.checks || {};
    const ok = (v) => (v ? '✅' : '❌');
    return (
      `🔍 *Status CloudFront*\n` +
      `Server: \`${server.nama_server || server.domain}\`\n` +
      `Domain CF: \`${server.cloudfront || '-'}\`\n\n` +
      `${ok(c.creds)} Kredensial (/root/.cf-creds)\n` +
      `${ok(c.xray_vmess)} Inbound Xray 10020 (vmess)\n` +
      `${ok(c.xray_vless)} Inbound Xray 10021 (vless)\n` +
      `${ok(c.xray_trojan)} Inbound Xray 10022 (trojan)\n` +
      `${ok(c.nginx)} Nginx locations /cf-*\n` +
      `${ok(c.wstunnel)} wstunnel-ssh (port 10023)\n` +
      `${ok(c.http_400)} HTTP 400 per path\n`
    );
  } catch (error) {
    console.error('Error CF status:', error.message);
    return '❌ Tidak bisa menghubungi CF API di server.\nPastikan cf-api-server berjalan (port 5889).';
  }
}

async function cf_domain_info(serverId) {
  let server;
  try {
    server = await getServer(serverId);
  } catch (e) {
    return '❌ Gagal: Server tidak ditemukan.';
  }
  return (
    `☁️ *CloudFront Server*\n\n` +
    `🖥️ Server: \`${server.nama_server || server.domain}\`\n` +
    `🌐 Domain CF: \`${server.cloudfront || '- (belum diset)'}\`\n\n` +
    `Path:\n` +
    `• \`/cf-vmess\` → VMess+WS\n` +
    `• \`/cf-vless\` → VLess+WS\n` +
    `• \`/cf-trojan\` → Trojan+WS\n` +
    `• \`/cf-ssh\` → SSH over WebSocket\n\n` +
    `_Ubah via menu Admin > Server > Edit CloudFront._`
  );
}

module.exports = {
  createvmess_cf,
  createvless_cf,
  createtrojan_cf,
  createssh_cf,
  trialvmess_cf,
  trialvless_cf,
  trialtrojan_cf,
  trialssh_cf,
  list_cf_users,
  delete_cf_user,
  check_cf_status,
  cf_domain_info,
};
