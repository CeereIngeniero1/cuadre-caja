const { sql, poolPromise } = require("./bd/db");

async function explore() {
    try {
        const pool = await poolPromise;
        
        // 1. List all tables
        console.log("--- TABLES ---");
        const tablesResult = await pool.request().query("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'");
        const tables = tablesResult.recordset.map(r => r.TABLE_NAME);
        console.log(tables.join(", "));

        // 2. Identify tables that might be related to patients, users, or clinical data
        const candidates = tables.filter(t => 
            t.toLowerCase().includes("paciente") || 
            t.toLowerCase().includes("usuario") || 
            t.toLowerCase().includes("tercero") || 
            t.toLowerCase().includes("historia") || 
            t.toLowerCase().includes("clinica") ||
            t.toLowerCase().includes("h_c") ||
            t.toLowerCase().includes("hc") ||
            t.toLowerCase().includes("cie") ||
            t.toLowerCase().includes("rips")
        );

        console.log("\n--- CANDIDATE TABLES ---");
        console.log(candidates.join(", "));

        // 3. List columns for the candidate tables
        for (const table of candidates) {
            console.log(`\n--- COLUMNS FOR ${table} ---`);
            const columnsResult = await pool.request()
                .input("tableName", sql.NVarChar, table)
                .query("SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = @tableName");
            columnsResult.recordset.forEach(c => console.log(`${c.COLUMN_NAME} (${c.DATA_TYPE})`));
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

explore();
