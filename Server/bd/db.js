const sql = require("mssql");
const path = require("path");
// Intentar cargar .env desde la raíz del proyecto (para XAMPP/Producción y Desarrollo)
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const config = {
  server: process.env.DB_SERVER,            // DESARROLLADOR1\SQLEXPRESS
  user: process.env.DB_USER,                // CeereRIPS
  password: process.env.DB_PASSWORD,        // crsoft
  database: process.env.DB_DATABASE,        // Laureles
  options: {
    encrypt: process.env.DB_ENCRYPT === "true",
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERT === "true",
  },
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
};

const poolPromise = sql.connect(config)
  .then(pool => {
    console.log("✅ Conectado a SQL Server (SQL auth)");
    return pool;
  })
  .catch(err => {
    console.error("❌ Error al conectar con SQL Server:", err);
    throw err;
  });

module.exports = { sql, poolPromise };
