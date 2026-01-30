const { sql, poolPromise } = require("../bd/db");

/**
 * CONFIGURACIÓN DE ESTADOS Y VALORES DINÁMICOS
 * Estos valores se extraen del .env para permitir flexibilidad entre diferentes bases de datos SIO.
 */
const ESTADO_CAJA_ABIERTA = Number(process.env.DB_CAJA_ESTADO_ABIERTA ?? 67);
const ESTADO_CAJA_CERRADA = Number(process.env.DB_CAJA_ESTADO_CERRADA ?? 68);
const DOCUMENTO_EMPRESA_DEFAULT = process.env.DB_CAJA_DOCUMENTO_EMPRESA || null;
const TERMINAL_DEFAULT = process.env.DB_CAJA_TERMINAL_DEFAULT
  ? Number(process.env.DB_CAJA_TERMINAL_DEFAULT)
  : null;

/**
 * TIPOS DE ITEM DE CAJA PARA EL SALDO INICIAL
 * Filtra los items de caja (Caja Items) que representan la base o fondo inicial.
 */
const APERTURA_ITEM_TYPES = (process.env.DB_CAJA_TIPO_ITEM_APERTURA || "")
  .split(",")
  .map((value) => Number(value.trim()))
  .filter((value) => Number.isInteger(value));

const EGRESO_ITEM_TYPE = Number(process.env.DB_CAJA_TIPO_ITEM_EGRESO || 7);

function buildListadoQuery({ whereClause = "", orderClause = "ORDER BY c.[Fecha Inicio Caja] DESC" } = {}) {
  const filtroTotalInicial =
    APERTURA_ITEM_TYPES.length > 0
      ? ` AND ci.[Id Tipo Item Caja] IN (${APERTURA_ITEM_TYPES.join(",")})`
      : "";

  return `
    SELECT
      c.[Id Caja] AS IdCaja,
      c.[Documento Empresa] AS DocumentoEmpresa,
      c.[Documento Usuario] AS DocumentoUsuario,
      c.[Fecha Inicio Caja] AS FechaInicioCaja,
      c.[Fecha Fin Caja] AS FechaFinCaja,
      c.[Id Estado] AS IdEstado,
      CASE WHEN c.[Id Estado] = @estadoCerrada THEN 1 ELSE 0 END AS Cerrada,
      est.[Estado] AS EstadoDescripcion,
      term.[Id Terminal] AS IdTerminal,
      term.[Terminal] AS Terminal,
      ISNULL(init.TotalInicial, 0) AS TotalInicial
    FROM [dbo].[Caja] AS c
    LEFT JOIN [dbo].[Estado] AS est ON est.[Id Estado] = c.[Id Estado]
    LEFT JOIN [dbo].[Terminal] AS term ON term.[Id Terminal] = c.[Id Terminal]
    OUTER APPLY (
      SELECT SUM(ci.[Valor Caja Items]) AS TotalInicial
      FROM [dbo].[Caja Items] AS ci
      WHERE ci.[Id Caja] = c.[Id Caja]${filtroTotalInicial}
    ) AS init
    ${whereClause}
    ${orderClause};
  `;
}

