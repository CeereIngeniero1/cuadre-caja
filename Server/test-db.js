const { sql, poolPromise } = require("./bd/db");
async function check() {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query("SELECT [Id Estado], [Estado] FROM [dbo].[Estado] WHERE [Estado] LIKE '%Caja%'");
        console.log("ESTADOS:");
        result.recordset.forEach(r => console.log(`ID: ${r['Id Estado']} - ${r.Estado}`));

        const boxes = await pool.request().query("SELECT TOP 3 [Id Caja], [Id Estado], [Documento Empresa] FROM [dbo].[Caja] ORDER BY [Id Caja] DESC");
        console.log("CAJAS RECIENTES:");
        boxes.recordset.forEach(b => console.log(`Caja: ${b['Id Caja']} - Estado: ${b['Id Estado']} - Empresa: ${b['Documento Empresa']}`));

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
check();
