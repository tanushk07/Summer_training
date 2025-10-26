require("dotenv").config();

const {
  DB_SERVER,
  DB_NAME,
  DB_USER,
  DB_PASSWORD,
  DB_ENCRYPT,
  DB_TRUST_SERVER_CERTIFICATE,
  DB_CONNECTION_TIMEOUT,
  DB_REQUEST_TIMEOUT,
} = process.env;

const config = {
  server: DB_SERVER, // project-server-tanushk.database.windows.net
  database: DB_NAME, // EmployeeAttendanceDB
  user: DB_USER, // Tanushk
  password: DB_PASSWORD, // Ta200420042004
  port: 1433,
  options: {
    encrypt: DB_ENCRYPT === "Yes" || true, // Always true for Azure SQL
    trustServerCertificate: DB_TRUST_SERVER_CERTIFICATE === "Yes" || false, // false for Azure SQL
    enableArithAbort: true
  },
  connectionTimeout: Number(DB_CONNECTION_TIMEOUT) || 30000,
  requestTimeout: Number(DB_REQUEST_TIMEOUT) || 30000,
};

console.log("Azure SQL config:", {
  server: config.server,
  database: config.database,
  user: config.user,
  port: config.port,
  encrypt: config.options.encrypt
});

module.exports = config;