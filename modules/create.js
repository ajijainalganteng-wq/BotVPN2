const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./sellvpn.db');


async function trialssh(username, password, exp, iplimit, serverId) {
  console.log(`Creating SSH account for ${username} with expiry ${exp} days, IP limit ${iplimit}, and password ${password}`);

  // Validasi username
  if (/\s/.test(username) || /[^a-zA-Z0-9]/.test(username)) {
    return {
      success: false,
      message: '❌ Username tidak valid. Mohon gunakan hanya huruf dan angka tanpa spasi.'
    };
  }

  return new Promise((resolve) => {
    db.get('SELECT * FROM Server WHERE id = ?', [serverId], (err, server) => {
      if (err) {
        console.error('Error fetching server:', err.message);
        return resolve({
          success: false,
          message: '❌ Gagal: Server tidak ditemukan. Silakan coba lagi.'
        });
      }

      if (!server) {
        return resolve({
          success: false,
          message: '❌ Gagal: Server tidak ditemukan. Silakan coba lagi.'
        });
      }

      const domain = server.domain;
      const auth = server.auth;
      const cloudfront = server.cloudfront || "-";

      const param = `:5888/trialssh?user=${username}&password=${password}&exp=${exp}&iplimit=${iplimit}&auth=${auth}`;
      const url = `http://${domain}${param}`;

      axios.get(url)
        .then(response => {
          if (response.data.status === "success") {
            const sshData = response.data.data;

            const msg = `
╭━━━━━━━━━━━━━━━━━━━━━━╮
      🚀 *ꜱꜱʜ ᴀᴄᴄᴏᴜɴᴛ*
╰━━━━━━━━━━━━━━━━━━━━━━╯

┌〔 📄 *ᴀᴄᴄᴏᴜɴᴛ ɪɴꜰᴏ* 〕
├ 👤 ᴜꜱᴇʀɴᴀᴍᴇ : \`${sshData.username}\`
├ 🔑 ᴘᴀꜱꜱᴡᴏʀᴅ : \`${sshData.password}\`
├ 📅 ᴇxᴘɪʀᴇᴅ  : \`${sshData.expired}\`
├ 🌐 ɪᴘ ʟɪᴍɪᴛ : \`${sshData.ip_limit}\`
└ 🟢 ꜱᴛᴀᴛᴜꜱ   : \`ACTIVE\`

━━━━━━━━━━━━━━━━━━━━━━

┌〔 🌍 *ꜱᴇʀᴠᴇʀ* 〕
├ 🌐 ᴅᴏᴍᴀɪɴ      : \`${sshData.domain}\`
├ ☁️ ᴄʟᴏᴜᴅꜰʀᴏɴᴛ  : \`${cloudfront}\`
├ 🌍 ɴᴀᴍᴇꜱᴇʀᴠᴇʀ  : \`${sshData.ns_domain}\`
└ 🔑 ᴘᴜʙ ᴋᴇʏ     : \`${sshData.pubkey}\`

━━━━━━━━━━━━━━━━━━━━━━

┌〔 🔌 *ᴘᴏʀᴛ* 〕
├ 🔐 ᴛʟꜱ        : \`443,8443\`
├ 🌐 ʜᴛᴛᴘ       : \`80,8080,2086,8880\`
├ ⚡ ᴏᴘᴇɴꜱꜱʜ    : \`22\`
├ 🚀 ᴜᴅᴘꜱꜱʜ      : \`1-65535\`
├ 🌍 ᴅɴꜱ        : \`53,2222\`
├ 📡 ᴅʀᴏᴘʙᴇᴀʀ   : \`109,110\`
└ 🎮 ʙᴀᴅᴠᴘɴ      : \`7300\`

━━━━━━━━━━━━━━━━━━━━━━

📡 *ʜᴛᴛᴘ ᴄᴜꜱᴛᴏᴍ*

\`${sshData.domain}:80@${sshData.username}:${sshData.password}\`

━━━━━━━━━━━━━━━━━━━━━━

📄 *ᴘᴀʏʟᴏᴀᴅ*

\`GET /cdn-cgi/trace HTTP/1.1[crlf]Host: Bug_Kalian[crlf][crlf]GET-RAY / HTTP/1.1[crlf]Host: [host][crlf]Connection: Upgrade[crlf]User-Agent: [ua][crlf]Upgrade: websocket[crlf][crlf]\`

━━━━━━━━━━━━━━━━━━━━━━

💾 *ꜱᴀᴠᴇ ᴀᴄᴄᴏᴜɴᴛ*

https://${sshData.domain}:81/ssh-${sshData.username}.txt

━━━━━━━━━━━━━━━━━━━━━━

🎉 *ᴀᴄᴄᴏᴜɴᴛ ʙᴇʀʜᴀꜱɪʟ ᴅɪʙᴜᴀᴛ*

🤝 ᴛᴇʀɪᴍᴀ ᴋᴀꜱɪʜ
ꜱᴇʟᴀᴍᴀᴛ ᴍᴇɴɢɢᴜɴᴀᴋᴀɴ
ʟᴀʏᴀɴᴀɴ ᴋᴀᴍɪ. ❤️
`;

            console.log('SSH account created successfully');

            return resolve({
              success: true,
              message: msg,
              config: {
                username: sshData.username,
                password: sshData.password,
                domain: sshData.domain,
                cloudfront: cloudfront,
                ns_domain: sshData.ns_domain,
                pubkey: sshData.pubkey,
                expired: sshData.expired
              }
            });

          } else {
            console.log('Error creating SSH account');

            return resolve({
              success: false,
              message: `❌ Gagal: ${response.data.message}`
            });
          }
        })
        .catch(error => {
          console.error('Error saat membuat SSH:', error);

          return resolve({
            success: false,
            message: '❌ Gagal membuat SSH. Silakan coba lagi nanti.'
          });
        });
    });
  });
}
async function trialvmess(username, exp, quota, limitip, serverId) {
  console.log(`Creating VMess account for ${username} with expiry ${exp} days, quota ${quota} GB, limit IP ${limitip} on server ${serverId}`);
  
  // Validasi username
  if (/\s/.test(username) || /[^a-zA-Z0-9]/.test(username)) {
    return '❌ Username tidak valid. Mohon gunakan hanya huruf dan angka tanpa spasi.';
  }

  // Ambil domain dan auth dari database
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM Server WHERE id = ?', [serverId], (err, server) => {
      if (err) {
        console.error('Error fetching server:', err.message);
        return resolve('❌ Gagal: Server tidak ditemukan. Silakan coba lagi.');
      }

      if (!server) return resolve('❌ Gagal: Server tidak ditemukan. Silakan coba lagi.');

      const domain = server.domain;
      const auth = server.auth;
      const cloudfront = server.cloudfront || "-"; // <-- pindah ke sini
      const param = `:5888/trialvmess?user=${username}&exp=${exp}&quota=${quota}&iplimit=${limitip}&auth=${auth}`;
      const url = `http://${domain}${param}`;
      axios.get(url)
        .then(response => {
          if (response.data.status === "success") {
            const vmessData = response.data.data;
            const msg = `
╭━━━━━━━━━━━━━━━━━━━━━━╮
     🚀 *ᴠᴍᴇꜱꜱ ᴀᴄᴄᴏᴜɴᴛ*
╰━━━━━━━━━━━━━━━━━━━━━━╯

┌〔 📄 *ᴀᴄᴄᴏᴜɴᴛ ɪɴꜰᴏ* 〕
├ 👤 ᴜꜱᴇʀɴᴀᴍᴇ : \`${vmessData.username}\`
├ 🆔 ᴜᴜɪᴅ      : \`${vmessData.uuid}\`
├ 📅 ᴇxᴘɪʀᴇᴅ   : \`${vmessData.expired}\`
├ 📦 Qᴜᴏᴛᴀ     : \`${vmessData.quota === '0 GB' ? 'Unlimited' : vmessData.quota}\`
├ 🌐 ɪᴘ ʟɪᴍɪᴛ  : \`${vmessData.ip_limit === '0' ? 'Unlimited' : vmessData.ip_limit} IP\`
└ 🟢 ꜱᴛᴀᴛᴜꜱ    : \`ACTIVE\`

━━━━━━━━━━━━━━━━━━━━━━

┌〔 🌍 *ꜱᴇʀᴠᴇʀ* 〕
├ 🌐 ᴅᴏᴍᴀɪɴ      : \`${vmessData.domain}\`
├ ☁️ ᴄʟᴏᴜᴅꜰʀᴏɴᴛ  : \`${cloudfront}\`
├ 🔐 ᴛʟꜱ ᴘᴏʀᴛ    : \`443,8443\`
├ 🌍 ʜᴛᴛᴘ ᴘᴏʀᴛ   : \`80,8080,2086,8880\`
├ 🔒 ꜱᴇᴄᴜʀɪᴛʏ    : \`Auto\`
├ 📂 ᴘᴀᴛʜ        : \`/vmess\`
└ 🚀 ɢʀᴘᴄ ᴘᴀᴛʜ   : \`vmess-grpc\`

━━━━━━━━━━━━━━━━━━━━━━

🔗 *ᴜʀʟ ᴛʟꜱ*

\`\`\`
${vmessData.vmess_tls_link}
\`\`\`

━━━━━━━━━━━━━━━━━━━━━━

🔗 *ᴜʀʟ ʜᴛᴛᴘ*

\`\`\`
${vmessData.vmess_nontls_link}
\`\`\`

━━━━━━━━━━━━━━━━━━━━━━

🔗 *ᴜʀʟ ɢʀᴘᴄ*

\`\`\`
${vmessData.vmess_grpc_link}
\`\`\`

━━━━━━━━━━━━━━━━━━━━━━

💾 *ꜱᴀᴠᴇ ᴀᴄᴄᴏᴜɴᴛ*

https://${vmessData.domain}:81/vmess-${vmessData.username}.txt

━━━━━━━━━━━━━━━━━━━━━━

🎉 *ᴀᴄᴄᴏᴜɴᴛ ʙᴇʀʜᴀꜱɪʟ ᴅɪʙᴜᴀᴛ*

🤝 ᴛᴇʀɪᴍᴀ ᴋᴀꜱɪʜ
ꜱᴇʟᴀᴍᴀᴛ ᴍᴇɴɢɢᴜɴᴀᴋᴀɴ
ʟᴀʏᴀɴᴀɴ ᴋᴀᴍɪ. ❤️
`;
console.log('VMess account created successfully');

return resolve({
  message: msg,
  config: {
    tls: vmessData.vmess_tls_link,
    http: vmessData.vmess_nontls_link,
    grpc: vmessData.vmess_grpc_link
  }
});

} else {
  console.log('Error creating VMess account');
  return resolve(`❌ Gagal: ${response.data.message}`);
}

})
.catch(error => {
  console.error('Error saat membuat VMess:', error);
  return resolve('❌ Gagal membuat VMess. Silakan coba lagi nanti.');
});

});

});

}
async function trialvless(username, exp, quota, limitip, serverId) {
  console.log(`Creating VLESS account for ${username} with expiry ${exp} days, quota ${quota} GB, limit IP ${limitip} on server ${serverId}`);
  
  // Validasi username
  if (/\s/.test(username) || /[^a-zA-Z0-9]/.test(username)) {
    return '❌ Username tidak valid. Mohon gunakan hanya huruf dan angka tanpa spasi.';
  }

  // Ambil domain dari database
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM Server WHERE id = ?', [serverId], (err, server) => {
      if (err) {
        console.error('Error fetching server:', err.message);
        return resolve('❌ Gagal: Server tidak ditemukan. Silakan coba lagi.');
      }

      if (!server) return resolve('❌ Gagal: Server tidak ditemukan. Silakan coba lagi.');

      const domain = server.domain;
      const auth = server.auth;
      const cloudfront = server.cloudfront || "-"; // <-- pindah ke sini
      const param = `:5888/trialvless?user=${username}&exp=${exp}&quota=${quota}&iplimit=${limitip}&auth=${auth}`;
      const url = `http://${domain}${param}`;
      axios.get(url)
        .then(response => {
          if (response.data.status === "success") {
            const vlessData = response.data.data;
            const msg = `
╭━━━━━━━━━━━━━━━━━━━━━━╮
      🛡 *ᴠʟᴇꜱꜱ ᴀᴄᴄᴏᴜɴᴛ*
╰━━━━━━━━━━━━━━━━━━━━━━╯

┌〔 📄 *ᴀᴄᴄᴏᴜɴᴛ ɪɴꜰᴏ* 〕
├ 👤 ᴜꜱᴇʀɴᴀᴍᴇ : \`${vlessData.username}\`
├ 🆔 ᴜᴜɪᴅ      : \`${vlessData.uuid}\`
├ 📅 ᴇxᴘɪʀᴇᴅ   : \`${vlessData.expired}\`
├ 📦 Qᴜᴏᴛᴀ     : \`${vlessData.quota === '0 GB' ? 'Unlimited' : vlessData.quota}\`
├ 🌐 ɪᴘ ʟɪᴍɪᴛ  : \`${vlessData.ip_limit === '0' ? 'Unlimited' : vlessData.ip_limit} IP\`
└ 🟢 ꜱᴛᴀᴛᴜꜱ    : \`ACTIVE\`

━━━━━━━━━━━━━━━━━━━━━━

┌〔 🌍 *ꜱᴇʀᴠᴇʀ* 〕
├ 🌐 ᴅᴏᴍᴀɪɴ      : \`${vlessData.domain}\`
├ ☁️ ᴄʟᴏᴜᴅꜰʀᴏɴᴛ  : \`${cloudfront}\`
├ 🔐 ᴛʟꜱ ᴘᴏʀᴛ    : \`443,8443\`
├ 🌍 ʜᴛᴛᴘ ᴘᴏʀᴛ   : \`80,8080,2086,8880\`
├ 📂 ᴘᴀᴛʜ        : \`/vless\`
└ 🚀 ɢʀᴘᴄ ᴘᴀᴛʜ   : \`vless-grpc\`

━━━━━━━━━━━━━━━━━━━━━━

🔗 *ᴜʀʟ ᴛʟꜱ*

\`\`\`
${vlessData.vless_tls_link}
\`\`\`

━━━━━━━━━━━━━━━━━━━━━━

🔗 *ᴜʀʟ ʜᴛᴛᴘ*

\`\`\`
${vlessData.vless_nontls_link}
\`\`\`

━━━━━━━━━━━━━━━━━━━━━━

🔗 *ᴜʀʟ ɢʀᴘᴄ*

\`\`\`
${vlessData.vless_grpc_link}
\`\`\`

━━━━━━━━━━━━━━━━━━━━━━

💾 *ꜱᴀᴠᴇ ᴀᴄᴄᴏᴜɴᴛ*

https://${vlessData.domain}:81/vless-${vlessData.username}.txt

━━━━━━━━━━━━━━━━━━━━━━

🎉 *ᴀᴄᴄᴏᴜɴᴛ ʙᴇʀʜᴀꜱɪʟ ᴅɪʙᴜᴀᴛ*

🤝 ᴛᴇʀɪᴍᴀ ᴋᴀꜱɪʜ
ꜱᴇʟᴀᴍᴀᴛ ᴍᴇɴɢɢᴜɴᴀᴋᴀɴ
ʟᴀʏᴀɴᴀɴ ᴋᴀᴍɪ. ❤️
`;
              console.log('VLESS account created successfully');
              return resolve({
    message: msg,
    config: {
        tls: vlessData.vless_tls_link,
        http: vlessData.vless_nontls_link,
        grpc: vlessData.vless_grpc_link
    }
});
            } else {
              console.log('Error creating VLESS account');
              return resolve(`❌ Gagal: ${response.data.message}`);
            }
          })
        .catch(error => {
          console.error('Error saat membuat VLESS:', error);
          return resolve('❌ Gagal membuat VLESS. Silakan coba lagi nanti.');
        });
    });
  });
}
async function trialtrojan(username, exp, quota, limitip, serverId) {
  console.log(`Creating Trojan account for ${username} with expiry ${exp} days, quota ${quota} GB, limit IP ${limitip} on server ${serverId}`);
  
  if (/\s/.test(username) || /[^a-zA-Z0-9]/.test(username)) {
    return '❌ Username tidak valid. Mohon gunakan hanya huruf dan angka tanpa spasi.';
  }

  // Ambil domain dari database
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM Server WHERE id = ?', [serverId], (err, server) => {
      if (err) {
        console.error('Error fetching server:', err.message);
        return resolve('❌ Gagal: Server tidak ditemukan. Silakan coba lagi.');
      }

      if (!server) return resolve('❌ Gagal: Server tidak ditemukan. Silakan coba lagi.');

      const domain = server.domain;
      const auth = server.auth;
      const cloudfront = server.cloudfront || "-"; // <-- pindah ke sini
      const param = `:5888/trialtrojan?user=${username}&exp=${exp}&quota=${quota}&iplimit=${limitip}&auth=${auth}`;
      const url = `http://${domain}${param}`;
      axios.get(url)
        .then(response => {
          if (response.data.status === "success") {
            const trojanData = response.data.data;
            const msg = `
╭━━━━━━━━━━━━━━━━━━━━━━╮
     🐎 *ᴛʀᴏᴊᴀɴ ᴀᴄᴄᴏᴜɴᴛ*
╰━━━━━━━━━━━━━━━━━━━━━━╯

┌〔 📄 *ᴀᴄᴄᴏᴜɴᴛ ɪɴꜰᴏ* 〕
├ 👤 ᴜꜱᴇʀɴᴀᴍᴇ : \`${trojanData.username}\`
├ 🆔 ᴜᴜɪᴅ      : \`${trojanData.uuid}\`
├ 📅 ᴇxᴘɪʀᴇᴅ   : \`${trojanData.expired}\`
├ 📦 Qᴜᴏᴛᴀ     : \`${trojanData.quota === '0 GB' ? 'Unlimited' : trojanData.quota}\`
├ 🌐 ɪᴘ ʟɪᴍɪᴛ  : \`${trojanData.ip_limit === '0' ? 'Unlimited' : trojanData.ip_limit} IP\`
└ 🟢 ꜱᴛᴀᴛᴜꜱ    : \`ACTIVE\`

━━━━━━━━━━━━━━━━━━━━━━

┌〔 🌍 *ꜱᴇʀᴠᴇʀ* 〕
├ 🌐 ᴅᴏᴍᴀɪɴ      : \`${trojanData.domain}\`
├ ☁️ ᴄʟᴏᴜᴅꜰʀᴏɴᴛ  : \`${cloudfront}\`
├ 🔐 ᴛʟꜱ ᴘᴏʀᴛ    : \`443,8443\`
├ 🌍 ʜᴛᴛᴘ ᴘᴏʀᴛ   : \`80,8080,2086,8880\`
├ 📂 ᴘᴀᴛʜ        : \`/trojan-ws\`
└ 🚀 ɢʀᴘᴄ ᴘᴀᴛʜ   : \`trojan-grpc\`

━━━━━━━━━━━━━━━━━━━━━━

🔗 *ᴜʀʟ ᴛʟꜱ*

\`\`\`
${trojanData.trojan_tls_link}
\`\`\`

━━━━━━━━━━━━━━━━━━━━━━

🔗 *ᴜʀʟ ɢʀᴘᴄ*

\`\`\`
${trojanData.trojan_grpc_link}
\`\`\`

━━━━━━━━━━━━━━━━━━━━━━

💾 *ꜱᴀᴠᴇ ᴀᴄᴄᴏᴜɴᴛ*

https://${trojanData.domain}:81/trojan-${trojanData.username}.txt

━━━━━━━━━━━━━━━━━━━━━━

🎉 *ᴀᴄᴄᴏᴜɴᴛ ʙᴇʀʜᴀꜱɪʟ ᴅɪʙᴜᴀᴛ*

🤝 ᴛᴇʀɪᴍᴀ ᴋᴀꜱɪʜ
ꜱᴇʟᴀᴍᴀᴛ ᴍᴇɴɢɢᴜɴᴀᴋᴀɴ
ʟᴀʏᴀɴᴀɴ ᴋᴀᴍɪ. ❤️
`;
              console.log('Trojan account created successfully');
              return resolve({
    message: msg,
    config: {
        tls: trojanData.trojan_tls_link,
        grpc: trojanData.trojan_grpc_link
    }
});
            } else {
              console.log('Error creating Trojan account');
              return resolve(`❌ Gagal: ${response.data.message}`);
            }
          })
        .catch(error => {
          console.error('Error saat membuat Trojan:', error);
          return resolve('❌ Gagal membuat Trojan. Silakan coba lagi nanti.');
        });
    });
  });
}

