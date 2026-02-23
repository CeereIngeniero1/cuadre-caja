const sql = require("mssql");
require("dotenv").config();

const config = {
    user: process.env.DB_USER.trim(),
    password: process.env.DB_PASSWORD.trim(),
    server: process.env.DB_SERVER.split('\\')[0],
    database: process.env.DB_DATABASE.trim(),
    options: {
        encrypt: process.env.DB_ENCRYPT === "true",
        trustServerCertificate: process.env.DB_TRUST_SERVER_CERT === "true",
        instanceName: process.env.DB_SERVER.split('\\')[1],
    },
};

async function discover() {
    try {
        let pool = await sql.connect(config);

        console.log("--- COLUMNS OF [Recibo de Caja] ---");
        let result1 = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'Recibo de Caja'
    `);
        console.table(result1.recordset);

        console.log("--- COLUMNS OF [Factura Forma de Pago] ---");
        let result2 = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'Factura Forma de Pago'
    `);
        console.table(result2.recordset);

        await sql.close();
    } catch (err) {
        console.error(err);
    }
}

discover();