function normalizarTexto(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function mapearCaja(row) {
  return {
    IdCaja: row.IdCaja,
    DocumentoEmpresa: row.DocumentoEmpresa,
    DocumentoUsuario: row.DocumentoUsuario,
    Responsable: row.DocumentoUsuario || null,
    FechaInicio: row.FechaInicioCaja,
    FechaFin: row.FechaFinCaja,
    IdEstado: row.IdEstado,
    Estado: row.EstadoDescripcion || null,
    IdTerminal: row.IdTerminal,
    Terminal: row.Terminal || null,
    TotalInicial: Number(row.TotalInicial ?? 0),
    Cerrada: Boolean(row.Cerrada),
  };
}

async function obtenerResumenCaja(req, res, next) {
  try {
    const pool = await poolPromise;
    const resultado = { recordset: [{ timestamp: new Date() }] };
    res.json({ ok: true, data: resultado.recordset[0] });
  } catch (error) {
    next(error);
  }
}

async function listarCajas(_req, res, next) {
  const pool = await poolPromise;
  const query = buildListadoQuery();

  try {
    const resultado = await pool
      .request()
      .input("estadoCerrada", sql.Int, ESTADO_CAJA_CERRADA)
      .query(query);

    res.json(resultado.recordset.map(mapearCaja));
  } catch (error) {
    next(error);
  }
}

async function abrirCaja(req, res, next) {
  const responsable = typeof req.body?.responsable === "string" ? req.body.responsable.trim() : "";
  const documentoUsuario = responsable || null;
  const totalInicial = req.body?.totalInicial !== undefined ? Number(req.body.totalInicial) : 0;
  const totalInicialValor = Number.isFinite(totalInicial) ? totalInicial : 0;
  const documentoEmpresa = req.body?.documentoEmpresa || DOCUMENTO_EMPRESA_DEFAULT;
  const nroCaja =
    req.body?.nroCaja !== undefined && req.body.nroCaja !== null ? Number(req.body.nroCaja) : null;
  const nroCajaValor = Number.isFinite(nroCaja) ? nroCaja : null;
  const idTerminal =
    req.body?.idTerminal !== undefined && req.body.idTerminal !== null
      ? Number(req.body.idTerminal)
      : TERMINAL_DEFAULT;
  const idTerminalValor = Number.isFinite(idTerminal) ? idTerminal : null;

  if (!documentoEmpresa) {
    return res
      .status(400)
      .json({ ok: false, error: "Se requiere el documento de empresa para abrir la caja" });
  }

  const pool = await poolPromise;

  try {
    let documentoEmpresaValor = documentoEmpresa;

    // VALIDACIÓN: No permitir abrir otra caja si el usuario ya tiene una abierta
    const cajaAbiertaRaw = await pool.request()
      .input("doc", sql.NVarChar(50), documentoUsuario)
      .input("estadoAbierta", sql.Int, ESTADO_CAJA_ABIERTA)
      .query(`
        SELECT TOP 1 [Id Caja] 
        FROM [dbo].[Caja] 
        WHERE [Documento Usuario] = @doc AND [Id Estado] = @estadoAbierta
      `);

    if (cajaAbiertaRaw.recordset.length > 0) {
      return res.status(400).json({
        ok: false,
        error: `El usuario ${documentoUsuario} ya tiene una caja abierta (ID: ${cajaAbiertaRaw.recordset[0]['Id Caja']}). Debe cerrarla antes de abrir una nueva.`
      });
    }

    const insercion = await pool
      .request()
      .input("documentoEmpresa", sql.NVarChar(50), documentoEmpresaValor)
      .input("nroCaja", sql.Int, nroCajaValor)
      .input("documentoUsuario", sql.NVarChar(50), documentoUsuario)
      .input("estadoAbierta", sql.Int, ESTADO_CAJA_ABIERTA)
      .input("idTerminal", sql.Int, idTerminalValor)
      .input("ahora", sql.DateTime, new Date())
      .query(`
        INSERT INTO [dbo].[Caja] (
          [Documento Empresa],
          [Nro Caja],
          [Documento Usuario],
          [Id Estado],
          [Id Terminal],
          [Fecha Inicio Caja],
          [Hora Inico Caja]
        )
        OUTPUT INSERTED.[Id Caja],
               INSERTED.[Documento Empresa],
               INSERTED.[Documento Usuario],
               INSERTED.[Fecha Inicio Caja],
               INSERTED.[Fecha Fin Caja],
               INSERTED.[Id Estado],
               INSERTED.[Id Terminal]
        VALUES (@documentoEmpresa, @nroCaja, @documentoUsuario, @estadoAbierta, @idTerminal, @ahora, @ahora);
      `);

    const nuevaCaja = insercion.recordset[0];
    if (!nuevaCaja) {
      throw new Error("No fue posible crear la caja");
    }

    if (totalInicialValor > 0 && APERTURA_ITEM_TYPES.length > 0) {
      const tipoItem = APERTURA_ITEM_TYPES[0];
      await pool
        .request()
        .input("idCaja", sql.Int, nuevaCaja["Id Caja"])
        .input("idTipoItem", sql.Int, tipoItem)
        .input("valor", sql.Decimal(18, 2), totalInicialValor)
        .query(`
          INSERT INTO [dbo].[Caja Items] (
            [Id Caja],
            [Id Tipo Item Caja],
            [Valor Caja Items],
            [Observaciones Caja Items],
            [Fecha Caja Items],
            [Hora Caja Items]
          )
          VALUES (@idCaja, @idTipoItem, @valor, 'Apertura de caja', @ahora, @ahora);
        `);
    }

    const respuesta = await pool
      .request()
      .input("idCaja", sql.Int, nuevaCaja["Id Caja"])
      .input("estadoCerrada", sql.Int, ESTADO_CAJA_CERRADA)
      .query(buildListadoQuery({ whereClause: "WHERE c.[Id Caja] = @idCaja", orderClause: "" }));

    res.status(201).json(mapearCaja(respuesta.recordset[0]));
  } catch (error) {
    next(error);
  }
}

async function obtenerMovimientos(req, res, next) {
  const idCaja = Number(req.params.id);
  if (!Number.isInteger(idCaja)) {
    return res.status(400).json({ ok: false, error: "Id de caja inválido" });
  }

  const pool = await poolPromise;

  try {
    // 1. Obtener info de la caja para saber rango de fechas y usuario
    const infoCaja = await pool.request().input("idCaja", sql.Int, idCaja).query(`
        SELECT [Documento Usuario], [Fecha Inicio Caja], [Fecha Fin Caja], [Id Estado]
        FROM [dbo].[Caja]
        WHERE [Id Caja] = @idCaja
      `);

    if (infoCaja.recordset.length === 0) {
      return res.status(404).json({ ok: false, error: "Caja no encontrada" });
    }

    const {
      "Documento Usuario": docUsuario,
      "Fecha Inicio Caja": fechaInicio,
      "Fecha Fin Caja": fechaFin,
      "Id Estado": idEstado,
    } = infoCaja.recordset[0];

    const fechaInicioQuery = new Date(fechaInicio);
    let fechaFinQuery;

    if (idEstado === ESTADO_CAJA_ABIERTA) {
      // Si está abierta, buscamos desde el inicio del día para capturar facturas olvidadas
      fechaInicioQuery.setHours(0, 0, 0, 0);
      fechaFinQuery = new Date();
    } else {
      // Si está cerrada, solo su rango exacto
      fechaFinQuery = new Date(fechaFin || fechaInicio);
      if (fechaFinQuery.getTime() === fechaInicioQuery.getTime()) {
        fechaFinQuery.setHours(23, 59, 59, 999);
      }
    }

    // 2. Consultar FACTURAS en ese rango para ese usuario
    // Agrupamos por forma de pago
    const resultadoFacturas = await pool
      .request()
      .input("docUsuario", sql.NVarChar(50), docUsuario)
      .input("fechaInicio", sql.DateTime, fechaInicioQuery)
      .input("fechaFin", sql.DateTime, fechaFinQuery)
      .input("idCaja", sql.Int, idCaja)
      .input("estadoCerrada", sql.Int, ESTADO_CAJA_CERRADA)
      .query(`
        WITH Payments AS (
          SELECT 
            ffp.[Id Factura],
            fp.[Forma de Pago] AS MetodoPago,
            ffp.[Valor Pagado Factura Forma de Pago] AS Total
          FROM [dbo].[Factura Forma de Pago] ffp
          LEFT JOIN [dbo].[Forma de Pago] fp ON ffp.[Id Forma de Pago] = fp.[Id Forma de Pago]
          -- Se usa UNION en lugar de UNION ALL para evitar duplicados si el pago existe en ambas tablas
          UNION
          SELECT 
            rc.[Id Factura],
            fp.[Forma de Pago] AS MetodoPago,
            rcii.[Valor Recibo de CajaII] AS Total
          FROM [dbo].[Recibo de Caja] rc
          INNER JOIN [dbo].[Recibo de CajaII] rcii ON rc.[Id Recibo de Caja] = rcii.[Id Recibo de Caja]
          LEFT JOIN [dbo].[Forma de Pago] fp ON rcii.[Id Forma de Pago] = fp.[Id Forma de Pago]
          WHERE rc.[Id Factura] IS NOT NULL
        )
        SELECT
          p.MetodoPago,
          SUM(p.Total) AS Total
        FROM [dbo].[Factura] f
        INNER JOIN Payments p ON f.[Id Factura] = p.[Id Factura]
        WHERE RTRIM(LTRIM(f.[Documento Usuario])) = RTRIM(LTRIM(@docUsuario))
          AND f.[Fecha Factura] >= @fechaInicio
          AND f.[Fecha Factura] <= @fechaFin
          -- No incluir facturas que ya estén en una caja CERRADA previa
          AND NOT EXISTS (
            SELECT 1 FROM [dbo].[Caja] c2
            WHERE c2.[Id Caja] <> @idCaja
              AND c2.[Documento Usuario] = f.[Documento Usuario]
              AND c2.[Id Estado] = @estadoCerrada
              AND f.[Fecha Factura] >= c2.[Fecha Inicio Caja]
              AND f.[Fecha Factura] <= c2.[Fecha Fin Caja]
          )
        GROUP BY p.MetodoPago
      `);

    // 3. Consultar ITEMS DE CAJA (Base + Egresos Detallados)
    const itemsCaja = await pool.request().input("idCaja", sql.Int, idCaja).query(`
      SELECT 
        [Id Caja Items] as Id,
        [Id Tipo Item Caja] as IdTipo, 
        [Valor Caja Items] as Valor,
        [Observaciones Caja Items] as Observacion,
        [Fecha Caja Items] as Fecha
      FROM [dbo].[Caja Items] 
      WHERE [Id Caja] = @idCaja
    `);

    let totalInicial = 0;
    let totalEgresos = 0;
    const listaEgresos = [];

    itemsCaja.recordset.forEach(item => {
      if (APERTURA_ITEM_TYPES.includes(item.IdTipo)) {
        totalInicial += item.Valor;
      } else if (item.IdTipo === EGRESO_ITEM_TYPE) {
        totalEgresos += Math.abs(item.Valor);
        listaEgresos.push({
          id: item.Id,
          valor: Math.abs(item.Valor),
          observacion: item.Observacion || "Sin descripción",
          fecha: item.Fecha
        });
      }
    });

    const movimientos = {};

    // Procesar resultados de facturas
    for (const fila of resultadoFacturas.recordset) {
      const nombreMetodo = normalizarTexto(fila.MetodoPago || "");
      let clave = "otros";

      if (nombreMetodo.includes("efectivo")) {
        clave = "efectivo";
      } else if (nombreMetodo.includes("debito") || (nombreMetodo.includes("tarjeta") && !nombreMetodo.includes("credito"))) {
        clave = "debito";
      } else if (nombreMetodo.includes("transferencia") || nombreMetodo.includes("nequi") || nombreMetodo.includes("daviplata") || nombreMetodo.includes("bancolombia") || nombreMetodo.includes("transf")) {
        clave = "transferencia";
      } else if (nombreMetodo.includes("credito")) {
        clave = "otros"; // El usuario no desea auditar crédito por separado
      }

      movimientos[clave] = (movimientos[clave] || 0) + Number(fila.Total ?? 0);
    }

    // Asegurar claves mínimas
    ["efectivo", "debito", "transferencia", "otros"].forEach((clave) => {
      if (!(clave in movimientos)) {
        movimientos[clave] = 0;
      }
    });

    // Calcular totales finales
    const totalVentas = Object.values(movimientos).reduce(
      (suma, valor) => (typeof valor === "number" ? suma + valor : suma),
      0
    );

    movimientos.totalVentas = totalVentas;
    movimientos.totalInicial = totalInicial;
    movimientos.totalEgresos = totalEgresos;
    movimientos.listaEgresos = listaEgresos;
    movimientos.totalEsperado = (movimientos.efectivo || 0) + totalInicial - totalEgresos;

    // legacy total field (just sales for compatibility if needed, or full total?)
    // Keeping .total as sum of sales for backward compat with some frontend logic, 
    // but the frontend will now use totalInicial explicitly.
    movimientos.total = totalVentas;

    res.json(movimientos);
  } catch (error) {
    next(error);
  }
}

async function cerrarCaja(req, res, next) {
  const idCaja = Number(req.params.id);
  if (!Number.isInteger(idCaja)) {
    return res.status(400).json({ ok: false, error: "Id de caja inválido" });
  }

  const pool = await poolPromise;

  try {
    const resultado = await pool
      .request()
      .input("idCaja", sql.Int, idCaja)
      .input("estadoCerrada", sql.Int, ESTADO_CAJA_CERRADA)
      .input("ahora", sql.DateTime, new Date())
      .query(
        `
        UPDATE [dbo].[Caja]
        SET [Id Estado] = @estadoCerrada,
            [Fecha Fin Caja] = @ahora,
            [Hora Fin Caja] = @ahora
        WHERE [Id Caja] = @idCaja;
      ` + buildListadoQuery({ whereClause: "WHERE c.[Id Caja] = @idCaja", orderClause: "" })
      );

    if (resultado.recordset.length === 0) {
      return res.status(404).json({ ok: false, error: "Caja no encontrada" });
    }

    res.json(mapearCaja(resultado.recordset[0]));
  } catch (error) {
    next(error);
  }
}

// --- NUEVOS ENDPOINTS ---

async function obtenerFacturasCaja(req, res, next) {
  const idCaja = Number(req.params.id);
  if (!Number.isInteger(idCaja)) return res.status(400).json({ error: "Id invalido" });

  const pool = await poolPromise;
  try {
    const infoCaja = await pool.request().input("idCaja", sql.Int, idCaja).query(`
      SELECT [Documento Usuario], [Fecha Inicio Caja], [Fecha Fin Caja], [Id Estado] FROM [dbo].[Caja] WHERE [Id Caja] = @idCaja
    `);
    if (infoCaja.recordset.length === 0) return res.status(404).json({ error: "Caja no existe" });

    const { "Documento Usuario": docUsuario, "Fecha Inicio Caja": fIni, "Fecha Fin Caja": fFin, "Id Estado": idEstado } = infoCaja.recordset[0];

    const fechaInicioQuery = new Date(fIni);
    let fechaFinQuery;

    if (idEstado === ESTADO_CAJA_ABIERTA) {
      fechaInicioQuery.setHours(0, 0, 0, 0);
      fechaFinQuery = new Date();
    } else {
      fechaFinQuery = new Date(fFin || fIni);
      if (fechaFinQuery.getTime() === fechaInicioQuery.getTime()) {
        fechaFinQuery.setHours(23, 59, 59, 999);
      }
    }



    const result = await pool
      .request()
      .input("docUsuario", sql.NVarChar(50), docUsuario)
      .input("fechaInicio", sql.DateTime, fechaInicioQuery)
      .input("fechaFin", sql.DateTime, fechaFinQuery)
      .input("idCaja", sql.Int, idCaja)
      .input("estadoCerrada", sql.Int, ESTADO_CAJA_CERRADA)
      .query(`
        -- [COMPATIBILIDAD SQL 2014]
        -- Se ha eliminado STRING_AGG (SQL 2017+) y se usa FOR XML PATH para concatenar strings.
        WITH Payments AS (
          SELECT 
            ffp.[Id Factura],
            fp.[Forma de Pago] AS MetodoPago,
            ffp.[Valor Pagado Factura Forma de Pago] AS Total
          FROM [dbo].[Factura Forma de Pago] ffp
          LEFT JOIN [dbo].[Forma de Pago] fp ON ffp.[Id Forma de Pago] = fp.[Id Forma de Pago]
          -- Se usa UNION para evitar duplicados en la lista de facturas
          UNION
          SELECT 
            rc.[Id Factura],
            fp.[Forma de Pago] AS MetodoPago,
            rcii.[Valor Recibo de CajaII] AS Total
          FROM [dbo].[Recibo de Caja] rc
          INNER JOIN [dbo].[Recibo de CajaII] rcii ON rc.[Id Recibo de Caja] = rcii.[Id Recibo de Caja]
          LEFT JOIN [dbo].[Forma de Pago] fp ON rcii.[Id Forma de Pago] = fp.[Id Forma de Pago]
          WHERE rc.[Id Factura] IS NOT NULL
        )
        SELECT
          FORMAT(f.[Fecha Factura], 'yyyy-MM-ddTHH:mm:ss') AS Fecha,
          f.[No Factura] AS Numero,
          f.[Documento Responsable] AS Cliente,
          f.[Total Factura] AS Total,
          -- Reemplazo de STRING_AGG:
          STUFF((
            SELECT ', ' + p2.MetodoPago
            FROM Payments p2
            WHERE p2.[Id Factura] = f.[Id Factura]
            FOR XML PATH(''), TYPE).value('.', 'NVARCHAR(MAX)'), 1, 2, '') AS MediosPago
        FROM [dbo].[Factura] f
        WHERE RTRIM(LTRIM(f.[Documento Usuario])) = RTRIM(LTRIM(@docUsuario))
          AND f.[Fecha Factura] >= @fechaInicio
          AND f.[Fecha Factura] <= @fechaFin
          -- Filtramos para asegurar que tenga pagos (equivalente al INNER JOIN original)
          AND EXISTS (SELECT 1 FROM Payments p WHERE p.[Id Factura] = f.[Id Factura])
          AND NOT EXISTS (
            SELECT 1 FROM [dbo].[Caja] c2
            WHERE c2.[Id Caja] <> @idCaja
              AND c2.[Documento Usuario] = f.[Documento Usuario]
              AND c2.[Id Estado] = @estadoCerrada
              AND f.[Fecha Factura] >= c2.[Fecha Inicio Caja]
              AND f.[Fecha Factura] <= c2.[Fecha Fin Caja]
          )
        ORDER BY f.[Fecha Factura] DESC
      `);

    res.json(result.recordset);
  } catch (error) {
    next(error);
  }
}

async function obtenerInventarioCaja(req, res, next) {
  const idCaja = Number(req.params.id);
  if (!Number.isInteger(idCaja)) return res.status(400).json({ error: "Id invalido" });

  const pool = await poolPromise;
  try {
    const infoCaja = await pool.request().input("idCaja", sql.Int, idCaja).query(`
      SELECT [Documento Usuario], [Fecha Inicio Caja], [Fecha Fin Caja], [Id Terminal] FROM [dbo].[Caja] WHERE [Id Caja] = @idCaja
    `);
    if (infoCaja.recordset.length === 0) return res.status(404).json({ error: "Caja no existe" });

    const { "Fecha Inicio Caja": fIni, "Fecha Fin Caja": fFin, "Id Terminal": idTerminal } = infoCaja.recordset[0];
    const fechaFinQuery = fFin || new Date();

    // Intentamos filtrar por Id Terminal si existe, si no, intentamos por Documento?
    // Movimiento Inventarios tiene [Id Terminal Movimiento]. Usaremos ese si la caja tiene Terminal.
    // Si no tiene terminal, el enlace es debil. Asumiremos Terminal.

    let query = `
      SELECT
        FORMAT(m.[Fecha Movimiento], 'yyyy-MM-ddTHH:mm:ss') AS Fecha,
        m.[Código Objeto] AS Producto,
        m.[Cantidad] AS Cantidad,
        m.[Nombre Entidad] AS Entidad,
        m.[No Documento] AS Documento
      FROM [dbo].[Movimiento Inventarios] m
      WHERE m.[Fecha Movimiento] >= @fechaInicio
        AND m.[Fecha Movimiento] <= @fechaFin
    `;

    if (idTerminal) {
      query += ` AND m.[Id Terminal Movimiento] = @idTerminal`;
    }

    query += ` ORDER BY m.[Fecha Movimiento] DESC`;

    const result = await pool
      .request()
      .input("fechaInicio", sql.DateTime, fIni)
      .input("fechaFin", sql.DateTime, fechaFinQuery)
      .input("idTerminal", sql.Int, idTerminal)
      .query(query);

    res.json(result.recordset);
  } catch (error) {
    next(error);
  }
}

async function registrarEgreso(req, res, next) {
  const idCaja = Number(req.params.id);
  const { descripcion, valor } = req.body;

  if (!idCaja || !valor || valor <= 0) {
    return res.status(400).json({ ok: false, error: "Datos insuficientes para el egreso" });
  }

  const pool = await poolPromise;
  try {
    const info = await pool.request().input("id", sql.Int, idCaja).query(`
      SELECT [Id Estado] FROM [dbo].[Caja] WHERE [Id Caja] = @id
    `);

    if (info.recordset[0]?.["Id Estado"] !== ESTADO_CAJA_ABIERTA) {
      return res.status(400).json({ ok: false, error: "No se pueden registrar egresos en una caja cerrada" });
    }

    await pool.request()
      .input("idCaja", sql.Int, idCaja)
      .input("tipo", sql.Int, EGRESO_ITEM_TYPE)
      .input("valor", sql.Decimal(18, 2), valor)
      .input("obs", sql.NVarChar(255), descripcion || "Egreso registrado desde App Cuadre")
      .input("ahora", sql.DateTime, new Date())
      .query(`
        INSERT INTO [dbo].[Caja Items] (
          [Id Caja], 
          [Id Tipo Item Caja], 
          [Valor Caja Items], 
          [Observaciones Caja Items],
          [Fecha Caja Items],
          [Hora Caja Items]
        ) VALUES (@idCaja, @tipo, @valor, @obs, @ahora, @ahora)
      `);

    res.json({ ok: true, message: "Egreso registrado correctamente" });
  } catch (error) {
    next(error);
  }
}

async function actualizarBase(req, res, next) {
  const idCaja = Number(req.params.id);
  const { nuevoValor } = req.body;

  if (!idCaja || nuevoValor === undefined || nuevoValor < 0) {
    return res.status(400).json({ ok: false, error: "Datos insuficientes o valor inválido" });
  }

  const pool = await poolPromise;
  try {
    // 1. Verificar que la caja esté abierta
    const info = await pool.request().input("id", sql.Int, idCaja).query(`
      SELECT [Id Estado] FROM [dbo].[Caja] WHERE [Id Caja] = @id
    `);

    if (info.recordset[0]?.["Id Estado"] !== ESTADO_CAJA_ABIERTA) {
      return res.status(400).json({ ok: false, error: "No se puede editar la base de una caja cerrada" });
    }

    // 2. Actualizar el registro de apertura en Caja Items
    // Buscamos específicamente el item de apertura vinculado a esta caja
    const query = `
      UPDATE [dbo].[Caja Items]
      SET [Valor Caja Items] = @valor
      WHERE [Id Caja] = @idCaja 
        AND [Id Tipo Item Caja] IN (${APERTURA_ITEM_TYPES.join(",")})
        AND [Observaciones Caja Items] LIKE '%Apertura%'
    `;

    const result = await pool.request()
      .input("idCaja", sql.Int, idCaja)
      .input("valor", sql.Decimal(18, 2), nuevoValor)
      .query(query);

    if (result.rowsAffected[0] === 0) {
      // Si no existe (abrieron con base 0), la creamos
      const tipoItem = APERTURA_ITEM_TYPES[0];
      await pool.request()
        .input("idCaja", sql.Int, idCaja)
        .input("tipo", sql.Int, tipoItem)
        .input("valor", sql.Decimal(18, 2), nuevoValor)
        .input("ahora", sql.DateTime, new Date())
        .query(`
          INSERT INTO [dbo].[Caja Items] (
            [Id Caja], [Id Tipo Item Caja], [Valor Caja Items], [Observaciones Caja Items], [Fecha Caja Items], [Hora Caja Items]
          ) VALUES (@idCaja, @tipo, @valor, 'Apertura de caja (Editado)', @ahora, @ahora)
        `);
    }

    res.json({ ok: true, message: "Base inicial actualizada correctamente" });
  } catch (error) {
    next(error);
  }
}

async function eliminarEgreso(req, res, next) {
  const idEgreso = Number(req.params.idEgreso);
  if (!Number.isInteger(idEgreso)) return res.status(400).json({ error: "Id de egreso invalido" });

  const pool = await poolPromise;
  try {
    const check = await pool.request().input("id", sql.Int, idEgreso).query(`
      SELECT [Id Caja], [Id Tipo Item Caja] FROM [dbo].[Caja Items] WHERE [Id Caja Items] = @id
    `);

    if (check.recordset.length === 0) return res.status(404).json({ error: "Egreso no encontrado" });

    // Solo permitir borrar si es tipo egreso y la caja está abierta
    const idCaja = check.recordset[0]["Id Caja"];
    const idTipo = check.recordset[0]["Id Tipo Item Caja"];

    if (idTipo !== EGRESO_ITEM_TYPE) {
      return res.status(400).json({ error: "Solo se pueden eliminar egresos" });
    }

    const infoCaja = await pool.request().input("idCaja", sql.Int, idCaja).query(`
      SELECT [Id Estado] FROM [dbo].[Caja] WHERE [Id Caja] = @idCaja
    `);

    if (infoCaja.recordset[0]?.["Id Estado"] !== ESTADO_CAJA_ABIERTA) {
      return res.status(400).json({ error: "No se pueden eliminar egresos de una caja cerrada" });
    }

    await pool.request().input("id", sql.Int, idEgreso).query(`
      DELETE FROM [dbo].[Caja Items] WHERE [Id Caja Items] = @id
    `);

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listarCajas,
  abrirCaja,
  obtenerMovimientos,
  obtenerFacturasCaja,
  cerrarCaja,
  obtenerResumenCaja,
  registrarEgreso,
  obtenerInventarioCaja,
  actualizarBase,
  eliminarEgreso
};