async function trialshadowsocks(username, exp, quota, limitip, serverId) {
  console.log(`Creating Shadowsocks account for ${username} with expiry ${exp} days, quota ${quota} GB, limit IP ${limitip} on server ${serverId}`);
  
  if (/\s/.test(username) || /[^a-zA-Z0-9]/.test(username)) {
    return '❌ Username tidak valid. Mohon gunakan hanya huruf dan angka tanpa spasi.';
  }

  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM Server WHERE id = ?', [serverId], (err, server) => {
      if (err) {
        console.error('Error fetching server:', err.message);
        return resolve('❌ Gagal: Server tidak ditemukan. Silakan coba lagi.');
      }

      if (!server) return resolve('❌ Gagal: Server tidak ditemukan. Silakan coba lagi.');

      const domain = server.domain;
      const auth = server.auth;
      const cloudfront = server.cloudfront || "-"; // <-- pindah ke sini
      const param = `:5888/trialshadowsocks?user=${username}&exp=${exp}&quota=${quota}&iplimit=${limitip}&auth=${auth}`;
      const url = `http://${domain}${param}`;
      axios.get(url)
        .then(response => {
          if (response.data.status === "success") {
            const shadowsocksData = response.data.data;
            const msg = `
╭━━━━━━━━━━━━━━━━━━━━━━╮
   🔰 *ꜱʜᴀᴅᴏᴡꜱᴏᴄᴋꜱ ᴀᴄᴄᴏᴜɴᴛ*
╰━━━━━━━━━━━━━━━━━━━━━━╯

┌〔 📄 *ᴀᴄᴄᴏᴜɴᴛ ɪɴꜰᴏ* 〕
├ 👤 ᴜꜱᴇʀɴᴀᴍᴇ : \`${shadowsocksData.username}\`
├ 🆔 ᴜᴜɪᴅ      : \`${shadowsocksData.uuid}\`
├ 📅 ᴇxᴘɪʀᴇᴅ   : \`${shadowsocksData.expired}\`
├ 📦 Qᴜᴏᴛᴀ     : \`${shadowsocksData.quota === '0 GB' ? 'Unlimited' : shadowsocksData.quota}\`
├ 🌐 ɪᴘ ʟɪᴍɪᴛ  : \`${shadowsocksData.ip_limit === '0' ? 'Unlimited' : shadowsocksData.ip_limit} IP\`
└ 🟢 ꜱᴛᴀᴛᴜꜱ    : \`ACTIVE\`

━━━━━━━━━━━━━━━━━━━━━━

┌〔 🌍 *ꜱᴇʀᴠᴇʀ* 〕
├ 🌐 ᴅᴏᴍᴀɪɴ      : \`${shadowsocksData.domain}\`
├ ☁️ ᴄʟᴏᴜᴅꜰʀᴏɴᴛ  : \`${cloudfront}\`
├ 🔐 ᴛʟꜱ ᴘᴏʀᴛ    : \`443,8443\`
├ 🌍 ʜᴛᴛᴘ ᴘᴏʀᴛ   : \`80,8080,2086,8880\`
├ 📂 ᴘᴀᴛʜ        : \`/ss-ws\`
└ 🚀 ɢʀᴘᴄ ᴘᴀᴛʜ   : \`ss-grpc\`

━━━━━━━━━━━━━━━━━━━━━━

🔗 *ᴜʀʟ ᴛʟꜱ*

\`\`\`
${shadowsocksData.ss_link_ws}
\`\`\`

━━━━━━━━━━━━━━━━━━━━━━

🔗 *ᴜʀʟ ʜᴛᴛᴘ*

\`\`\`
${shadowsocksData.ss_link_nontls}
\`\`\`

━━━━━━━━━━━━━━━━━━━━━━

🔗 *ᴜʀʟ ɢʀᴘᴄ*

\`\`\`
${shadowsocksData.ss_link_grpc}
\`\`\`

━━━━━━━━━━━━━━━━━━━━━━

💾 *ꜱᴀᴠᴇ ᴀᴄᴄᴏᴜɴᴛ*

https://${shadowsocksData.domain}:81/ss-${shadowsocksData.username}.txt

━━━━━━━━━━━━━━━━━━━━━━

🎉 *ᴀᴄᴄᴏᴜɴᴛ ʙᴇʀʜᴀꜱɪʟ ᴅɪʙᴜᴀᴛ*

🤝 ᴛᴇʀɪᴍᴀ ᴋᴀꜱɪʜ
ꜱᴇʟᴀᴍᴀᴛ ᴍᴇɴɢɢᴜɴᴀᴋᴀɴ
ʟᴀʏᴀɴᴀɴ ᴋᴀᴍɪ. ❤️
`;
              console.log('Shadowsocks account created successfully');
              return resolve(msg);
            } else {
              console.log('Error creating Shadowsocks account');
              return resolve(`❌ Gagal: ${response.data.message}`);
            }
          })
        .catch(error => {
          console.error('Error saat membuat Shadowsocks:', error);
          return resolve('❌ Gagal membuat Shadowsocks. Silakan coba lagi nanti.');
        });
    });
  });
}

