const { sql, poolPromise } = require("./bd/db");
async function check() {
    const pool = await poolPromise;
    const result = await pool.request().query("SELECT [Id Estado], [Estado] FROM [dbo].[Estado] WHERE [Estado] LIKE '%Caja%'");
    result.recordset.forEach(r => console.log(`ESTADO_DB: ID=${r['Id Estado']} NOMBRE=${r.Estado}`));
    process.exit(0);
}
check();
