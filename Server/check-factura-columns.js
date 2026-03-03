const { sql, poolPromise } = require("./bd/db");

async function check() {
    const pool = await poolPromise;

    // 1. Get all states that exist in the Estado table
    const estados = await pool.request().query(
        "SELECT [Id Estado], [Estado] FROM [dbo].[Estado] ORDER BY [Id Estado]"
    );
    console.log("=== TABLA [Estado] ===");
    estados.recordset.forEach(r => console.log(`  ID: ${r["Id Estado"]} | ${r["Estado"]}`));

    // 2. Check distinct [Id Estado] values in Factura
    const factEstados = await pool.request().query(
        "SELECT DISTINCT f.[Id Estado], e.[Estado], COUNT(*) as Total FROM [dbo].[Factura] f LEFT JOIN [dbo].[Estado] e ON e.[Id Estado] = f.[Id Estado] GROUP BY f.[Id Estado], e.[Estado] ORDER BY f.[Id Estado]"
    );
    console.log("\n=== ESTADOS USADOS EN [Factura] ===");
    factEstados.recordset.forEach(r => console.log(`  ID: ${r["Id Estado"]} | ${r["Estado"]} | Total: ${r.Total}`));

    process.exit(0);
}

check().catch(e => {
    console.error(e.message);
    process.exit(1);
});