async function createssh(username, password, exp, iplimit, serverId) {
  console.log(`Creating SSH account for ${username} with expiry ${exp} days, IP limit ${iplimit}, and password ${password}`);
  
  if (/\s/.test(username) || /[^a-zA-Z0-9]/.test(username)) {
    return '❌ Username tidak valid. Mohon gunakan hanya huruf dan angka tanpa spasi.';
  }

  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM Server WHERE id = ?', [serverId], (err, server) => {
      if (err) {
        console.error('Error fetching server:', err.message);
        return resolve('❌ Gagal: Server tidak ditemukan. Silakan coba lagi.');
      }

      if (!server) return resolve('❌ Gagal: Server tidak ditemukan. Silakan coba lagi.');

      const domain = server.domain;
      const auth = server.auth;
      const cloudfront = server.cloudfront || "-"; // <-- pindah ke sini
      const param = `:5888/createssh?user=${username}&password=${password}&exp=${exp}&iplimit=${iplimit}&auth=${auth}`;
      const url = `http://${domain}${param}`;
      axios.get(url)
        .then(response => {
          if (response.data.status === "success") {
            const sshData = response.data.data;
            const msg = `
╭━━━━━━━━━━━━━━━━━━━━━━╮
      🚀 *ꜱꜱʜ ᴀᴄᴄᴏᴜɴᴛ*
╰━━━━━━━━━━━━━━━━━━━━━━╯

┌〔 📄 *ᴀᴄᴄᴏᴜɴᴛ ɪɴꜰᴏ* 〕
├ 👤 ᴜꜱᴇʀɴᴀᴍᴇ : \`${sshData.username}\`
├ 🔑 ᴘᴀꜱꜱᴡᴏʀᴅ : \`${sshData.password}\`
├ 📅 ᴇxᴘɪʀᴇᴅ  : \`${sshData.expired}\`
├ 🌐 ɪᴘ ʟɪᴍɪᴛ : \`${sshData.ip_limit}\`
└ 🟢 ꜱᴛᴀᴛᴜꜱ   : \`ACTIVE\`

━━━━━━━━━━━━━━━━━━━━━━

┌〔 🌍 *ꜱᴇʀᴠᴇʀ* 〕
├ 🌐 ᴅᴏᴍᴀɪɴ      : \`${sshData.domain}\`
├ ☁️ ᴄʟᴏᴜᴅꜰʀᴏɴᴛ  : \`${cloudfront}\`
├ 🌍 ɴᴀᴍᴇꜱᴇʀᴠᴇʀ  : \`${sshData.ns_domain}\`
└ 🔑 ᴘᴜʙ ᴋᴇʏ     : \`${sshData.pubkey}\`

━━━━━━━━━━━━━━━━━━━━━━

┌〔 🔌 *ᴘᴏʀᴛ* 〕
├ 🔐 ᴛʟꜱ        : \`443,8443\`
├ 🌐 ʜᴛᴛᴘ       : \`80,8080,2086,8880\`
├ ⚡ ᴏᴘᴇɴꜱꜱʜ    : \`22\`
├ 🚀 ᴜᴅᴘꜱꜱʜ      : \`1-65535\`
├ 🌍 ᴅɴꜱ        : \`53,2222\`
├ 📡 ᴅʀᴏᴘʙᴇᴀʀ   : \`109,110\`
└ 🎮 ʙᴀᴅᴠᴘɴ      : \`7300\`

━━━━━━━━━━━━━━━━━━━━━━

📡 *ʜᴛᴛᴘ ᴄᴜꜱᴛᴏᴍ*

\`${sshData.domain}:80@${sshData.username}:${sshData.password}\`

━━━━━━━━━━━━━━━━━━━━━━

📄 *ᴘᴀʏʟᴏᴀᴅ*

\`GET /cdn-cgi/trace HTTP/1.1[crlf]Host: Bug_Kalian[crlf][crlf]GET-RAY / HTTP/1.1[crlf]Host: [host][crlf]Connection: Upgrade[crlf]User-Agent: [ua][crlf]Upgrade: websocket[crlf][crlf]\`

━━━━━━━━━━━━━━━━━━━━━━

💾 *ꜱᴀᴠᴇ ᴀᴄᴄᴏᴜɴᴛ*

https://${sshData.domain}:81/ssh-${sshData.username}.txt

━━━━━━━━━━━━━━━━━━━━━━

🎉 *ᴀᴄᴄᴏᴜɴᴛ ʙᴇʀʜᴀꜱɪʟ ᴅɪʙᴜᴀᴛ*

🤝 ᴛᴇʀɪᴍᴀ ᴋᴀꜱɪʜ
ꜱᴇʟᴀᴍᴀᴛ ᴍᴇɴɢɢᴜɴᴀᴋᴀɴ
ʟᴀʏᴀɴᴀɴ ᴋᴀᴍɪ. ❤️
`;
              console.log('SSH account created successfully');
              return resolve(msg);
            } else {
              console.log('Error creating SSH account');
              return resolve(`❌ Gagal: ${response.data.message}`);
            }
          })
        .catch(error => {
          console.error('Error saat membuat SSH:', error);
          return resolve('❌ Gagal membuat SSH. Silakan coba lagi nanti.');
        });
    });
  });
}
async function createvmess(username, exp, quota, limitip, serverId) {
  console.log(`Creating VMess account for ${username} with expiry ${exp} days, quota ${quota} GB, limit IP ${limitip} on server ${serverId}`);
  
  if (/\s/.test(username) || /[^a-zA-Z0-9]/.test(username)) {
    return '❌ Username tidak valid. Mohon gunakan hanya huruf dan angka tanpa spasi.';
  }

  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM Server WHERE id = ?', [serverId], (err, server) => {
      if (err) {
        console.error('Error fetching server:', err.message);
        return resolve('❌ Gagal: Server tidak ditemukan. Silakan coba lagi.');
      }

      if (!server) return resolve('❌ Gagal: Server tidak ditemukan. Silakan coba lagi.');

      const domain = server.domain;
      const auth = server.auth;
      const cloudfront = server.cloudfront || "-"; // <-- pindah ke sini
      const param = `:5888/createvmess?user=${username}&exp=${exp}&quota=${quota}&iplimit=${limitip}&auth=${auth}`;
      const url = `http://${domain}${param}`;
      axios.get(url)
        .then(response => {
          if (response.data.status === "success") {
            const vmessData = response.data.data;
            const msg = `
╭━━━━━━━━━━━━━━━━━━━━━━╮
     🚀 *ᴠᴍᴇꜱꜱ ᴀᴄᴄᴏᴜɴᴛ*
╰━━━━━━━━━━━━━━━━━━━━━━╯

┌〔 📄 *ᴀᴄᴄᴏᴜɴᴛ ɪɴꜰᴏ* 〕
├ 👤 ᴜꜱᴇʀɴᴀᴍᴇ : \`${vmessData.username}\`
├ 🆔 ᴜᴜɪᴅ      : \`${vmessData.uuid}\`
├ 📅 ᴇxᴘɪʀᴇᴅ   : \`${vmessData.expired}\`
├ 📦 Qᴜᴏᴛᴀ     : \`${vmessData.quota === '0 GB' ? 'Unlimited' : vmessData.quota}\`
├ 🌐 ɪᴘ ʟɪᴍɪᴛ  : \`${vmessData.ip_limit === '0' ? 'Unlimited' : vmessData.ip_limit} IP\`
└ 🟢 ꜱᴛᴀᴛᴜꜱ    : \`ACTIVE\`

━━━━━━━━━━━━━━━━━━━━━━

┌〔 🌍 *ꜱᴇʀᴠᴇʀ* 〕
├ 🌐 ᴅᴏᴍᴀɪɴ      : \`${vmessData.domain}\`
├ ☁️ ᴄʟᴏᴜᴅꜰʀᴏɴᴛ  : \`${cloudfront}\`
├ 🔐 ᴛʟꜱ ᴘᴏʀᴛ    : \`443,8443\`
├ 🌍 ʜᴛᴛᴘ ᴘᴏʀᴛ   : \`80,8080,2086,8880\`
├ 🔒 ꜱᴇᴄᴜʀɪᴛʏ    : \`Auto\`
├ 📂 ᴘᴀᴛʜ        : \`/vmess\`
└ 🚀 ɢʀᴘᴄ ᴘᴀᴛʜ   : \`vmess-grpc\`

━━━━━━━━━━━━━━━━━━━━━━

🔗 *ᴜʀʟ ᴛʟꜱ*

\`\`\`
${vmessData.vmess_tls_link}
\`\`\`

━━━━━━━━━━━━━━━━━━━━━━

🔗 *ᴜʀʟ ʜᴛᴛᴘ*

\`\`\`
${vmessData.vmess_nontls_link}
\`\`\`

━━━━━━━━━━━━━━━━━━━━━━

🔗 *ᴜʀʟ ɢʀᴘᴄ*

\`\`\`
${vmessData.vmess_grpc_link}
\`\`\`

━━━━━━━━━━━━━━━━━━━━━━

💾 *ꜱᴀᴠᴇ ᴀᴄᴄᴏᴜɴᴛ*

https://${vmessData.domain}:81/vmess-${vmessData.username}.txt

━━━━━━━━━━━━━━━━━━━━━━

🎉 *ᴀᴄᴄᴏᴜɴᴛ ʙᴇʀʜᴀꜱɪʟ ᴅɪʙᴜᴀᴛ*

🤝 ᴛᴇʀɪᴍᴀ ᴋᴀꜱɪʜ
ꜱᴇʟᴀᴍᴀᴛ ᴍᴇɴɢɢᴜɴᴀᴋᴀɴ
ʟᴀʏᴀɴᴀɴ ᴋᴀᴍɪ. ❤️
`;
console.log('VMess account created successfully');

return resolve({
  message: msg,
  config: {
    tls: vmessData.vmess_tls_link,
    http: vmessData.vmess_nontls_link,
    grpc: vmessData.vmess_grpc_link
  }
});

} else {
  console.log('Error creating VMess account');
  return resolve(`❌ Gagal: ${response.data.message}`);
}

})
.catch(error => {
  console.error('Error saat membuat VMess:', error);
  return resolve('❌ Gagal membuat VMess. Silakan coba lagi nanti.');
});

});

});

}
async function createvless(username, exp, quota, limitip, serverId) {
  console.log(`Creating VLESS account for ${username} with expiry ${exp} days, quota ${quota} GB, limit IP ${limitip} on server ${serverId}`);
  
  if (/\s/.test(username) || /[^a-zA-Z0-9]/.test(username)) {
    return '❌ Username tidak valid. Mohon gunakan hanya huruf dan angka tanpa spasi.';
  }

  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM Server WHERE id = ?', [serverId], (err, server) => {
      if (err) {
        console.error('Error fetching server:', err.message);
        return resolve('❌ Gagal: Server tidak ditemukan. Silakan coba lagi.');
      }

      if (!server) return resolve('❌ Gagal: Server tidak ditemukan. Silakan coba lagi.');

      const domain = server.domain;
      const auth = server.auth;
      const cloudfront = server.cloudfront || "-"; // <-- pindah ke sini
      const param = `:5888/createvless?user=${username}&exp=${exp}&quota=${quota}&iplimit=${limitip}&auth=${auth}`;
      const url = `http://${domain}${param}`;
      axios.get(url)
        .then(response => {
          if (response.data.status === "success") {
            const vlessData = response.data.data;
            const msg = `
╭━━━━━━━━━━━━━━━━━━━━━━╮
      🛡 *ᴠʟᴇꜱꜱ ᴀᴄᴄᴏᴜɴᴛ*
╰━━━━━━━━━━━━━━━━━━━━━━╯

┌〔 📄 *ᴀᴄᴄᴏᴜɴᴛ ɪɴꜰᴏ* 〕
├ 👤 ᴜꜱᴇʀɴᴀᴍᴇ : \`${vlessData.username}\`
├ 🆔 ᴜᴜɪᴅ      : \`${vlessData.uuid}\`
├ 📅 ᴇxᴘɪʀᴇᴅ   : \`${vlessData.expired}\`
├ 📦 Qᴜᴏᴛᴀ     : \`${vlessData.quota === '0 GB' ? 'Unlimited' : vlessData.quota}\`
├ 🌐 ɪᴘ ʟɪᴍɪᴛ  : \`${vlessData.ip_limit === '0' ? 'Unlimited' : vlessData.ip_limit} IP\`
└ 🟢 ꜱᴛᴀᴛᴜꜱ    : \`ACTIVE\`

━━━━━━━━━━━━━━━━━━━━━━

┌〔 🌍 *ꜱᴇʀᴠᴇʀ* 〕
├ 🌐 ᴅᴏᴍᴀɪɴ      : \`${vlessData.domain}\`
├ ☁️ ᴄʟᴏᴜᴅꜰʀᴏɴᴛ  : \`${cloudfront}\`
├ 🔐 ᴛʟꜱ ᴘᴏʀᴛ    : \`443,8443\`
├ 🌍 ʜᴛᴛᴘ ᴘᴏʀᴛ   : \`80,8080,2086,8880\`
├ 📂 ᴘᴀᴛʜ        : \`/vless\`
└ 🚀 ɢʀᴘᴄ ᴘᴀᴛʜ   : \`vless-grpc\`

━━━━━━━━━━━━━━━━━━━━━━

🔗 *ᴜʀʟ ᴛʟꜱ*

\`\`\`
${vlessData.vless_tls_link}
\`\`\`

━━━━━━━━━━━━━━━━━━━━━━

🔗 *ᴜʀʟ ʜᴛᴛᴘ*

\`\`\`
${vlessData.vless_nontls_link}
\`\`\`

━━━━━━━━━━━━━━━━━━━━━━

🔗 *ᴜʀʟ ɢʀᴘᴄ*

\`\`\`
${vlessData.vless_grpc_link}
\`\`\`

━━━━━━━━━━━━━━━━━━━━━━

💾 *ꜱᴀᴠᴇ ᴀᴄᴄᴏᴜɴᴛ*

https://${vlessData.domain}:81/vless-${vlessData.username}.txt

━━━━━━━━━━━━━━━━━━━━━━

🎉 *ᴀᴄᴄᴏᴜɴᴛ ʙᴇʀʜᴀꜱɪʟ ᴅɪʙᴜᴀᴛ*

🤝 ᴛᴇʀɪᴍᴀ ᴋᴀꜱɪʜ
ꜱᴇʟᴀᴍᴀᴛ ᴍᴇɴɢɢᴜɴᴀᴋᴀɴ
ʟᴀʏᴀɴᴀɴ ᴋᴀᴍɪ. ❤️
`;
              console.log('VLESS account created successfully');
              return resolve({
    message: msg,
    config: {
        tls: vlessData.vless_tls_link,
        http: vlessData.vless_nontls_link,
        grpc: vlessData.vless_grpc_link
    }
});
            } else {
              console.log('Error creating VLESS account');
              return resolve(`❌ Gagal: ${response.data.message}`);
            }
          })
        .catch(error => {
          console.error('Error saat membuat VLESS:', error);
          return resolve('❌ Gagal membuat VLESS. Silakan coba lagi nanti.');
        });
    });
  });
}
async function createtrojan(username, exp, quota, limitip, serverId) {
  console.log(`Creating Trojan account for ${username} with expiry ${exp} days, quota ${quota} GB, limit IP ${limitip} on server ${serverId}`);
  
  if (/\s/.test(username) || /[^a-zA-Z0-9]/.test(username)) {
    return '❌ Username tidak valid. Mohon gunakan hanya huruf dan angka tanpa spasi.';
  }

  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM Server WHERE id = ?', [serverId], (err, server) => {
      if (err) {
        console.error('Error fetching server:', err.message);
        return resolve('❌ Gagal: Server tidak ditemukan. Silakan coba lagi.');
      }

      if (!server) return resolve('❌ Gagal: Server tidak ditemukan. Silakan coba lagi.');

      const domain = server.domain;
      const auth = server.auth;
      const cloudfront = server.cloudfront || "-"; // <-- pindah ke sini
      const param = `:5888/createtrojan?user=${username}&exp=${exp}&quota=${quota}&iplimit=${limitip}&auth=${auth}`;
      const url = `http://${domain}${param}`;
      axios.get(url)
        .then(response => {
          if (response.data.status === "success") {
            const trojanData = response.data.data;
            const msg = `
╭━━━━━━━━━━━━━━━━━━━━━━╮
     🐎 *ᴛʀᴏᴊᴀɴ ᴀᴄᴄᴏᴜɴᴛ*
╰━━━━━━━━━━━━━━━━━━━━━━╯

┌〔 📄 *ᴀᴄᴄᴏᴜɴᴛ ɪɴꜰᴏ* 〕
├ 👤 ᴜꜱᴇʀɴᴀᴍᴇ : \`${trojanData.username}\`
├ 🆔 ᴜᴜɪᴅ      : \`${trojanData.uuid}\`
├ 📅 ᴇxᴘɪʀᴇᴅ   : \`${trojanData.expired}\`
├ 📦 Qᴜᴏᴛᴀ     : \`${trojanData.quota === '0 GB' ? 'Unlimited' : trojanData.quota}\`
├ 🌐 ɪᴘ ʟɪᴍɪᴛ  : \`${trojanData.ip_limit === '0' ? 'Unlimited' : trojanData.ip_limit} IP\`
└ 🟢 ꜱᴛᴀᴛᴜꜱ    : \`ACTIVE\`

━━━━━━━━━━━━━━━━━━━━━━

┌〔 🌍 *ꜱᴇʀᴠᴇʀ* 〕
├ 🌐 ᴅᴏᴍᴀɪɴ      : \`${trojanData.domain}\`
├ ☁️ ᴄʟᴏᴜᴅꜰʀᴏɴᴛ  : \`${cloudfront}\`
├ 🔐 ᴛʟꜱ ᴘᴏʀᴛ    : \`443,8443\`
├ 🌍 ʜᴛᴛᴘ ᴘᴏʀᴛ   : \`80,8080,2086,8880\`
├ 📂 ᴘᴀᴛʜ        : \`/trojan-ws\`
└ 🚀 ɢʀᴘᴄ ᴘᴀᴛʜ   : \`trojan-grpc\`

━━━━━━━━━━━━━━━━━━━━━━

🔗 *ᴜʀʟ ᴛʟꜱ*

\`\`\`
${trojanData.trojan_tls_link}
\`\`\`

━━━━━━━━━━━━━━━━━━━━━━

🔗 *ᴜʀʟ ɢʀᴘᴄ*

\`\`\`
${trojanData.trojan_grpc_link}
\`\`\`

━━━━━━━━━━━━━━━━━━━━━━

💾 *ꜱᴀᴠᴇ ᴀᴄᴄᴏᴜɴᴛ*

https://${trojanData.domain}:81/trojan-${trojanData.username}.txt

━━━━━━━━━━━━━━━━━━━━━━

🎉 *ᴀᴄᴄᴏᴜɴᴛ ʙᴇʀʜᴀꜱɪʟ ᴅɪʙᴜᴀᴛ*

🤝 ᴛᴇʀɪᴍᴀ ᴋᴀꜱɪʜ
ꜱᴇʟᴀᴍᴀᴛ ᴍᴇɴɢɢᴜɴᴀᴋᴀɴ
ʟᴀʏᴀɴᴀɴ ᴋᴀᴍɪ. ❤️
`;
              console.log('Trojan account created successfully');
              return resolve({
    message: msg,
    config: {
        tls: trojanData.trojan_tls_link,
        grpc: trojanData.trojan_grpc_link
    }
});
            } else {
              console.log('Error creating Trojan account');
              return resolve(`❌ Gagal: ${response.data.message}`);
            }
          })
        .catch(error => {
          console.error('Error saat membuat Trojan:', error);
          return resolve('❌ Gagal membuat Trojan. Silakan coba lagi nanti.');
        });
    });
  });
}

