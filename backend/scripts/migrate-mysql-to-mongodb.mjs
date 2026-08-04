import 'dotenv/config';
import mariadb from 'mariadb';
import { MongoClient } from 'mongodb';

const mysqlUrl = process.env.MYSQL_DATABASE_URL;
const mongoUrl = process.env.DATABASE_URL;
const replace = process.argv.includes('--replace');

if (!mysqlUrl || !mongoUrl) {
  throw new Error('MYSQL_DATABASE_URL and DATABASE_URL must both be set');
}

const sql = new URL(mysqlUrl);
const mysql = await mariadb.createConnection({
  host: sql.hostname,
  port: sql.port ? Number(sql.port) : 3306,
  user: decodeURIComponent(sql.username),
  password: decodeURIComponent(sql.password),
  database: sql.pathname.replace(/^\//, ''),
});
const mongo = new MongoClient(mongoUrl);

const collections = [
  ['Client', []],
  ['Product', ['price', 'purchasePrice']],
  ['InvoiceGroup', []],
  [
    'Invoice',
    [
      'taxRate',
      'discountPercent',
      'discountAmount',
      'subtotal',
      'taxAmount',
      'total',
    ],
  ],
  ['InvoiceItem', ['quantity', 'unitPrice', 'taxRate', 'amount']],
  ['Quotation', ['taxRate', 'subtotal', 'taxAmount', 'total']],
  ['QuoteItem', ['quantity', 'unitPrice', 'taxRate', 'amount']],
  ['Payment', ['amount']],
  ['TaxRate', ['rate']],
  ['PaymentMethod', []],
  ['Setting', []],
];

const booleanFields = new Set([
  'InvoiceGroup.isDefault',
  'TaxRate.isDefault',
  'PaymentMethod.isDefault',
]);

function convertRow(table, decimalFields, row) {
  const result = { ...row, _id: row.id };
  delete result.id;
  if (table === 'Client') delete result.status;

  for (const field of decimalFields) {
    if (result[field] !== null && result[field] !== undefined) {
      result[field] = Number(result[field]);
    }
  }

  for (const field of Object.keys(result)) {
    if (booleanFields.has(`${table}.${field}`)) {
      result[field] = Boolean(result[field]);
    }
  }

  return result;
}

try {
  await mongo.connect();
  const dbName = new URL(mongoUrl).pathname.replace(/^\//, '');
  if (!dbName) throw new Error('DATABASE_URL must include a database name');
  const db = mongo.db(dbName);

  for (const [table] of collections) {
    const count = await db.collection(table).estimatedDocumentCount();
    if (count > 0 && !replace) {
      throw new Error(
        `${table} already contains ${count} documents. Re-run with --replace only if overwriting the MongoDB copy is intended.`,
      );
    }
  }

  if (replace) {
    for (const [table] of [...collections].reverse()) {
      await db.collection(table).deleteMany({});
    }
  }

  let total = 0;
  for (const [table, decimalFields] of collections) {
    const rows = await mysql.query(`SELECT * FROM \`${table}\``);
    const documents = rows.map((row) =>
      convertRow(table, decimalFields, row),
    );
    if (documents.length > 0) {
      await db.collection(table).insertMany(documents, { ordered: true });
    }
    total += documents.length;
    console.log(`${table}: ${documents.length}`);
  }

  console.log(`Migrated ${total} records from MySQL to MongoDB.`);
} finally {
  await mysql.end();
  await mongo.close();
}
