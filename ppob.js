const { Markup } = require('telegraf');
const fs = require('fs'),
  path = require('path'),
  os = require('os'),
  { execFileSync } = require('child_process'),
  axios = require('axios');

const config = require('./src/config'),
  db = require('./src/db'),
  digi = require('./src/digiflazz'),
  payment = require('./src/payment'),
  ppobLayout = require('./src/ppob-layout');

function registerPPOB(bot, options = {}) {
  const sessions = new Map(),
    locks = new Set(),
    loading = new Map();

  const enableMiddleware = options.middleware !== false;
  const registerCommands = options.commands === true;
  const startLoopsOption = options.startLoops !== false;
  const syncOnStart = options.syncOnStart !== false;

  if (bot.__ripzzPPOBRegistered) return bot.__ripzzPPOBModule;
  bot.__ripzzPPOBRegistered = true;

  const rawTelegramSendMessage = bot.telegram.sendMessage.bind(bot.telegram);

  bot.telegram.sendMessage = async (...args) => {
    const m = await rawTelegramSendMessage(...args);
    const chatId = typeof args[0] === 'object' ? args[0]?.chat_id : args[0];

    if (String(chatId) !== String(config.channelId || '') && m?.message_id) {
      scheduleDelete(chatId, m.message_id);
    }

    return m;
  };

  const rp = n => 'Rp' + Number(n || 0).toLocaleString('id-ID');

  const esc = s =>
    String(s ?? '-')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  const roleLabel = r =>
    ({
      bronze: '🥉 BRONZE',
      silver: '🥈 SILVER',
      gold: '🥇 GOLD'
    }[r] || '🥉 BRONZE');

  const idgen = () =>
    `RZ${Date.now().toString(36).toUpperCase()}${Math.random()
      .toString(36)
      .slice(2, 7)
      .toUpperCase()}`;

  const admin = ctx => config.admins.includes(String(ctx.from.id));

  function buttonStyle(text, style, callbackData = '') {
    if (style) return style;

    const t = String(text || '').toUpperCase();
    const c = String(callbackData || '').toLowerCase();

    if (
      /❌|BATAL|CANCEL|HAPUS|DELETE|KURANGI|REMOVE|TOLAK|RESET|MIN SALDO|KELUAR/.test(t) ||
      /^(cancel|cancelbuy|adm:minsaldo|delete|remove)(:|$)/.test(c)
    ) {
      return 'danger';
    }

    if (
      /BELI|KONFIRMASI|DEPOSIT|TAMBAH|\+SALDO|RESTORE|SYNC|CEK PEMBAYARAN|DOWNLOAD|UPGRADE|LANJUT|BUY LAGI/.test(t) ||
      /^(buy|confirmbuy|deposit|buyrole|repeat|paycheck|adm:addsaldo|adm:restore|adm:sync|adm:backup)(:|$)/.test(c)
    ) {
      return 'success';
    }

    if (/^(ppob|saldo|popular:|adm:digisaldo)(:|$)/.test(c)) {
      return 'success';
    }

    if (/^type:pasca(:|$)/.test(c) || /^popular:/.test(c)) {
      return 'danger';
    }

    return 'primary';
  }

  function productCategoryStyle(category) {
    const c = String(category || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();

    if (/(^| )(data|kuota|internet)( |$)/.test(c)) return 'success';
    if (/(^| )pulsa( |$)/.test(c)) return 'primary';
    if (/(^| )games?( |$)/.test(c)) return 'danger';
    if (/(^| )pln|listrik/.test(c)) return 'success';
    if (/masa ?aktif/.test(c)) return 'success';
    if (/e ?money|emoney|uang elektronik/.test(c)) return 'primary';
    if (/vouchers?/.test(c)) return 'danger';
    if (/sms|telp|telepon/.test(c)) return 'primary';
    if (/perdana|aktivasi/.test(c)) return 'success';
    if (/tv|streaming/.test(c)) return 'primary';
    if (/gas/.test(c)) return 'success';

    return 'primary';
  }

  function productButton(text, callbackData, category) {
    return btn(text, callbackData, productCategoryStyle(category));
  }

  function btn(text, callbackData, style) {
    return {
      text: String(text),
      callback_data: String(callbackData),
      style: buttonStyle(text, style, callbackData)
    };
  }

  const photoPath = () =>
    path.isAbsolute(config.storePhoto)
      ? config.storePhoto
      : path.join(__dirname, config.storePhoto);

  function user(ctx) {
    return db.getUser(
      String(ctx.from.id),
      ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name || 'User'
    );
  }

  function ppobmenu(ctx) {
  const rows = [
    [
      {
        text: '🛒 PPOB',
        callback_data: 'ppob',
        style: 'primary'
      },
      {
        text: '💰 SALDO',
        callback_data: 'saldo',
        style: 'success'
      },
      {
        text: '➕ DEPOSIT',
        callback_data: 'deposit',
        style: 'primary'
      }
    ],
    [
      {
        text: '📜 RIWAYAT',
        callback_data: 'history',
        style: 'primary'
      },
      {
        text: '🎖️ ROLE',
        callback_data: 'role',
        style: 'primary'
      },
      {
        text: '👤 PROFIL',
        callback_data: 'profile',
        style: 'primary'
      }
    ],
    [
      {
        text: '🏠 MENU VPN',
        callback_data: 'send_main_menu',
        style: 'danger'
      }
    ]
  ];

  if (ctx && admin(ctx)) {
    rows.splice(3, 0, [
      {
        text: '🛠️ ADMIN',
        callback_data: 'admin',
        style: 'danger'
      }
    ]);
  }

  return Markup.inlineKeyboard(rows);
}

function nav(...buttons) {
  return Markup.inlineKeyboard([
    ...buttons,
    [
      {
        text: '🏠 MENU PPOB',
        callback_data: 'ppobmenu',
        style: 'primary'
      }
    ],
    [
      {
        text: '🔐 MENU VPN',
        callback_data: 'send_main_menu',
        style: 'danger'
      }
    ]
  ]);
}

  const AUTO_DELETE_INCOMING_MS = 1500;
  const AUTO_DELETE_BOT_MS = 60000;

  const protectedMessages = new Set();
  const deleteTimers = new Map();

  async function deleteMessage(chatId, messageId, force = false) {
    if (!chatId || !messageId) return false;
    const key = `${chatId}:${messageId}`;
    if (protectedMessages.has(key) && !force) return false;

    const timer = deleteTimers.get(key);
    if (timer) {
      clearTimeout(timer);
      deleteTimers.delete(key);
    }

    try {
      await bot.telegram.deleteMessage(chatId, messageId);
      return true;
    } catch {
      return false;
    }
  }

  async function deleteCtxMessage(ctx) {
    return deleteMessage(ctx.chat?.id, ctx.message?.message_id);
  }

  function protectMessage(chatId, messageId) {
    if (!chatId || !messageId) return;
    const key = `${chatId}:${messageId}`;
    protectedMessages.add(key);

    const timer = deleteTimers.get(key);
    if (timer) {
      clearTimeout(timer);
      deleteTimers.delete(key);
    }
  }

  function unprotectMessage(chatId, messageId) {
    if (!chatId || !messageId) return;
    protectedMessages.delete(`${chatId}:${messageId}`);
  }

  function scheduleDelete(chatId, messageId, ms = AUTO_DELETE_BOT_MS) {
    if (!chatId || !messageId) return;
    const key = `${chatId}:${messageId}`;
    if (protectedMessages.has(key)) return;

    const old = deleteTimers.get(key);
    if (old) clearTimeout(old);

    const timer = setTimeout(async () => {
      deleteTimers.delete(key);
      if (!protectedMessages.has(key)) {
        await deleteMessage(chatId, messageId);
      }
    }, ms);

    deleteTimers.set(key, timer);
  }

  async function tempReply(ctx, text, extra = {}, ms = 7000) {
    try {
      const m = await ctx.reply(text, extra);
      setTimeout(() => deleteMessage(ctx.chat.id, m.message_id), ms);
      return m;
    } catch {
      return null;
    }
  }

  async function tempSend(chatId, text, extra = {}, ms = 7000) {
    try {
      const m = await bot.telegram.sendMessage(chatId, text, extra);
      setTimeout(() => deleteMessage(chatId, m.message_id), ms);
      return m;
    } catch {
      return null;
    }
  }

  async function sendPersistent(chatId, text, extra = {}) {
    try {
      return await bot.telegram.sendMessage(chatId, text, extra);
    } catch {
      return null;
    }
  }

  async function safeEdit(ctx, text, extra = {}) {
    try {
      return await ctx.editMessageText(text, { parse_mode: 'HTML', ...extra });
    } catch {
      if (ctx.callbackQuery?.message?.message_id) {
        unprotectMessage(ctx.chat?.id, ctx.callbackQuery.message.message_id);
        await deleteMessage(ctx.chat?.id, ctx.callbackQuery.message.message_id, true);
      }
      return ctx.reply(text, { parse_mode: 'HTML', ...extra });
    }
  }

  async function notify(text) {
    if (!config.channelId) return;
    try {
      await bot.telegram.sendMessage(config.channelId, text, { parse_mode: 'HTML' });
    } catch (e) {
      console.error('channel:', e.message);
    }
  }

  function specText(p) {
    const s = digi.destinationSpec(p.category, p.brand);
    return `${esc(s.label)} — contoh: <code>${esc(s.placeholder)}</code>`;
  }

  function price(p, type, role) {
    return digi.sellPrice(p, role, type);
  }

  function homeText() {
  const storeName = config.botName || 'ANSENDANTVPN';

  return `<b>🔥 ${storeName}</b>

<b>PPOB • DIGITAL • 24 JAM</b>

Solusi pembelian otomatis
• Cepat
• Aman
• Tanpa menunggu admin

📶 Kuota  •  📱 Pulsa  •  🎮 Game
⚡ PLN  •  💳 E-Money  •  🎟️ Voucher

💳 Deposit QRIS otomatis
🎖️ Harga menyesuaikan role member

Silakan pilih menu:`;
}
  async function sendHome(ctx) {
    if (ctx.callbackQuery?.message?.message_id) {
      unprotectMessage(ctx.chat?.id, ctx.callbackQuery.message.message_id);
      await deleteMessage(ctx.chat?.id, ctx.callbackQuery.message.message_id, true);
    }

    const photo = photoPath();
    let m = null;

    try {
      if (fs.existsSync(photo)) {
        m = await ctx.telegram.sendPhoto(
          ctx.chat.id,
          { source: photo },
          { caption: homeText(), parse_mode: 'HTML', ...ppobmenu(ctx) }
        );
      } else {
        m = await rawTelegramSendMessage(ctx.chat.id, homeText(), {
          parse_mode: 'HTML',
          ...ppobmenu(ctx)
        });
      }
    } catch (e) {
      console.error('store photo:', e.message);
      try {
        m = await rawTelegramSendMessage(ctx.chat.id, homeText(), {
          parse_mode: 'HTML',
          ...ppobmenu(ctx)
        });
      } catch {}
    }

    if (m?.message_id) {
      protectMessage(ctx.chat?.id, m.message_id);
    }

    return m;
  }

  function prettyCategory(c) {
    return ppobLayout.LABELS[c] || c;
  }

  function normalizeSearch(s) {
    return String(s || '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function searchProducts(type, q) {
    const needle = normalizeSearch(q);
    if (!needle) return [];

    const words = needle.split(' ').filter(Boolean);
    const all = type === 'prepaid' ? db.products().list_prepaid : db.products().list_pasca;

    return all
      .filter(p => digi.active(p))
      .map(p => {
        const hay = normalizeSearch([p.product_name, p.brand, p.category, p.buyer_sku_code].join(' '));
        const score = words.reduce((n, w) => n + (hay.includes(w) ? 1 : 0), 0);
        return { p, score };
      })
      .filter(x => x.score === words.length)
      .sort(
        (a, b) =>
          b.score - a.score ||
          String(a.p.product_name || '').length - String(b.p.product_name || '').length ||
          Number(a.p.price || 0) - Number(b.p.price || 0)
      )
      .slice(0, 20)
      .map(x => x.p);
  }

  async function showSearch(ctx, type = 'prepaid') {
    if (ctx.callbackQuery) {
      await deleteMessage(ctx.chat?.id, ctx.callbackQuery.message?.message_id);
    }

    const m = await ctx.reply(
      `🔎 <b>CARI PRODUK</b>\n\nKetik nama produk, operator, atau kata kunci.\nContoh: <code>xl 10gb</code> atau <code>telkomsel</code>\n\nKetik /batal untuk membatalkan.`,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[btn('🏠 Menu', 'home')]])
      }
    );

    sessions.set(String(ctx.from.id), {
      type: 'search',
      productType: type,
      promptMessageId: m.message_id
    });

    return m;
  }

  async function showSearchResults(ctx, type, q) {
    const u = user(ctx);
    const items = searchProducts(type, q);

    if (!items.length) {
      return tempReply(
        ctx,
        `❌ Produk untuk <b>${esc(q)}</b> tidak ditemukan.\n\nCoba kata kunci yang lebih singkat, misalnya <code>xl</code>, <code>10gb</code>, atau <code>mobile legend</code>.`,
        { parse_mode: 'HTML' },
        9000
      );
    }

    let text = `<b>🔎 HASIL PENCARIAN</b>\n` + `<i>${esc(q)}</i>\n\n`;
    const rows = [];

    items.forEach((p, i) => {
      text +=
        `<blockquote><b>${i + 1}. ${esc(p.product_name)}</b>\n` +
        `🏷️ ${esc(p.brand || prettyCategory(p.category))}\n` +
        `💰 <b>${rp(price(p, type, u.role))}</b></blockquote>\n`;

      rows.push(
        productButton(String(i + 1), `prod:${type}:${encodeURIComponent(p.buyer_sku_code)}`, p.category)
      );
    });

    const kb = [];
    for (let i = 0; i < rows.length; i += 5) {
      kb.push(rows.slice(i, i + 5));
    }

    kb.push([btn('🔎 Cari Lagi', `search:${type}`), btn('🛒 PPOB', 'ppob')]);

    return ctx.reply(text, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard(kb)
    });
  }

  async function showPopular(ctx, type = 'prepaid') {
    const u = user(ctx);
    const all = type === 'prepaid' ? db.products().list_prepaid : db.products().list_pasca;

    const txs = db.txs().filter(
      x => x.purpose === 'ppob' && ['SUCCESS', 'SUKSES'].includes(String(x.status).toUpperCase())
    );

    const count = new Map();
    txs.forEach(x => {
      count.set(String(x.sku), (count.get(String(x.sku)) || 0) + 1);
    });

    let items = all
      .filter(p => digi.active(p))
      .sort((a, b) => (count.get(String(b.buyer_sku_code)) || 0) - (count.get(String(a.buyer_sku_code)) || 0))
      .slice(0, 8);

    if (!items.length) {
      return tempReply(ctx, '❌ Produk belum tersedia.');
    }

    let text = '<b>🔥 PRODUK POPULER</b>\n\n';
    const rows = [];

    items.forEach((p, i) => {
      text +=
        `<blockquote><b>${i + 1}. ${esc(p.product_name)}</b>\n` +
        `💰 <b>${rp(price(p, type, u.role))}</b></blockquote>\n`;

      rows.push(
        productButton(String(i + 1), `prod:${type}:${encodeURIComponent(p.buyer_sku_code)}`, p.category)
      );
    });

    const kb = [];
    for (let i = 0; i < rows.length; i += 4) {
      kb.push(rows.slice(i, i + 4));
    }

    kb.push([btn('🛒 PPOB', 'ppob'), btn('🏠 Menu', 'home')]);

    return safeEdit(ctx, text, Markup.inlineKeyboard(kb));
  }

  async function showCats(ctx, type = 'prepaid') {
    const rows = digi.cats(type);

    if (!rows.length) {
      return safeEdit(
        ctx,
        `❌ Produk ${type === 'prepaid' ? 'prabayar' : 'pascabayar'} belum tersedia.\n\nAdmin: lakukan /syncproduk`,
        nav([btn('🔄 Sync', 'sync')])
      );
    }

    const u = user(ctx);
    const totalTx = db.txs().filter(x => String(x.userId) === String(u.id)).length;
    const b = [];

    for (let i = 0; i < rows.length; i += ppobLayout.CATEGORY_COLUMNS) {
      b.push(
        rows.slice(i, i + 2).map(([c]) =>
          btn(
            ppobLayout.LABELS[c] || c,
            `cat:${type}:${encodeURIComponent(c)}`,
            productCategoryStyle(c)
          )
        )
      );
    }

    b.push([btn('🔎 CARI PRODUK', `search:${type}`), btn('🔥 POPULER', `popular:${type}`)]);
    b.push([btn('🔵 Prabayar', 'type:prepaid'), btn('🟣 Pascabayar', 'type:pasca')]);
    b.push([btn('🏠 Menu Utama', 'home')]);

const storeName = config.botName || 'RIPZZ STORE';

const text =
  `<b>🛒 PPOB ${esc(storeName)}</b>\n\n` +
  `<i>Belanja kebutuhan digital otomatis — cepat, aman & 24 jam.</i>\n\n` +
  `👤 Role: <b>${roleLabel(u.role)}</b>\n` +
  `💰 Saldo: <b>${rp(u.balance)}</b>\n` +
  `📊 Total transaksi: <b>${totalTx}</b>\n\n` +
  `⚡ Harga mengikuti role kamu.\n` +
  `💳 Bayar dengan saldo atau QRIS otomatis.\n\n` +
  `<b>Pilih kategori layanan:</b>`;

return safeEdit(
  ctx,
  text,
  Markup.inlineKeyboard(b)
);
}
  async function showBrands(ctx, type, cat) {
    const rows = digi.brands(type, cat);
    if (!rows.length) {
      return safeEdit(ctx, '❌ Brand tidak ditemukan.', nav([btn('⬅️️ Kategori', 'ppob')]));
    }

    const b = [];
    for (let i = 0; i < rows.length; i += 2) {
      b.push(
        rows.slice(i, i + 2).map(([x]) =>
          btn(
            x,
            `brand:${type}:${encodeURIComponent(cat)}:${encodeURIComponent(x)}`,
            productCategoryStyle(cat)
          )
        )
      );
    }

    b.push([btn('🔎 Cari Produk', `search:${type}`)]);
    b.push([btn('⬅️ Kategori', `type:${type}`), btn('🏠 Menu', 'home')]);

    return safeEdit(
      ctx,
      `<b>🏷️ ${esc(ppobLayout.LABELS[cat] || cat)}</b>\n\nPilih provider:`,
      Markup.inlineKeyboard(b)
    );
  }

  async function showProducts(ctx, type, cat, brand, page = 0) {
    const all = digi.list(type, cat, brand);
    const size = config.pageSize;
    const start = page * size;
    const items = all.slice(start, start + size);

    if (!items.length) {
      return safeEdit(
        ctx,
        '❌ Produk tidak ditemukan.',
        nav([btn('⬅️ Brand', `cat:${type}:${encodeURIComponent(cat)}`)])
      );
    }

    const u = user(ctx);
    let text =
      `<b>📦 ${esc(cat)} — ${esc(brand)}</b>\n` +
      `<i>Halaman ${page + 1}/${Math.max(1, Math.ceil(all.length / size))}</i>\n\n`;

    const b = [];

    items.forEach((p, i) => {
      const no = i + 1;
      const pr = price(p, type, u.role);

      text +=
        `<blockquote><b>${no}. ✓ ${esc(p.product_name)}</b>\n` +
        `Harga : <b>${rp(pr)}</b></blockquote>\n`;

      b.push(
        productButton(String(no), `prod:${type}:${encodeURIComponent(p.buyer_sku_code)}`, p.category)
      );
    });

    const buttons = [];
    for (let i = 0; i < b.length; i += 5) {
      buttons.push(b.slice(i, i + 5));
    }

    const navb = [];
    if (page > 0) {
      navb.push(btn('⬅️ Prev', `page:${type}:${encodeURIComponent(cat)}:${encodeURIComponent(brand)}:${page - 1}`));
    }
    if (start + size < all.length) {
      navb.push(btn('Next ➡️', `page:${type}:${encodeURIComponent(cat)}:${encodeURIComponent(brand)}:${page + 1}`));
    }
    if (navb.length) {
      buttons.push(navb);
    }

    buttons.push([btn('⬅️ Brand', `cat:${type}:${encodeURIComponent(cat)}`), btn('🏠 Menu', 'home')]);

    return safeEdit(ctx, text, Markup.inlineKeyboard(buttons));
  }

  function productPhotoKey(category) {
    const c = normalizeSearch(category);
    if (/data|kuota|internet/.test(c)) return 'kuota';
    if (/game/.test(c)) return 'game';
    if (/pulsa/.test(c)) return 'pulsa';
    if (/masa aktif/.test(c)) return 'masaktif';
    if (/pln|listrik/.test(c)) return 'pln';
    if (/e money|emoney|uang elektronik/.test(c)) return 'emoney';
    if (/voucher/.test(c)) return 'voucher';
    if (/perdana|aktivasi perdana/.test(c)) return 'perdana';
    if (/sms|telp|telepon/.test(c)) return 'sms-telp';
    if (/tv/.test(c)) return 'tv';
    if (/gas/.test(c)) return 'gas';
    return 'default';
  }

  function productPhotoPath(category) {
    return path.join(__dirname, 'assets', 'products', productPhotoKey(category) + '.jpg');
  }

  async function showProduct(ctx, type, sku) {
    const p = digi.find(sku, type);
    if (!p) {
      return safeEdit(ctx, '❌ Produk tidak ditemukan.', nav());
    }

    const u = user(ctx);
    const pr = price(p, type, u.role);

const storeName = config.botName || 'RIPZZ STORE';

const text =
  `<b>🛍️ DETAIL PRODUK</b>\n\n` +
  `<b>${esc(p.product_name)}</b>\n\n` +
  `🏷️ Kategori: <b>${esc(prettyCategory(p.category))}</b>\n` +
  `🏪 Provider: <b>${esc(storeName)}</b>\n` +
  `💰 Harga: <b>${rp(pr)}</b>\n` +
  `📊 Status: ${p.buyer_product_status ? '🟢 Tersedia' : '🔴 Tidak tersedia'}\n\n` +
  `${specText(p)}\n\n` +
  `Tekan <b>BELI SEKARANG</b> untuk melanjutkan.`;

    const kb = Markup.inlineKeyboard([
      [btn('🛒 BELI SEKARANG', `buy:${type}:${encodeURIComponent(sku)}`)],
      [btn('⬅️ Produk', `backprod:${type}:${encodeURIComponent(p.category)}:${encodeURIComponent(p.brand)}:0`), btn('🏠 Menu', 'home')]
    ]);

    if (ctx.callbackQuery?.message?.message_id) {
      await deleteMessage(ctx.chat?.id, ctx.callbackQuery.message.message_id);
    }

    const photo = productPhotoPath(p.category);
    if (fs.existsSync(photo)) {
      try {
        return await ctx.replyWithPhoto({ source: photo }, { caption: text, parse_mode: 'HTML', ...kb });
      } catch (e) {
        console.error('product photo:', e.message);
      }
    }

    return ctx.reply(text, { parse_mode: 'HTML', ...kb });
  }

  function makeTx(ctx, extra) {
    return {
      id: idgen(),
      userId: String(ctx.from.id),
      userName: ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name || 'User',
      chatId: ctx.chat.id,
      ...extra
    };
  }

  async function createQR(ctx, tx) {
    if (ctx.callbackQuery?.message?.message_id) {
      await deleteMessage(ctx.chat?.id, ctx.callbackQuery.message.message_id);
    }

    const q = await payment.create(tx.amount);
    const paymentId = q.depositId || q.id || q.paymentId;

    if (!paymentId) {
      throw new Error('Provider QRIS tidak mengembalikan depositId');
    }

    tx.paymentId = paymentId;
    tx.qrImage = q.qrImage || q.qr_url || q.qrUrl || q.image || null;
    tx.qrData = q;
    tx.expiresAt = q.expiredAt ? new Date(q.expiredAt).getTime() : Date.now() + config.qrisExpireMinutes * 60000;

    db.updateTx(tx.id, tx);

    const cap =
      `<b>💳 PEMBAYARAN QRIS</b>\n\n` +
      `Order: <code>${tx.id}</code>\n` +
      `${tx.productName ? `Produk: <b>${esc(tx.productName)}</b>\n` : ''}` +
      `${tx.customerNo ? `Tujuan: <code>${esc(tx.customerNo)}</code>\n` : ''}` +
      `Nominal: <b>${rp(tx.amount)}</b>\n` +
      `Total QRIS: <b>${rp(q.totalAmount || q.amount || tx.amount)}</b>\n` +
      `Kode unik: <b>${rp(q.uniqueCode || 0)}</b>\n\n` +
      `⏳ Berlaku ${config.qrisExpireMinutes} menit. QR otomatis dihapus setelah lunas atau kedaluwarsa.`;

    const kb = Markup.inlineKeyboard([
      [btn('🔄 Cek Pembayaran', `paycheck:${tx.id}`)],
      [btn('❌ Batalkan', `cancel:${tx.id}`)]
    ]);

    let m = null;
    ctx.__keepNextReply = true;

    if (tx.qrImage) {
      try {
        const photo = /^data:image\/[^;]+;base64,/i.test(String(tx.qrImage))
          ? { source: Buffer.from(String(tx.qrImage).split(',')[1], 'base64') }
          : tx.qrImage;

        m = await ctx.replyWithPhoto(photo, { caption: cap, parse_mode: 'HTML', ...kb });
      } catch (e) {
        console.error('qr photo', e.message);
      }
    }

    if (!m) {
      ctx.__keepNextReply = true;
      m = await ctx.reply(cap, { parse_mode: 'HTML', ...kb });
    }

    tx.qrMessageId = m.message_id;
    db.updateTx(tx.id, { qrMessageId: m.message_id });
    protectMessage(tx.chatId, m.message_id);

    return m;
  }

  async function removeQr(tx) {
    if (tx?.qrMessageId) {
      unprotectMessage(tx.chatId, tx.qrMessageId);
      await deleteMessage(tx.chatId, tx.qrMessageId);
    }
  }

  async function startBuy(ctx, type, sku) {
    const p = digi.find(sku, type);
    if (!p || !digi.active(p)) {
      return tempReply(ctx, '❌ Produk tidak aktif.');
    }

    const u = user(ctx);
    const pr = price(p, type, u.role);

    if (ctx.callbackQuery) {
      await deleteMessage(ctx.chat?.id, ctx.callbackQuery.message?.message_id);
    }

    const s = digi.destinationSpec(p.category, p.brand);
    const prompt = await ctx.reply(
      `🛒 <b>${esc(p.product_name)}</b>\n\n` +
        `💰 Harga: <b>${rp(pr)}</b>\n\n` +
        `Kirim <b>${esc(s.label)}</b>.\n` +
        `Contoh: <code>${esc(s.placeholder)}</code>\n\n` +
        `Ketik /batal untuk membatalkan.`,
      { parse_mode: 'HTML' }
    );

    sessions.set(String(ctx.from.id), {
      type,
      sku,
      step: 'destination',
      promptMessageId: prompt.message_id
    });

    return prompt;
  }

  async function showBuyConfirm(ctx, s, customerNo) {
    const p = digi.find(s.sku, s.type);
    if (!p || !digi.active(p)) {
      return tempReply(ctx, '❌ Produk sudah tidak tersedia.');
    }

    const u = user(ctx);
    const pr = price(p, s.type, u.role);

    sessions.set(String(ctx.from.id), {
      type: s.type,
      sku: s.sku,
      step: 'confirm',
      customerNo
    });

    return ctx.reply(
      `<b>⚠️ KONFIRMASI PEMBELIAN</b>\n\n` +
        `📦 Produk: <b>${esc(p.product_name)}</b>\n` +
        `📱 Tujuan: <code>${esc(customerNo)}</code>\n` +
        `💰 Harga: <b>${rp(pr)}</b>\n` +
        `💳 Saldo: <b>${rp(u.balance)}</b>\n\n` +
        `Pastikan produk dan tujuan sudah benar sebelum melanjutkan.`,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [
            btn('✅ KONFIRMASI', `confirmbuy:${s.type}:${encodeURIComponent(s.sku)}`),
            btn('❌ BATAL', 'cancelbuy')
          ]
        ])
      }
    );
  }

  async function startLoading(chatId, text, txId) {
    const frames = ['⏳', '⌛', '⏳', '⌛'];
    const m = await bot.telegram.sendMessage(chatId, `⏳ <b>${esc(text)}</b>`, { parse_mode: 'HTML' });
    let i = 0;

    const state = {
      chatId,
      messageId: m.message_id,
      interval: null
    };

    state.interval = setInterval(async () => {
      i = (i + 1) % frames.length;
      try {
        await bot.telegram.editMessageText(chatId, m.message_id, undefined, `${frames[i]} <b>${esc(text)}</b>`, {
          parse_mode: 'HTML'
        });
      } catch {}
    }, 650);

    if (txId) {
      loading.set(txId, state);
    }

    return state;
  }

  async function stopLoading(txId) {
    const s = loading.get(txId);
    if (!s) return;

    clearInterval(s.interval);
    await deleteMessage(s.chatId, s.messageId);
    loading.delete(txId);
  }

  async function ensureLoading(tx, text) {
    if (loading.has(tx.id)) {
      return loading.get(tx.id);
    }
    return startLoading(tx.chatId, text, tx.id);
  }

  async function submitOrder(ctx, s, val) {
    const p = digi.find(s.sku, s.type);
    if (!p || !digi.active(p)) {
      return tempReply(ctx, '❌ Produk sudah tidak aktif.');
    }

    const u = user(ctx);
    const pr = price(p, s.type, u.role);

    const tx = makeTx(ctx, {
      purpose: 'ppob',
      type: s.type,
      sku: p.buyer_sku_code,
      customerNo: val,
      productName: p.product_name,
      category: p.category,
      brand: p.brand,
      amount: pr,
      role: u.role,
      status: 'WAITING_PAYMENT',
      paymentMethod: 'QRIS'
    });

    db.addTx(tx);
    sessions.delete(String(ctx.from.id));

    if (Number(u.balance) >= pr) {
      if (!db.deductBalance(u.id, pr)) {
        return tempReply(ctx, '❌ Saldo berubah dan tidak mencukupi.');
      }

      db.updateTx(tx.id, {
        status: 'PAID',
        paymentMethod: 'SALDO',
        paidAt: Date.now()
      });

      return processProduct(tx);
    }

    try {
      return await createQR(ctx, tx);
    } catch (e) {
      db.updateTx(tx.id, {
        status: 'ERROR',
        error: e.message
      });
      return tempReply(ctx, '❌ Gagal membuat pembayaran: ' + esc(e.message), { parse_mode: 'HTML' });
    }
  }

  async function processProduct(tx) {
    const lock = `trx:${tx.id}`;
    if (locks.has(lock)) return;
    locks.add(lock);

    let spinner = null;

    try {
      const fresh = db.getTx(tx.id);
      if (!fresh || fresh.status === 'SUCCESS' || fresh.status === 'REFUNDED') {
        return;
      }

      spinner = await ensureLoading(fresh, 'Memproses pesanan');
      db.updateTx(fresh.id, { status: 'PROCESSING' });

      const r = await digi.transaction({
        sku: fresh.sku,
        customerNo: fresh.customerNo,
        refId: fresh.id,
        type: fresh.type
      });

      const status = String(r?.status || 'PENDING').toUpperCase();
      db.updateTx(fresh.id, {
        digiflazz: r,
        status: status === 'PENDING' ? 'PENDING' : status,
        submittedAt: Date.now(),
        sn: r?.sn || ''
      });

      if (['SUKSES', 'SUCCESS'].includes(status)) {
        await stopLoading(fresh.id);
        await finishSuccess(db.getTx(fresh.id));
      } else if (['GAGAL', 'FAILED'].includes(status)) {
        await stopLoading(fresh.id);
        await refundFailed(db.getTx(fresh.id), r?.message);
      }
    } catch (e) {
      console.error('processProduct', tx.id, e.message);
      await stopLoading(tx.id);
      db.updateTx(tx.id, {
        status: 'PROCESSING_ERROR',
        error: e.message
      });
      await tempSend(
        tx.chatId,
        '⚠️ Pesanan diterima, tetapi supplier belum dapat diproses. Hubungi admin dengan Order ID: ' + tx.id
      );
    } finally {
      locks.delete(lock);
    }
  }

  async function finishSuccess(tx) {
    const r = tx.digiflazz || {};
    db.updateTx(tx.id, {
      status: 'SUCCESS',
      completedAt: Date.now(),
      sn: r.sn || tx.sn || ''
    });

    const storeName = config.botName || 'ANSENDANTVPN';

const text =
  `<b>🎉 PEMBELIAN BERHASIL</b>\n\n` +
  `<b>🧾 Detail Pesanan</b>\n` +
  `├ Order : <code>${esc(tx.id)}</code>\n` +
  `├ Produk : <b>${esc(tx.productName)}</b>\n` +
  `├ Tujuan : <code>${esc(tx.customerNo)}</code>\n` +
  `├ Harga : <b>${rp(tx.amount)}</b>\n` +
  `└ Status : <b>BERHASIL ✅</b>\n\n` +
  `<b>🔐 Serial Number</b>\n` +
  `<code>${esc(r.sn || '-')}</code>` +
  `${r.message ? `\n\n💬 ${esc(r.message)}` : ''}\n\n` +
  `Terima kasih telah berbelanja di <b>${esc(storeName)}</b> 💜`;

await sendPersistent(
  tx.chatId,
  text,
  { parse_mode: 'HTML' }
);

await notify(
  `<b>╭━━━ 🧾 ${esc(storeName)} ━━━╮</b>
<b>┃ ✅ TRANSAKSI BERHASIL</b>
<b>╰━━━━━━━━━━━━━━━━━━━━╯</b>

<b>📦 Produk</b> : ${esc(tx.productName)}
<b>📱 Tujuan</b> : <code>${esc(tx.customerNo)}</code>
<b>💰 Nominal</b> : <b>${rp(tx.amount)}</b>
<b>👤 User</b> : ${esc(tx.userName)}
<b>🆔 Order ID</b> : <code>${esc(tx.id)}</code>
<b>📌 Status</b> : <b>SUCCESS</b>
<b>🔐 SN</b> : <code>${esc(r.sn || '-')}</code>

<i>Terima kasih telah menggunakan layanan ${esc(storeName)}.</i>`
);
}
  async function refundFailed(tx, msg) {
    if (!tx) return;

    const refundable = ['SALDO', 'QRIS'].includes(String(tx.paymentMethod || '').toUpperCase());

    if (!tx.refunded && refundable) {
      const bal = db.addBalance(tx.userId, tx.amount);
      db.updateTx(tx.id, {
        refunded: true,
        status: 'REFUNDED',
        refundedAt: Date.now(),
        refundAmount: tx.amount,
        refundBalance: bal
      });
    } else if (tx.refunded) {
      db.updateTx(tx.id, {
        status: 'REFUNDED',
        failureMessage: msg || 'Transaksi gagal'
      });
    } else {
      db.updateTx(tx.id, {
        status: 'FAILED',
        failureMessage: msg || 'Transaksi gagal'
      });
    }

    const t = db.getTx(tx.id);

    await sendPersistent(
      t.chatId,
      `<b>⚠️ TRANSAKSI GAGAL</b>\n\n` +
        `Order: <code>${t.id}</code>\n` +
        `Produk: <b>${esc(t.productName)}</b>\n` +
        `Pesan: ${esc(msg || '-')}\n\n` +
        `${
          t.refunded
            ? 'Dana pembayaran telah dikembalikan ke saldo akun kamu.'
            : 'Pembayaran belum dikembalikan otomatis karena status transaksi belum memenuhi syarat refund.'
        }`,
      { parse_mode: 'HTML' }
    ).catch(() => {});

await notify(
  `<b>╭━━━ 🧾 ${esc(storeName)} ━━━╮</b>
<b>┃ ❌ TRANSAKSI GAGAL</b>
<b>╰━━━━━━━━━━━━━━━━━━━━╯</b>

<b>📦 Produk</b> : ${esc(t.productName)}
<b>📱 Tujuan</b> : <code>${esc(t.customerNo || '-')}</code>
<b>💰 Nominal</b> : <b>${rp(t.amount)}</b>
<b>👤 User</b> : ${esc(t.userName)}
<b>🆔 Order ID</b> : <code>${esc(t.id)}</code>
<b>📌 Status</b> : <b>GAGAL ❌</b>

<i>Silakan hubungi admin jika diperlukan.</i>`
);
  }

  async function checkPayment(tx) {
    if (!tx || tx.status !== 'WAITING_PAYMENT' || !tx.paymentId) {
      return false;
    }

    try {
      const r = await payment.status(tx.paymentId);

      if (payment.paid(r)) {
        await removeQr(tx);

        db.updateTx(tx.id, {
          status: 'PAID',
          paidAt: Date.now(),
          paymentData: r
        });

        if (tx.purpose === 'saldotopup') {
          const bal = db.addBalance(tx.userId, tx.amount);
          db.updateTx(tx.id, {
            status: 'SUCCESS',
            completedAt: Date.now(),
            newBalance: bal
          });

          await sendPersistent(
            tx.chatId,
            `<b>✅ DEPOSIT BERHASIL</b>\n\n` +
              `Nominal: <b>${rp(tx.amount)}</b>\n` +
              `Saldo sekarang: <b>${rp(bal)}</b>`,
            { parse_mode: 'HTML' },
            15000
          );

await notify(
  `<b>╭━━━ 💳 ${esc(storeName)} ━━━╮</b>
<b>┃ 💰 DEPOSIT BERHASIL</b>
<b>╰━━━━━━━━━━━━━━━━━━━━╯</b>

<b>💵 Nominal</b> : <b>${rp(tx.amount)}</b>
<b>👤 User</b> : ${esc(tx.userName)}
<b>🆔 Order ID</b> : <code>${esc(tx.id)}</code>
<b>📌 Status</b> : <b>SUCCESS ✅</b>
<b>💰 Saldo Baru</b> : <b>${rp(bal)}</b>`
);

          return true;
        }

        if (tx.purpose === 'role_upgrade') {
          const u = db.getUser(tx.userId);
          db.setUser(tx.userId, { role: tx.targetRole });
          db.updateTx(tx.id, { status: 'SUCCESS', completedAt: Date.now() });

          await sendPersistent(
            tx.chatId,
            `<b>🎖️️ UPGRADE ROLE BERHASIL</b>\n\n` +
              `Role lama: ${roleLabel(u.role)}\n` +
              `Role baru: ${roleLabel(tx.targetRole)}\n` +
              `Biaya: <b>${rp(tx.amount)}</b>`,
            { parse_mode: 'HTML' },
            15000
          );

          return true;
        }

        await processProduct(db.getTx(tx.id));
        return true;
      }

      return false;
    } catch (e) {
      console.error('payment check', tx.id, e.message);
      return false;
    }
  }

  async function paymentLoop() {
    for (const tx of db.pendingPayments()) {
      if (tx.expiresAt && Date.now() > tx.expiresAt) {
        await removeQr(tx);
        db.updateTx(tx.id, { status: 'EXPIRED' });
        await tempSend(tx.chatId, `⏰ Pembayaran QRIS <code>${tx.id}</code> telah kedaluwarsa.`, {
          parse_mode: 'HTML'
        });
        continue;
      }
      await checkPayment(tx);
    }
  }

  async function trxLoop() {
    for (const tx of db.pendingProducts()) {
      if (tx.status === 'PAID') {
        await processProduct(tx);
      } else if (tx.status === 'PROCESSING' || tx.status === 'PENDING') {
        const polls = Number(tx.polls || 0);

        if (polls >= config.trxMaxPolls) {
          await stopLoading(tx.id);
          db.updateTx(tx.id, {
            status: 'TIMEOUT',
            timeoutAt: Date.now()
          });
          await sendPersistent(
            tx.chatId,
            `<b>⚠️ TRANSAKSI BELUM SELESAI</b>\n\n` +
              `Order: <code>${tx.id}</code>\n` +
              `Supplier belum memberikan hasil dalam batas waktu pengecekan. Hubungi admin jika saldo belum kembali.`,
            { parse_mode: 'HTML' },
            15000
          );
          continue;
        }

        try {
          await ensureLoading(tx, 'Menunggu hasil transaksi');
          const r = await digi.transaction({
            sku: tx.sku,
            customerNo: tx.customerNo,
            refId: tx.id,
            type: tx.type
          });

          const st = String(r?.status || 'PENDING').toUpperCase();
          db.updateTx(tx.id, {
            digiflazz: r,
            status: st,
            polls: polls + 1,
            lastPollAt: Date.now()
          });

          if (['SUKSES', 'SUCCESS'].includes(st)) {
            await stopLoading(tx.id);
            await finishSuccess(db.getTx(tx.id));
          } else if (['GAGAL', 'FAILED'].includes(st)) {
            await stopLoading(tx.id);
            await refundFailed(db.getTx(tx.id), r?.message);
          }
        } catch (e) {
          db.updateTx(tx.id, {
            polls: polls + 1,
            lastPollError: e.message
          });
        }
      }
    }
  }

  function adminMenuMarkup() {
    return Markup.inlineKeyboard([
      [btn('🗄 Backup', 'adm:backup'), btn('♻️ Restore', 'adm:restore')],
      [btn('📣 Broadcast', 'adm:broadcast'), btn('💰 +Saldo', 'adm:addsaldo')],
      [btn('💸 -Saldo', 'adm:minsaldo'), btn('👥 User', 'adm:users')],
      [btn('📊 Statistik', 'adm:stats'), btn('📋 Log', 'adm:log')],
      [btn('🔄 Sync Produk', 'adm:sync'), btn('💳 Saldo Supplier', 'adm:digisaldo')],
      [btn('⬅️ Menu Utama', 'home')]
    ]);
  }

  function adminGuard(ctx) {
    if (!admin(ctx)) {
      tempReply(ctx, '❌ Menu ini khusus admin.');
      return false;
    }
    return true;
  }

  function dataFiles() {
    const dir = path.dirname(db.files.users);
    return ['users.json', 'transactions.json', 'digiflazz-cache.json', 'settings.json'].map(x =>
      path.join(dir, x)
    );
  }

  function makeBackup() {
    const out = path.join(os.tmpdir(), `ripzz-ppob-backup-${Date.now()}.tar.gz`);
    const files = dataFiles().map(x => path.basename(x));

    execFileSync(
      'tar',
      ['-czf', out, '-C', path.dirname(dataFiles()[0]), ...files],
      { stdio: 'ignore' }
    );

    return out;
  }

  async function restoreBackupFromTelegram(ctx) {
    const doc = ctx.message.document;
    if (!doc) return false;

    if (!/\.tar\.gz$|\.tgz$/i.test(doc.file_name || '')) {
      await tempReply(ctx, '❌ File restore harus .tar.gz atau .tgz.');
      return true;
    }

    const link = await ctx.telegram.getFileLink(doc.file_id);
    const tmp = path.join(os.tmpdir(), `ripzz-restore-${Date.now()}.tar.gz`);

    const res = await axios.get(String(link), {
      responseType: 'arraybuffer',
      timeout: 60000
    });

    fs.writeFileSync(tmp, res.data);

    try {
      const listing = execFileSync('tar', ['-tzf', tmp], { encoding: 'utf8' })
        .split(/\r?\n/)
        .filter(Boolean);

      const allowed = new Set(['users.json', 'transactions.json', 'digiflazz-cache.json', 'settings.json']);

      if (!listing.length || listing.some(x => x.includes('/') || !allowed.has(x.trim()))) {
        throw new Error('Arsip tidak valid.');
      }

      const dataDir = path.dirname(db.files.users);
      const safety = path.join(os.tmpdir(), `ripzz-pre-restore-${Date.now()}.tar.gz`);

      execFileSync('tar', ['-czf', safety, '-C', dataDir, ...allowed], { stdio: 'ignore' });
      execFileSync('tar', ['-xzf', tmp, '-C', dataDir, '--no-same-owner'], { stdio: 'ignore' });

      fs.unlinkSync(tmp);

      await tempReply(
        ctx,
        '✅ <b>RESTORE BERHASIL</b>\nData users, transaksi, produk, dan settings telah dipulihkan.',
        { parse_mode: 'HTML' }
      );

      return true;
    } catch (e) {
      try {
        fs.unlinkSync(tmp);
      } catch {}
      await tempReply(ctx, '❌ Restore gagal: ' + esc(e.message), { parse_mode: 'HTML' });
      return true;
    }
  }

  async function adminPanel(ctx, edit = false) {
    const storeName = config.botName || 'RIPZZ STORE';

const text =
  `<b>🛠️ PANEL ADMIN ${esc(storeName)}</b>\n\n` +
  `<i>Kelola seluruh sistem toko dari satu tempat.</i>\n\n` +
  `🔐 <b>Akses Administrator</b>\n` +
  `⚙️ Kelola pengguna, transaksi & layanan\n` +
  `📊 Pantau aktivitas sistem\n` +
  `💳 Kelola pembayaran & saldo\n\n` +
  `<b>Silakan pilih fungsi administrasi:</b>`;
    return edit ? safeEdit(ctx, text, adminMenuMarkup()) : ctx.reply(text, { parse_mode: 'HTML', ...adminMenuMarkup() });
  }

  async function adminUsers(ctx) {
    const us = db.users();
    const arr = Object.values(us);

    if (!arr.length) {
      return tempReply(ctx, '👥 Belum ada user.');
    }

    arr.sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));

    let text = `<b>👥 DATA USER</b>\n` + `Total: <b>${arr.length}</b>\n\n`;

    arr.slice(0, 30).forEach((u, i) => {
      text +=
        `${i + 1}. <code>${esc(u.id)}</code> ${esc(u.name || 'User')}\n` +
        `   ${roleLabel(u.role)} • ${rp(u.balance)}\n\n`;
    });

    if (arr.length > 30) {
      text += '<i>Menampilkan 30 user terbaru.</i>';
    }

    return ctx.reply(text, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([[btn('⬅️ Admin', 'admin')]])
    });
  }

  async function adminStats(ctx) {
    const us = Object.values(db.users());
    const tx = db.txs();
    const success = tx.filter(x => x.status === 'SUCCESS');
    const pending = tx.filter(x => ['WAITING_PAYMENT', 'PAID', 'PROCESSING', 'PENDING'].includes(x.status));

    const omzet = success
      .filter(x => x.purpose === 'ppob')
      .reduce((n, x) => n + Number(x.amount || 0), 0);

    return ctx.reply(
      `<b>📊 STATISTIK</b>\n\n` +
        `👥 User: <b>${us.length}</b>\n` +
        `📦 Transaksi: <b>${tx.length}</b>\n` +
        `✅ Sukses: <b>${success.length}</b>\n` +
        `⏳ Pending: <b>${pending.length}</b>\n` +
        `💰 Omzet PPOB: <b>${rp(omzet)}</b>`,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[btn('⬅️ Admin', 'admin')]])
      }
    );
  }

  async function adminLog(ctx) {
    const tx = db.txs().slice(0, 20);
    if (!tx.length) {
      return tempReply(ctx, '📋 Log transaksi kosong.');
    }

    let text = '<b>📋 LOG TRANSAKSI</b>\n\n';
    tx.forEach(x => {
      text +=
        `<code>${esc(x.id)}</code> • ${esc(x.productName || x.purpose || '-')}\n` +
        `${rp(x.amount)} • <b>${esc(x.status || '-')}</b>\n\n`;
    });

    return ctx.reply(text, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([[btn('⬅️ Admin', 'admin')]])
    });
  }

  async function broadcast(ctx, text) {
    const us = Object.values(db.users());
    let ok = 0;
    let fail = 0;

    for (const u of us) {
      if (!u.id) continue;
      try {
        await bot.telegram.sendMessage(String(u.id), text, { parse_mode: 'HTML' });
        ok++;
      } catch {
        try {
          await bot.telegram.sendMessage(String(u.id), text);
          ok++;
        } catch {
          fail++;
        }
      }
      await new Promise(r => setTimeout(r, 40));
    }

    return { total: us.length, ok, fail };
  }

  async function roleMenu(ctx) {
    const u = user(ctx);
    let text =
      `<b>🎖️ ROLE PPOB</b>\n\n` +
      `Role: ${roleLabel(u.role)}\n\n` +
      `🥉 Bronze: +${config.roles.margin.bronze}%\n` +
      `🥈 Silver: +${config.roles.margin.silver}%\n` +
      `🥇 Gold: +${config.roles.margin.gold}%`;

    const b = [];
    if (u.role === 'bronze' && config.roles.price.silver > 0) {
      b.push([btn(`🥈 Silver · ${rp(config.roles.price.silver)}`, 'buyrole:silver')]);
    }
    if (['bronze', 'silver'].includes(u.role) && config.roles.price.gold > 0) {
      b.push([btn(`🥇 Gold · ${rp(config.roles.price.gold)}`, 'buyrole:gold')]);
    }

    b.push([btn('🏠 Menu', 'home')]);
    return safeEdit(ctx, text, Markup.inlineKeyboard(b));
  }

  function requiredChannelId() {
    return String(config.requiredChannelId || '').trim();
  }

  function requiredChannelUrl() {
    const id = requiredChannelId();
    if (config.requiredChannelUrl) {
      return String(config.requiredChannelUrl).trim();
    }
    if (/^@[A-Za-z0-9_]{5,}$/.test(id)) {
      return `https://t.me/${id.slice(1)}`;
    }
    return '';
  }

  function channelJoinedFlag(id) {
    const d = db.users();
    return Boolean(d[String(id)]?.channelJoinedAt);
  }

  async function verifyRequiredChannel(ctx) {
    if (!config.requiredChannelId || !ctx.from?.id) return true;
    if (admin(ctx)) return true;
    if (channelJoinedFlag(ctx.from.id)) return true;

    try {
      const member = await bot.telegram.getChatMember(config.requiredChannelId, ctx.from.id);
      const status = String(member?.status || '').toLowerCase();
      const joined =
        ['creator', 'administrator', 'member'].includes(status) ||
        (status === 'restricted' && member?.is_member === true);

      if (joined) {
        db.setUser(String(ctx.from.id), {
          channelJoinedAt: Date.now(),
          channelJoinedId: String(config.requiredChannelId)
        });
        return true;
      }
    } catch (e) {
      console.error('channel membership check:', e.message);
      if (!config.requiredChannelUrl && !/^@[A-Za-z0-9_]{5,}$/.test(requiredChannelId())) {
        return true;
      }
    }

    const url = requiredChannelUrl();
    const rows = [];
    if (url) {
      rows.push([Markup.button.url('📢 GABUNG CHANNEL', url)]);
    }
    rows.push([btn('🔄 SAYA SUDAH GABUNG', 'checkjoin')]);

const m = await ctx.reply(
  `<b>🔒 AKSES TERBATAS</b>\n\n` +
  `Sebelum menggunakan <b>${esc(storeName)}</b>, ` +
  `silakan bergabung terlebih dahulu ke channel resmi kami.\n\n` +
  `Setelah bergabung, tekan <b>🔄 SAYA SUDAH GABUNG</b>.\n\n` +
  `<i>Jika kamu sudah pernah diverifikasi, pesan ini tidak akan muncul lagi.</i>`,
  {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard(rows)
  }
);

    if (m?.message_id) {
      protectMessage(ctx.chat?.id, m.message_id);
    }

    return false;
  }

  if (enableMiddleware) {
    bot.use(async (ctx, next) => {
      const r = ctx.reply;
      const rp = ctx.replyWithPhoto;
      const rd = ctx.replyWithDocument;

      if (ctx.callbackQuery?.data === 'checkjoin') {
        // diproses di handler khusus
      } else if (!(await verifyRequiredChannel(ctx))) {
        if (ctx.callbackQuery) {
          await ctx.answerCbQuery('Silakan gabung channel terlebih dahulu.', { show_alert: true }).catch(() => {});
        }
        return;
      }

      ctx.reply = async (...args) => {
        const keep = ctx.__keepNextReply === true;
        ctx.__keepNextReply = false;
        const m = await r.apply(ctx, args);
        if (!keep) scheduleDelete(ctx.chat?.id, m?.message_id);
        return m;
      };

      ctx.replyWithPhoto = async (...args) => {
        const keep = ctx.__keepNextReply === true;
        ctx.__keepNextReply = false;
        const m = await rp.apply(ctx, args);
        if (!keep) scheduleDelete(ctx.chat?.id, m?.message_id);
        return m;
      };

      ctx.replyWithDocument = async (...args) => {
        const keep = ctx.__keepNextReply === true;
        ctx.__keepNextReply = false;
        const m = await rd.apply(ctx, args);
        if (!keep) scheduleDelete(ctx.chat?.id, m?.message_id);
        return m;
      };

      try {
        return await next();
      } finally {
        if (ctx.message?.message_id) {
          setTimeout(() => deleteCtxMessage(ctx), AUTO_DELETE_INCOMING_MS);
        }
      }
    });
  }

  const handleCommand = (name, handler) => {
    if (registerCommands) {
      bot.command(name, handler);
    }
  };

  handleCommand('start', ctx => sendHome(ctx));
  handleCommand('menu', ctx => sendHome(ctx));
  handleCommand('batal', async ctx => {
    await deleteCtxMessage(ctx);
    const s = sessions.get(String(ctx.from.id));
    if (s?.promptMessageId) {
      await deleteMessage(ctx.chat.id, s.promptMessageId);
    }
    sessions.delete(String(ctx.from.id));
    return tempReply(ctx, '✅ Proses dibatalkan.');
  });
  handleCommand('saldo', async ctx => {
    await deleteCtxMessage(ctx);
    const u = user(ctx);
    return ctx.reply(
      `<b>💰 SALDO</b>\n` + `Saldo: <b>${rp(u.balance)}</b>\n` + `Role: ${roleLabel(u.role)}`,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [btn('➕ Deposit', 'deposit'), btn('🛒 PPOB', 'ppob')]
        ])
      }
    );
  });
  handleCommand('profile', async ctx => {
    await deleteCtxMessage(ctx);
    const u = user(ctx);
    return ctx.reply(
      `<b>👤 PROFIL</b>\n` + `Role: ${roleLabel(u.role)}\n` + `Saldo: <b>${rp(u.balance)}</b>`,
      { parse_mode: 'HTML', ...nav() }
    );
  });
  handleCommand('ppob', async ctx => {
    await deleteCtxMessage(ctx);
    const storeName = config.botName || 'RIPZZ STORE';

return ctx.reply(
  `<b>🛒 PPOB ${esc(storeName)}</b>\n\n` +
  `<i>Pilih kategori layanan yang ingin kamu beli:</i>`,
  {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [btn('🔵 Prabayar', 'type:prepaid'), btn('🟣 Pascabayar', 'type:pasca')],
        [btn('🏠 Menu', 'home')]
      ])
    });
  });
  handleCommand('depo', async ctx => {
    await deleteCtxMessage(ctx);
    const a = Number(String(ctx.message.text).split(/\s+/)[1] || 0);
    if (!a || a < 1000) {
      return tempReply(ctx, 'Format: /depo 10000');
    }

    const tx = makeTx(ctx, {
      purpose: 'saldotopup',
      productName: 'Deposit Saldo',
      amount: a,
      status: 'WAITING_PAYMENT',
      paymentMethod: 'QRIS'
    });

    db.addTx(tx);
    try {
      await createQR(ctx, tx);
    } catch (e) {
      db.updateTx(tx.id, { status: 'ERROR', error: e.message });
      return tempReply(ctx, '❌ ' + esc(e.message), { parse_mode: 'HTML' });
    }
  });

  function historyData(userId) {
    return db.txs().filter(x => String(x.userId) === String(userId));
  }

  function historyView(ctx, page = 0) {
    const all = historyData(ctx.from.id);
    const size = 5;
    const totalPages = Math.max(1, Math.ceil(all.length / size));
    page = Math.max(0, Math.min(Number(page) || 0, totalPages - 1));

    const items = all.slice(page * size, page * size + size);
    if (!items.length) {
      return safeEdit(
        ctx,
        '📜 <b>RIWAYAT TRANSAKSI</b>\n\nBelum ada transaksi.',
        Markup.inlineKeyboard([[btn('🏠 Menu', 'home')]])
      );
    }

    let text =
      `<b>📜 RIWAYAT TRANSAKSI</b>\n` +
      `<i>Halaman ${page + 1}/${totalPages} • ${all.length} transaksi</i>\n\n`;

    const rows = [];
    items.forEach((x, i) => {
      const no = page * size + i + 1;
      const status = String(x.status || '-').toUpperCase();
      const statusIcon = /^(SUCCESS|SUKSES)$/.test(status)
        ? '✅'
        : /^(FAILED|GAGAL|REFUNDED)$/.test(status)
        ? '❌'
        : /^(EXPIRED|TIMEOUT)$/.test(status)
        ? '⏰'
        : '⏳';

      text +=
        `<blockquote><b>${no}. ${esc(x.productName || x.purpose || 'Transaksi')}</b>\n` +
        `${statusIcon} ${esc(status)} • <b>${rp(x.amount)}</b>\n` +
        `Order: <code>${esc(x.id)}</code></blockquote>\n`;

      if (x.purpose === 'ppob' && x.type && x.sku && x.customerNo) {
        rows.push([btn(`🔄 Beli Lagi ${no}`, `repeat:${encodeURIComponent(x.id)}`)]);
      }
    });

    const navRow = [];
    if (page > 0) {
      navRow.push(btn('⬅️ Sebelumnya', `history:${page - 1}`));
    }
    if (page < totalPages - 1) {
      navRow.push(btn('Berikutnya ➡️', `history:${page + 1}`));
    }
    if (navRow.length) {
      rows.push(navRow);
    }

    rows.push([btn('🛒 PPOB', 'ppob'), btn('🏠 Menu', 'home')]);
    return safeEdit(ctx, text, Markup.inlineKeyboard(rows));
  }

  handleCommand('cek', async ctx => {
    await deleteCtxMessage(ctx);
    const id = String(ctx.message.text).split(/\s+/)[1];
    const t = db.getTx(id);
    if (!t) return tempReply(ctx, '❌ Transaksi tidak ditemukan.');
    if (t.userId !== String(ctx.from.id) && !admin(ctx)) {
      return tempReply(ctx, '❌ Tidak punya akses.');
    }

    return ctx.reply(
      `<b>🔎 STATUS</b>\n\n` +
        `Order: <code>${t.id}</code>\n` +
        `Produk: ${esc(t.productName)}\n` +
        `Status: <b>${esc(t.status)}</b>\n` +
        `SN: <code>${esc(t.sn || '-')}</code>`,
      { parse_mode: 'HTML' }
    );
  });

  handleCommand('admin', async ctx => {
    await deleteCtxMessage(ctx);
    return adminPanel(ctx);
  });
  handleCommand('backup', async ctx => {
    await deleteCtxMessage(ctx);
    if (!adminGuard(ctx)) return;
    const f = makeBackup();
    try {
      const storeName = config.botName || 'RIPZZ STORE';

return await ctx.replyWithDocument(
  { source: f },
  {
    caption:
      `🗄️ <b>BACKUP DATA ${esc(storeName)}</b>\n\n` +
      `<i>File backup database berhasil dibuat.</i>\n` +
      `🔐 Simpan file ini di tempat yang aman.`,
    parse_mode: 'HTML' });
    } finally {
      try {
        fs.unlinkSync(f);
      } catch {}
    }
  });
  handleCommand('restore', async ctx => {
    await deleteCtxMessage(ctx);
    if (!adminGuard(ctx)) return;
    sessions.set(String(ctx.from.id), { type: 'admin_restore' });
    return ctx.reply('♻️ <b>RESTORE DATA</b>\n\nUpload file <code>.tar.gz</code>.', { parse_mode: 'HTML' });
  });
  handleCommand('broadcast', async ctx => {
    await deleteCtxMessage(ctx);
    if (!adminGuard(ctx)) return;
    sessions.set(String(ctx.from.id), { type: 'admin_broadcast' });
    return ctx.reply('📣 <b>BROADCAST</b>\n\nKirim teks broadcast.', { parse_mode: 'HTML' });
  });
  handleCommand('listuser', async ctx => {
    await deleteCtxMessage(ctx);
    if (!adminGuard(ctx)) return;
    return adminUsers(ctx);
  });
  handleCommand('stats', async ctx => {
    await deleteCtxMessage(ctx);
    if (!adminGuard(ctx)) return;
    return adminStats(ctx);
  });
  handleCommand('log', async ctx => {
    await deleteCtxMessage(ctx);
    if (!adminGuard(ctx)) return;
    return adminLog(ctx);
  });
  handleCommand('syncproduk', async ctx => {
    await deleteCtxMessage(ctx);
    if (!admin(ctx)) return tempReply(ctx, '❌ Khusus admin.');
    await tempReply(ctx, '⏳ Sinkronisasi produk...', {}, 5000);
    try {
      const p = await digi.sync();
      return tempReply(ctx, `✅ Sync selesai.\nPrabayar: ${p.list_prepaid.length}\nPascabayar: ${p.list_pasca.length}`);
    } catch (e) {
      return tempReply(ctx, '❌ ' + esc(e.message), { parse_mode: 'HTML' });
    }
  });
  handleCommand('digisaldo', async ctx => {
    await deleteCtxMessage(ctx);
    if (!admin(ctx)) return tempReply(ctx, '❌ Khusus admin.');
    try {
      const x = await digi.balance();
      return tempReply(ctx, `💳 Saldo supplier: <b>${rp(x?.deposit)}</b>`, { parse_mode: 'HTML' });
    } catch (e) {
      return tempReply(ctx, '❌ ' + esc(e.message), { parse_mode: 'HTML' });
    }
  });
  handleCommand('addsaldo', async ctx => {
    await deleteCtxMessage(ctx);
    if (!admin(ctx)) return tempReply(ctx, '❌ Khusus admin.');
    const a = String(ctx.message.text).split(/\s+/);
    const n = Number(a[2]);
    if (!a[1] || !n) return tempReply(ctx, '/addsaldo USER_ID NOMINAL');
    const b = db.addBalance(a[1], n);
    return tempReply(ctx, `✅ Saldo user ditambah ${rp(n)}.\nSaldo: ${rp(b)}`);
  });
  handleCommand('minsaldo', async ctx => {
    await deleteCtxMessage(ctx);
    if (!admin(ctx)) return tempReply(ctx, '❌ Khusus admin.');
    const a = String(ctx.message.text).split(/\s+/);
    const n = Number(a[2]);
    if (!a[1] || !n) return tempReply(ctx, '/minsaldo USER_ID NOMINAL');
    return tempReply(ctx, db.deductBalance(a[1], n) ? `✅ Saldo user dikurangi ${rp(n)}.` : '❌ Saldo tidak cukup.');
  });
  handleCommand('setrole', async ctx => {
    await deleteCtxMessage(ctx);
    if (!admin(ctx)) return tempReply(ctx, '❌ Khusus admin.');
    const a = String(ctx.message.text).split(/\s+/);
    const r = String(a[2] || '').toLowerCase();
    if (!a[1] || !['bronze', 'silver', 'gold'].includes(r)) {
      return tempReply(ctx, '/setrole USER_ID bronze|silver|gold');
    }
    db.setUser(a[1], { role: r });
    return tempReply(ctx, `✅ Role user diubah → ${roleLabel(r)}`);
  });
  handleCommand('setmargin', async ctx => {
    await deleteCtxMessage(ctx);
    if (!admin(ctx)) return tempReply(ctx, '❌ Khusus admin.');
    const a = String(ctx.message.text).split(/\s+/);
    const r = String(a[1] || '').toLowerCase();
    const m = Number(a[2]);
    if (!['bronze', 'silver', 'gold'].includes(r) || !Number.isFinite(m) || m < 0) {
      return tempReply(ctx, '/setmargin bronze 6');
    }
    process.env['MARGIN_' + r.toUpperCase()] = String(m);
    return tempReply(ctx, `✅ Margin ${r} diubah menjadi ${m}% untuk runtime.`);
  });

  bot.action('checkjoin', async c => {
    const ok = await verifyRequiredChannel({
      ...c,
      from: c.from,
      chat: c.chat,
      callbackQuery: c.callbackQuery
    });

    if (ok) {
      await c.answerCbQuery('✓ Keanggotaan terverifikasi.');
      if (c.callbackQuery?.message?.message_id) {
        await deleteMessage(c.chat?.id, c.callbackQuery.message.message_id);
      }
      return sendHome(c);
    }

    await c.answerCbQuery('Belum terdeteksi bergabung. Silakan gabung lalu coba lagi.', { show_alert: true });
  });

  bot.action('home', async c => {
    await c.answerCbQuery();
    return sendHome(c);
  });
  bot.action('ppob', async c => {
    await c.answerCbQuery();
    return showCats(c, 'prepaid');
  });
  bot.action('saldo', async c => {
    await c.answerCbQuery();
    const u = user(c);
    return safeEdit(
      c,
      `<b>💰 SALDO</b>\n\n` + `Saldo: <b>${rp(u.balance)}</b>\n` + `Role: ${roleLabel(u.role)}`,
      Markup.inlineKeyboard([
        [btn('➕ Deposit', 'deposit')],
        [btn('🛒 PPOB', 'ppob'), btn('🏠 Menu', 'home')]
      ])
    );
  });
  bot.action('profile', async c => {
    await c.answerCbQuery();
    const u = user(c);
    return safeEdit(c, `<b>👤 PROFIL</b>\n\n` + `Role: ${roleLabel(u.role)}\n` + `Saldo: <b>${rp(u.balance)}</b>`, nav());
  });
  bot.action('history', async c => {
    await c.answerCbQuery();
    return historyView(c, 0);
  });
  bot.action(/^history:(\d+)$/, async c => {
    await c.answerCbQuery();
    return historyView(c, Number(c.match[1]));
  });
  bot.action('role', async c => {
    await c.answerCbQuery();
    return roleMenu(c);
  });
  bot.action('deposit', async c => {
    await c.answerCbQuery();
    return safeEdit(
      c,
      '<b>💳 DEPOSIT SALDO</b>\n\nMasukkan nominal dengan perintah <code>/depo 10000</code>.\nQRIS akan otomatis dihapus setelah lunas atau kedaluwarsa.',
      nav()
    );
  });
  bot.action('sync', async c => {
    await c.answerCbQuery();
    if (!admin(c)) return tempReply(c, '❌ Khusus admin.');
    try {
      const p = await digi.sync();
      return tempReply(c, `✅ Sync selesai. Prabayar ${p.list_prepaid.length}, Pascabayar ${p.list_pasca.length}`);
    } catch (e) {
      return tempReply(c, '❌ ' + esc(e.message), { parse_mode: 'HTML' });
    }
  });

  bot.action('admin', async c => {
    await c.answerCbQuery();
    if (!adminGuard(c)) return;
    return adminPanel(c, true);
  });
  bot.action('adm:backup', async c => {
    await c.answerCbQuery();
    if (!adminGuard(c)) return;
    const f = makeBackup();
    try {
      const storeName = config.botName || 'RIPZZ STORE';

return await c.replyWithDocument(
  { source: f },
  {
    caption:
      `🗄️ <b>BACKUP DATA ${esc(storeName)}</b>\n\n` +
      `<i>File backup database berhasil dibuat.</i>\n` +
      `🔐 Simpan file ini di tempat yang aman.`,
    parse_mode: 'HTML' });
    } finally {
      try {
        fs.unlinkSync(f);
      } catch {}
    }
  });
  bot.action('adm:restore', async c => {
    await c.answerCbQuery();
    if (!adminGuard(c)) return;
    sessions.set(String(c.from.id), { type: 'admin_restore' });
    return c.reply('♻️ <b>RESTORE DATA</b>\n\nUpload file backup <code>.tar.gz</code>.', { parse_mode: 'HTML' });
  });
  bot.action('adm:broadcast', async c => {
    await c.answerCbQuery();
    if (!adminGuard(c)) return;
    sessions.set(String(c.from.id), { type: 'admin_broadcast' });
    return c.reply('📣 <b>BROADCAST</b>\n\nKirim teks broadcast.', { parse_mode: 'HTML' });
  });
  bot.action('adm:addsaldo', async c => {
    await c.answerCbQuery();
    if (!adminGuard(c)) return;
    sessions.set(String(c.from.id), { type: 'admin_addsaldo' });
    return c.reply('💰 <b>TAMBAH SALDO</b>\n\nKirim: <code>USER_ID NOMINAL</code>', { parse_mode: 'HTML' });
  });
  bot.action('adm:minsaldo', async c => {
    await c.answerCbQuery();
    if (!adminGuard(c)) return;
    sessions.set(String(c.from.id), { type: 'admin_minsaldo' });
    return c.reply('💸 <b>KURANGI SALDO</b>\n\nKirim: <code>USER_ID NOMINAL</code>', { parse_mode: 'HTML' });
  });
  bot.action('adm:users', async c => {
    await c.answerCbQuery();
    if (!adminGuard(c)) return;
    return adminUsers(c);
  });
  bot.action('adm:stats', async c => {
    await c.answerCbQuery();
    if (!adminGuard(c)) return;
    return adminStats(c);
  });
  bot.action('adm:log', async c => {
    await c.answerCbQuery();
    if (!adminGuard(c)) return;
    return adminLog(c);
  });
  bot.action('adm:sync', async c => {
    await c.answerCbQuery();
    if (!adminGuard(c)) return;
    try {
      const p = await digi.sync();
      return tempReply(c, `✅ Sync selesai.\nPrabayar: ${p.list_prepaid.length}\nPascabayar: ${p.list_pasca.length}`);
    } catch (e) {
      return tempReply(c, '❌ ' + esc(e.message), { parse_mode: 'HTML' });
    }
  });
  bot.action('adm:digisaldo', async c => {
    await c.answerCbQuery();
    if (!adminGuard(c)) return;
    try {
      const x = await digi.balance();
      return tempReply(c, `💳 Saldo supplier: <b>${rp(x?.deposit)}</b>`, { parse_mode: 'HTML' });
    } catch (e) {
      return tempReply(c, '❌ ' + esc(e.message), { parse_mode: 'HTML' });
    }
  });

  bot.action(/^type:(prepaid|pasca)$/, async c => {
    await c.answerCbQuery();
    return showCats(c, c.match[1]);
  });
  bot.action(/^search:(prepaid|pasca)$/, async c => {
    await c.answerCbQuery();
    return showSearch(c, c.match[1]);
  });
  bot.action(/^popular:(prepaid|pasca)$/, async c => {
    await c.answerCbQuery();
    return showPopular(c, c.match[1]);
  });
  bot.action(/^cat:(prepaid|pasca):(.+)$/, async c => {
    await c.answerCbQuery();
    return showBrands(c, c.match[1], decodeURIComponent(c.match[2]));
  });
  bot.action(/^brand:(prepaid|pasca):(.+):(.+)$/, async c => {
    await c.answerCbQuery();
    return showProducts(c, c.match[1], decodeURIComponent(c.match[2]), decodeURIComponent(c.match[3]), 0);
  });
  bot.action(/^page:(prepaid|pasca):(.+):(.+):(\d+)$/, async c => {
    await c.answerCbQuery();
    return showProducts(c, c.match[1], decodeURIComponent(c.match[2]), decodeURIComponent(c.match[3]), Number(c.match[4]));
  });
  bot.action(/^prod:(prepaid|pasca):(.+)$/, async c => {
    await c.answerCbQuery();
    return showProduct(c, c.match[1], decodeURIComponent(c.match[2]));
  });
  bot.action(/^buy:(prepaid|pasca):(.+)$/, async c => {
    await c.answerCbQuery();
    return startBuy(c, c.match[1], decodeURIComponent(c.match[2]));
  });
  bot.action(/^backprod:(prepaid|pasca):(.+):(.+):0$/, async c => {
    await c.answerCbQuery();
    return showProducts(c, c.match[1], decodeURIComponent(c.match[2]), decodeURIComponent(c.match[3]), 0);
  });
  bot.action('cancelbuy', async c => {
    await c.answerCbQuery();
    sessions.delete(String(c.from.id));
    return safeEdit(c, '❌ <b>PEMBELIAN DIBATALKAN</b>\n\nTidak ada saldo yang dipotong.', nav());
  });
  bot.action(/^confirmbuy:(prepaid|pasca):(.+)$/, async c => {
    await c.answerCbQuery();
    const s = sessions.get(String(c.from.id));
    if (!s || s.step !== 'confirm' || s.type !== c.match[1] || s.sku !== decodeURIComponent(c.match[2])) {
      return tempReply(c, '❌ Sesi pembelian sudah berakhir.');
    }
    sessions.delete(String(c.from.id));
    return submitOrder(c, s, s.customerNo);
  });
  bot.action(/^repeat:(.+)$/, async c => {
    await c.answerCbQuery();
    const tx = db.getTx(decodeURIComponent(c.match[1]));
    if (!tx || String(tx.userId) !== String(c.from.id) || tx.purpose !== 'ppob' || !tx.type || !tx.sku || !tx.customerNo) {
      return tempReply(c, '❌ Transaksi tidak bisa diulang.');
    }
    const s = { type: tx.type, sku: tx.sku, customerNo: tx.customerNo };
    if (c.callbackQuery?.message?.message_id) {
      await deleteMessage(c.chat?.id, c.callbackQuery.message.message_id);
    }
    return showBuyConfirm(c, s, tx.customerNo);
  });
  bot.action(/^buyrole:(silver|gold)$/, async c => {
    await c.answerCbQuery();
    const target = c.match[1];
    const u = user(c);
    const amount = config.roles.price[target];

    if (!amount) return tempReply(c, 'ℹ️ Upgrade role belum diberi harga.');
    if ((target === 'silver' && u.role !== 'bronze') || (target === 'gold' && u.role === 'gold')) {
      return tempReply(c, '❌ Role kamu sudah sama/lebih tinggi.');
    }

    const tx = makeTx(c, {
      purpose: 'role_upgrade',
      productName: `Upgrade ${target.toUpperCase()}`,
      amount,
      status: 'WAITING_PAYMENT',
      paymentMethod: 'QRIS'
    });

    db.addTx(tx);
    try {
      return createQR(c, tx);
    } catch (e) {
      db.updateTx(tx.id, { status: 'ERROR', error: e.message });
      return tempReply(c, '❌ ' + esc(e.message), { parse_mode: 'HTML' });
    }
  });
  bot.action(/^paycheck:(.+)$/, async c => {
    const t = db.getTx(c.match[1]);
    if (!t || t.userId !== String(c.from.id)) {
      await c.answerCbQuery('Transaksi tidak ditemukan', true);
      return;
    }
    const ok = await checkPayment(t);
    const x = db.getTx(t.id);
    await c.answerCbQuery(ok ? 'Pembayaran terdeteksi' : 'Belum dibayar');
    if (!ok && x?.status === 'WAITING_PAYMENT') return;
  });
  bot.action(/^cancel:(.+)$/, async c => {
    await c.answerCbQuery();
    const t = db.getTx(c.match[1]);
    if (!t || t.userId !== String(c.from.id)) return tempReply(c, '❌ Transaksi tidak ditemukan.');
    if (t.status !== 'WAITING_PAYMENT') return tempReply(c, '❌ Transaksi sudah diproses.');
    await removeQr(t);
    db.updateTx(t.id, { status: 'CANCELLED' });
    return tempReply(c, '✅ Pembayaran dibatalkan.');
  });

  bot.on('document', async (ctx, next) => {
    const s = sessions.get(String(ctx.from.id));
    if (!s || s.type !== 'admin_restore') return next();
    if (!admin(ctx)) return;
    sessions.delete(String(ctx.from.id));
    await restoreBackupFromTelegram(ctx);
  });

  bot.on('text', async (ctx, next) => {
    const s = sessions.get(String(ctx.from.id));
    if (!s) return next();

    const raw = ctx.message.text || '';
    const val = raw.trim();
    if (!val) return;

    if (s.type === 'search') {
      sessions.delete(String(ctx.from.id));
      if (s.promptMessageId) {
        await deleteMessage(ctx.chat.id, s.promptMessageId);
      }
      await deleteCtxMessage(ctx);
      return showSearchResults(ctx, s.productType, val);
    }

    if (s.type === 'admin_broadcast') {
      if (!admin(ctx)) return;
      sessions.delete(String(ctx.from.id));
      await deleteCtxMessage(ctx);
      await tempReply(ctx, '⏳ Broadcast sedang dikirim...', {}, 4000);
      const r = await broadcast(ctx, raw);
      return tempReply(
        ctx,
        `<b>✅ BROADCAST SELESAI</b>\n` + `Total: ${r.total}\n` + `Berhasil: ${r.ok}\n` + `Gagal: ${r.fail}`,
        { parse_mode: 'HTML' }
      );
    }

    if (s.type === 'admin_addsaldo' || s.type === 'admin_minsaldo') {
      if (!admin(ctx)) return;
      const a = val.split(/\s+/);
      const uid = a[0];
      const nom = Number(a[1]);

      if (!uid || !Number.isFinite(nom) || nom <= 0) {
        return tempReply(ctx, '❌ Format: <code>123456789 10000</code>', { parse_mode: 'HTML' });
      }

      sessions.delete(String(ctx.from.id));
      await deleteCtxMessage(ctx);

      if (s.type === 'admin_addsaldo') {
        return tempReply(
          ctx,
          `✅ Saldo <code>${esc(uid)}</code> ditambah <b>${rp(db.addBalance(uid, nom))}</b>.`,
          { parse_mode: 'HTML' }
        );
      }

      return tempReply(
        ctx,
        db.deductBalance(uid, nom)
          ? `✅ Saldo <code>${esc(uid)}</code> dikurangi <b>${rp(nom)}</b>.`
          : '❌ Saldo user tidak mencukupi.',
        { parse_mode: 'HTML' }
      );
    }

    if (s.type === 'admin_restore') return;

    const p = digi.find(s.sku, s.type);
    if (!p) {
      sessions.delete(String(ctx.from.id));
      return;
    }

    const sp = digi.destinationSpec(p.category, p.brand);
    const tokens = val.split(/\s+/);

    if (sp.tokens === 2 && tokens.length < 2) {
      await deleteCtxMessage(ctx);
      return tempReply(ctx, `❌ Format tujuan: ${sp.placeholder}`);
    }

    if (s.promptMessageId) {
      await deleteMessage(ctx.chat.id, s.promptMessageId);
    }
    await deleteCtxMessage(ctx);

    const customerNo = sp.tokens === 2 ? tokens[0] + tokens[1] : val;
    return showBuyConfirm(ctx, s, customerNo);
  });

  if (startLoopsOption) {
    if (syncOnStart && digi.enabled()) {
      const p = db.products();
      if (!p.lastSync || Date.now() - p.lastSync > config.syncMinutes * 60000) {
        Promise.resolve()
          .then(() => digi.sync())
          .catch(e => console.error('initial sync:', e.message));
      }
    }

    if (!bot.__ripzzPPOBPaymentLoopStarted) {
      bot.__ripzzPPOBPaymentLoopStarted = true;
      setInterval(paymentLoop, config.paymentPollMs);
      setInterval(trxLoop, config.trxPollMs);
    }
  }

  const api = {
    sendHome,
    ppobmenu,
    paymentLoop,
    trxLoop,
    checkPayment,
    processProduct,
    sessions,
    locks,
    loading,
    verifyRequiredChannel
  };

  bot.__ripzzPPOBModule = api;
  return api;
}

module.exports = {
  registerPPOB
};
