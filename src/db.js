const fs = require('fs');
const path = require('path');

// =========================================================
// DATA DIRECTORY
// =========================================================

const dir = path.join(
  __dirname,
  '..',
  'data'
);

fs.mkdirSync(dir, {
  recursive: true
});


// =========================================================
// DATA FILES
// =========================================================

const files = {
  users: path.join(
    dir,
    'users.json'
  ),

  transactions: path.join(
    dir,
    'transactions.json'
  ),

  products: path.join(
    dir,
    'digiflazz-cache.json'
  ),

  settings: path.join(
    dir,
    'settings.json'
  )
};


// =========================================================
// FILE HELPERS
// =========================================================

function read(file, def) {
  try {
    return JSON.parse(
      fs.readFileSync(
        file,
        'utf8'
      )
    );
  } catch {
    return def;
  }
}


function write(file, data) {
  const tmp = `${file}.tmp`;

  fs.writeFileSync(
    tmp,
    JSON.stringify(
      data,
      null,
      2
    )
  );

  fs.renameSync(
    tmp,
    file
  );
}


// =========================================================
// DEFAULT DATA
// =========================================================

const DEFAULT_PRODUCTS = {
  list_prepaid: [],
  list_pasca: [],
  lastSync: 0
};

const DEFAULT_SETTINGS = {
  margins: null,
  rolePrices: null
};


// =========================================================
// INITIALIZE DATA FILES
// =========================================================

function init() {

  if (!fs.existsSync(files.users)) {
    write(
      files.users,
      {}
    );
  }

  if (!fs.existsSync(files.transactions)) {
    write(
      files.transactions,
      []
    );
  }

  if (!fs.existsSync(files.products)) {
    write(
      files.products,
      DEFAULT_PRODUCTS
    );
  }

  if (!fs.existsSync(files.settings)) {
    write(
      files.settings,
      DEFAULT_SETTINGS
    );
  }
}

init();


// =========================================================
// DATA ACCESS
// =========================================================

const users = () =>
  read(
    files.users,
    {}
  );

const txs = () =>
  read(
    files.transactions,
    []
  );

const products = () =>
  read(
    files.products,
    DEFAULT_PRODUCTS
  );

const settings = () =>
  read(
    files.settings,
    DEFAULT_SETTINGS
  );


// =========================================================
// USER
// =========================================================

function getUser(
  id,
  name = ''
) {

  const d = users();

  if (!d[id]) {

    d[id] = {
      id,
      name,
      role:
        process.env.DEFAULT_ROLE ||
        'bronze',
      balance: 0,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

  } else {

    if (name) {
      d[id].name = name;
    }

    d[id].updatedAt = Date.now();
  }

  write(
    files.users,
    d
  );

  return d[id];
}


function setUser(
  id,
  patch
) {

  const d = users();

  d[id] = {
    ...(
      d[id] || {
        id,
        name: 'User',
        role:
          process.env.DEFAULT_ROLE ||
          'bronze',
        balance: 0,
        createdAt: Date.now()
      }
    ),

    ...patch,

    updatedAt: Date.now()
  };

  write(
    files.users,
    d
  );

  return d[id];
}


// =========================================================
// BALANCE
// =========================================================

function addBalance(
  id,
  n
) {

  const u = getUser(id);

  u.balance =
    Number(u.balance || 0) +
    Number(n);

  setUser(
    id,
    u
  );

  return u.balance;
}


function deductBalance(
  id,
  n
) {

  const u = getUser(id);

  if (
    Number(u.balance || 0) <
    Number(n)
  ) {
    return false;
  }

  u.balance -= Number(n);

  setUser(
    id,
    u
  );

  return true;
}


// =========================================================
// PRODUCTS
// =========================================================

function saveProducts(p) {

  write(
    files.products,
    p
  );
}


// =========================================================
// TRANSACTIONS
// =========================================================

function addTx(tx) {

  const a = txs();

  a.unshift({
    ...tx,

    createdAt:
      tx.createdAt ||
      Date.now(),

    updatedAt:
      Date.now()
  });

  write(
    files.transactions,
    a
  );

  return tx;
}


function updateTx(
  id,
  patch
) {

  const a = txs();

  const i = a.findIndex(
    x => x.id === id
  );

  if (i < 0) {
    return null;
  }

  a[i] = {
    ...a[i],
    ...patch,
    updatedAt: Date.now()
  };

  write(
    files.transactions,
    a
  );

  return a[i];
}


function getTx(id) {

  return txs().find(
    x =>
      x.id === id ||
      x.paymentId === id ||
      x.orderId === id
  );
}


function recentTx(
  userId,
  limit = 10
) {

  return txs()
    .filter(
      x =>
        x.userId ===
        String(userId)
    )
    .slice(
      0,
      limit
    );
}


function pendingPayments() {

  return txs().filter(
    x =>
      x.status ===
        'WAITING_PAYMENT' &&
      x.paymentId
  );
}


function pendingProducts() {

  return txs().filter(
    x =>
      [
        'PAID',
        'PROCESSING',
        'PENDING'
      ].includes(x.status) &&
      x.purpose === 'ppob'
  );
}


// =========================================================
// SETTINGS
// =========================================================

function setSettings(
  patch
) {

  const s = {
    ...settings(),
    ...patch
  };

  write(
    files.settings,
    s
  );

  return s;
}


// =========================================================
// EXPORTS
// =========================================================

module.exports = {
  files,

  // Data
  users,
  txs,
  products,
  settings,

  // Users
  getUser,
  setUser,

  // Balance
  addBalance,
  deductBalance,

  // Products
  saveProducts,

  // Transactions
  addTx,
  updateTx,
  getTx,
  recentTx,
  pendingPayments,
  pendingProducts,

  // Settings
  setSettings,

  // File helpers
  read,
  write
};