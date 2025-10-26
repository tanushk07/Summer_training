require("dotenv").config({ debug: true });

console.log("Environment variables loaded:");
console.log("DB_SERVER:", process.env.DB_SERVER);
console.log("DB_NAME:", process.env.DB_NAME);
console.log("DB_USER:", process.env.DB_USER);
console.log("DB_DRIVER:", process.env.DB_DRIVER);

const {
  DB_SERVER,
  DB_NAME,
  DB_USER,
  DB_PASSWORD,
  DB_TRUSTED_CONNECTION,
  DB_DRIVER,
  DB_ENCRYPT,
  DB_TRUST_SERVER_CERTIFICATE,
  DB_CONNECTION_TIMEOUT,
  DB_REQUEST_TIMEOUT,
} = process.env;

console.log("After destructuring:");
console.log("DB_SERVER:", DB_SERVER);
console.log("DB_DRIVER:", DB_DRIVER);

const config = {
  connectionString:
    `Server=${DB_SERVER};Database=${DB_NAME};` +
    (DB_USER && DB_PASSWORD
      ? `Uid=${DB_USER};Pwd=${DB_PASSWORD};`
      : `Trusted_Connection=${DB_TRUSTED_CONNECTION};`) +
    `Driver=${DB_DRIVER};Encrypt=${DB_ENCRYPT};TrustServerCertificate=${DB_TRUST_SERVER_CERTIFICATE};`,

  options: {
    encrypt: DB_ENCRYPT === "Yes",
    trustServerCertificate: DB_TRUST_SERVER_CERTIFICATE === "Yes",
  },
  connectionTimeout: Number(DB_CONNECTION_TIMEOUT) || 30000,
  requestTimeout: Number(DB_REQUEST_TIMEOUT) || 30000,
};

console.log("Final connection string:", config.connectionString);

module.exports = config;