async function createshadowsocks(username, exp, quota, limitip, serverId) {
  console.log(`Creating Shadowsocks account for ${username} with expiry ${exp} days, quota ${quota} GB, limit IP ${limitip} on server ${serverId}`);
  
  if (/\s/.test(username) || /[^a-zA-Z0-9]/.test(username)) {
    return '❌ Username tidak valid. Mohon gunakan hanya huruf dan angka tanpa spasi.';
  }

  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM Server WHERE id = ?', [serverId], (err, server) => {
      if (err) {
        console.error('Error fetching server:', err.message);
        return resolve('❌ Gagal: Server tidak ditemukan. Silakan coba lagi.');
      }

      if (!server) return resolve('❌ Gagal: Server tidak ditemukan. Silakan coba lagi.');

      const domain = server.domain;
      const auth = server.auth;
      const cloudfront = server.cloudfront || "-"; // <-- pindah ke sini
      const param = `:5888/createshadowsocks?user=${username}&exp=${exp}&quota=${quota}&iplimit=${limitip}&auth=${auth}`;
      const url = `http://${domain}${param}`;
      axios.get(url)
        .then(response => {
          if (response.data.status === "success") {
            const shadowsocksData = response.data.data;
            const msg = `
╭━━━━━━━━━━━━━━━━━━━━━━╮
   🔰 *ꜱʜᴀᴅᴏᴡꜱᴏᴄᴋꜱ ᴀᴄᴄᴏᴜɴᴛ*
╰━━━━━━━━━━━━━━━━━━━━━━╯

┌〔 📄 *ᴀᴄᴄᴏᴜɴᴛ ɪɴꜰᴏ* 〕
├ 👤 ᴜꜱᴇʀɴᴀᴍᴇ : \`${shadowsocksData.username}\`
├ 🆔 ᴜᴜɪᴅ      : \`${shadowsocksData.uuid}\`
├ 📅 ᴇxᴘɪʀᴇᴅ   : \`${shadowsocksData.expired}\`
├ 📦 Qᴜᴏᴛᴀ     : \`${shadowsocksData.quota === '0 GB' ? 'Unlimited' : shadowsocksData.quota}\`
├ 🌐 ɪᴘ ʟɪᴍɪᴛ  : \`${shadowsocksData.ip_limit === '0' ? 'Unlimited' : shadowsocksData.ip_limit} IP\`
└ 🟢 ꜱᴛᴀᴛᴜꜱ    : \`ACTIVE\`

━━━━━━━━━━━━━━━━━━━━━━

┌〔 🌍 *ꜱᴇʀᴠᴇʀ* 〕
├ 🌐 ᴅᴏᴍᴀɪɴ      : \`${shadowsocksData.domain}\`
├ ☁️ ᴄʟᴏᴜᴅꜰʀᴏɴᴛ  : \`${cloudfront}\`
├ 🔐 ᴛʟꜱ ᴘᴏʀᴛ    : \`443,8443\`
├ 🌍 ʜᴛᴛᴘ ᴘᴏʀᴛ   : \`80,8080,2086,8880\`
├ 📂 ᴘᴀᴛʜ        : \`/ss-ws\`
└ 🚀 ɢʀᴘᴄ ᴘᴀᴛʜ   : \`ss-grpc\`

━━━━━━━━━━━━━━━━━━━━━━

🔗 *ᴜʀʟ ᴛʟꜱ*

\`\`\`
${shadowsocksData.ss_link_ws}
\`\`\`

━━━━━━━━━━━━━━━━━━━━━━

🔗 *ᴜʀʟ ʜᴛᴛᴘ*

\`\`\`
${shadowsocksData.ss_link_nontls}
\`\`\`

━━━━━━━━━━━━━━━━━━━━━━

🔗 *ᴜʀʟ ɢʀᴘᴄ*

\`\`\`
${shadowsocksData.ss_link_grpc}
\`\`\`

━━━━━━━━━━━━━━━━━━━━━━

💾 *ꜱᴀᴠᴇ ᴀᴄᴄᴏᴜɴᴛ*

https://${shadowsocksData.domain}:81/ss-${shadowsocksData.username}.txt

━━━━━━━━━━━━━━━━━━━━━━

🎉 *ᴀᴄᴄᴏᴜɴᴛ ʙᴇʀʜᴀꜱɪʟ ᴅɪʙᴜᴀᴛ*

🤝 ᴛᴇʀɪᴍᴀ ᴋᴀꜱɪʜ
ꜱᴇʟᴀᴍᴀᴛ ᴍᴇɴɢɢᴜɴᴀᴋᴀɴ
ʟᴀʏᴀɴᴀɴ ᴋᴀᴍɪ. ❤️
`;
              console.log('Shadowsocks account created successfully');
              return resolve(msg);
            } else {
              console.log('Error creating Shadowsocks account');
              return resolve(`❌ Gagal: ${response.data.message}`);
            }
          })
        .catch(error => {
          console.error('Error saat membuat Shadowsocks:', error);
          return resolve('❌ Gagal membuat Shadowsocks. Silakan coba lagi nanti.');
        });
    });
  });
}

module.exports = { trialssh, trialvmess, trialvless, trialtrojan, trialshadowsocks, createssh, createvmess, createvless, createtrojan, createshadowsocks };
