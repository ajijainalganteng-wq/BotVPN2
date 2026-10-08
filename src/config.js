const fs = require('fs');
const path = require('path');

// =========================================================
// LOAD .vars.json
// =========================================================

let vars = {};

try {
  const varsPath = path.join(__dirname, '../.vars.json');

  if (fs.existsSync(varsPath)) {
    vars = JSON.parse(
      fs.readFileSync(varsPath, 'utf8')
    );
  }
} catch (e) {
  console.error(
    '❌ Gagal membaca .vars.json:',
    e.message
  );
}

// =========================================================
// CONFIG HELPER
// Prioritas: .vars.json -> process.env -> default
// =========================================================

const env = (key, fallback = '') => {
  if (
    vars &&
    vars[key] !== undefined &&
    vars[key] !== null
  ) {
    return vars[key];
  }

  if (
    process.env[key] !== undefined &&
    process.env[key] !== null
  ) {
    return process.env[key];
  }

  return fallback;
};

// =========================================================
// HELPERS
// =========================================================

const csv = s =>
  String(s || '')
    .split(',')
    .map(x => x.trim())
    .filter(Boolean);

const num = (v, d) =>
  Number.isFinite(Number(v))
    ? Number(v)
    : d;

// =========================================================
// CONFIG
// =========================================================

module.exports = {

  // -------------------------------------------------------
  // TELEGRAM
  // -------------------------------------------------------

  botToken: env('BOT_TOKEN'),

  admins: csv(
    env('ADMIN_IDS')
  ),

  requiredChannelId:
    env('REQUIRED_CHANNEL_ID') ||
    env('TRX_CHANNEL_ID') ||
    '',

  requiredChannelUrl:
    env('REQUIRED_CHANNEL_URL') ||
    env('TRX_CHANNEL_URL') ||
    '',

  botName: env('NAMA_STORE', 'ANSENDANTVPN'),

  ownerName:
    env('OWNER_NAME', 'Owner'),

  channelId:
    env('TRX_CHANNEL_ID'),

  tz:
    env('TZ', 'Asia/Jakarta'),


  // -------------------------------------------------------
  // DIGIFLAZZ
  // -------------------------------------------------------

  digiflazz: {
    username:
      env('DIGIFLAZZ_USERNAME'),

    apiKey:
      env('DIGIFLAZZ_API_KEY')
  },


  // -------------------------------------------------------
  // AUSTIN
  // -------------------------------------------------------

  austin: {
    baseUrl: (
      env(
        'AUSTIN_BASE_URL',
        'https://austinstore.id'
      )
    ).replace(/\/$/, ''),

    apiKey:
      env('AUSTIN_API_KEY'),

    apiSecret:
      env('AUSTIN_API_SECRET', '')
  },


  // -------------------------------------------------------
  // ROLES
  // -------------------------------------------------------

  roles: {

    default:
      env(
        'DEFAULT_ROLE',
        'bronze'
      ),

    margin: {

      bronze:
        num(
          env('MARGIN_BRONZE'),
          6
        ),

      silver:
        num(
          env('MARGIN_SILVER'),
          3
        ),

      gold:
        num(
          env('MARGIN_GOLD'),
          1
        )
    },

    price: {

      silver:
        num(
          env('ROLE_PRICE_SILVER'),
          0
        ),

      gold:
        num(
          env('ROLE_PRICE_GOLD'),
          0
        )
    }
  },


  // -------------------------------------------------------
  // PAYMENT / TRANSACTION
  // -------------------------------------------------------

  qrisExpireMinutes:
    num(
      env('QRIS_EXPIRE_MINUTES'),
      15
    ),

  syncMinutes:
    num(
      env('SYNC_INTERVAL_MINUTES'),
      30
    ),

  paymentPollMs:
    num(
      env('PAYMENT_POLL_MS'),
      8000
    ),

  trxPollMs:
    num(
      env('TRX_POLL_MS'),
      30000
    ),

  trxMaxPolls:
    num(
      env('TRX_MAX_POLLS'),
      40
    ),

  pageSize:
    num(
      env('PAGE_SIZE'),
      8
    ),

  storePhoto:
    env(
      'STORE_PHOTO',
      'assets/store.jpg'
    )
};