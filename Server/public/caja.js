// public/caja.js
const API = "/api/cajas";
const tbody = document.querySelector("#tblCajas tbody");

// --- Abrir caja modal elements
const dlgAbrir = document.getElementById("dlgAbrir");
const abrirResponsable = document.getElementById("abrirResponsable");
const abrirDocumentoEmpresa = document.getElementById("abrirDocumentoEmpresa");
const abrirTerminal = document.getElementById("abrirTerminal");
const abrirTotalInicial = document.getElementById("abrirTotalInicial");
const btnAbrir = document.getElementById("btnAbrirCaja");
const btnGuardarAbrir = document.getElementById("btnGuardarAbrir");
const maskedDots = document.getElementById("maskedDots");
const toggleMostrarTotal = document.getElementById("toggleMostrarTotal");

// --- Cerrar caja modal elements
const dlgCerrar = document.getElementById("dlgCerrar");
const cerrarResponsableText = document.getElementById("cerrarResponsableText");
const cerrarFechaInicio = document.getElementById("cerrarFechaInicio");
const cerrarEfectivo = document.getElementById("cerrarEfectivo");
const cerrarDebito = document.getElementById("cerrarDebito");
const cerrarTransf = document.getElementById("cerrarTransf");
const sysEfectivo = document.getElementById("sysEfectivo");
const sysDebito = document.getElementById("sysDebito");
const sysTransf = document.getElementById("sysTransf");
const sysEgresos = document.getElementById("sysEgresos");
const diffEfectivo = document.getElementById("diffEfectivo");
const diffDebito = document.getElementById("diffDebito");
const diffTransf = document.getElementById("diffTransf");
const digitadoTotal = document.getElementById("digitadoTotal");
const sistemaTotal = document.getElementById("sistemaTotal");
const diffTotal = document.getElementById("diffTotal");
const btnConfirmCerrar = document.getElementById("btnConfirmCerrar");

// Actualización en tiempo real al escribir
[cerrarEfectivo, cerrarDebito, cerrarTransf].forEach(input => {
  input?.addEventListener("input", updateDiffs);
});

// --- Egreso modal elements
const dlgEgreso = document.getElementById("dlgEgreso");
const egresoDescripcion = document.getElementById("egresoDescripcion");
const egresoValor = document.getElementById("egresoValor");
const btnGuardarEgreso = document.getElementById("btnGuardarEgreso");

// estado
let currentClosingId = null;
const moneyFmt = (value) => {
  const n = Number(value || 0);
  return "$ " + n.toLocaleString("es-CO", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

// ---------- Helpers ----------
// Helper para formatear fechas ignorando zona horaria UTC y usando local
function formatDateLocal(dateString) {
  if (!dateString) return "-";
  const date = new Date(dateString);
  // Si la fecha viene en UTC (termina en Z) y queremos verla tal cual fue guardada localmente:
  // Opcion A: Dejar que el navegador convierta a local (si guardaste en UTC).
  // Opcion B: Si guardaste en local pero el string dice Z, corregir.

  // Asumiendo que SQL Server guarda en hora local del servidor pero lo envia como ISO
  return date.toLocaleString("es-CO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  });
}

function renderRows(data) {
  tbody.innerHTML = data
    .map(
      (caja) => `
    <tr data-id="${caja.IdCaja}" data-cerrada="${caja.Cerrada ? 1 : 0}">
      <td>${formatDateLocal(caja.FechaInicio)}</td>
      <td>${formatDateLocal(caja.FechaFin)}</td>
      <td>${caja.Responsable || "-"}</td>
      <td>${caja.Estado || "-"}</td>
      <td>
        <div style="display: flex; gap: 5px;">
          ${caja.Cerrada
          ? `<button class="btn secondary" data-ver="${caja.IdCaja}">Ver</button>`
          : `
                <button class="action-pill" data-cerrar="${caja.IdCaja}">Cerrar</button>
                <button class="action-pill" data-egreso="${caja.IdCaja}">Gasto</button>
                <button class="action-pill" data-base="${caja.IdCaja}">Editar Base</button>
              `
        }
        </div>
      </td>
      <td><button class="action-pill" data-facturas="${caja.IdCaja}">Facturas</button></td>
      <td><button class="action-pill" data-ticket="${caja.IdCaja}">Ticket</button></td>
      <td><button class="action-pill" data-informe="${caja.IdCaja}">Informe</button></td>
    </tr>
  `
    )
    .join("");
}

async function cargarCajas() {
  try {
    const response = await fetch(API);
    if (!response.ok) throw new Error("Respuesta no valida del servidor");
    const data = await response.json();
    renderRows(Array.isArray(data) ? data : []);
  } catch (error) {
    console.error("Error cargando cajas:", error);
    tbody.innerHTML = `<tr><td colspan="8">Error cargando datos</td></tr>`;
  }
}

function parseCurrency(text) {
  if (!text) return 0;
  // En formato es-CO, el punto es separador de miles. Lo eliminamos.
  const withoutDots = text.split('.').join('');
  // La coma es separador decimal. La cambiamos por punto para Number()
  const clean = withoutDots.replace(',', '.').replace(/[^0-9.-]+/g, "");
  return Number(clean) || 0;
}

function updateDiffs() {
  const digitadoEf = Number(cerrarEfectivo.value || 0);
  const digitadoDe = Number(cerrarDebito.value || 0);
  const digitadoTr = Number(cerrarTransf.value || 0);

  const sistemaEf = parseCurrency(sysEfectivo.textContent || "0");
  const sistemaDe = parseCurrency(sysDebito.textContent || "0");
  const sistemaTr = parseCurrency(sysTransf.textContent || "0");
  const sistemaBase = parseCurrency(sysBase.textContent || "0");
  const sistemaEgs = Math.abs(parseCurrency(sysEgresos.textContent || "0"));

  // Diferencias por fila
  diffEfectivo.textContent = moneyFmt(digitadoEf - sistemaEf);
  diffEfectivo.style.color = Math.abs(digitadoEf - sistemaEf) < 0.01 ? "var(--success-text)" : "var(--error-text)";

  diffDebito.textContent = moneyFmt(digitadoDe - sistemaDe);
  diffDebito.style.color = Math.abs(digitadoDe - sistemaDe) < 0.01 ? "var(--success-text)" : "var(--error-text)";

  diffTransf.textContent = moneyFmt(digitadoTr - sistemaTr);
  diffTransf.style.color = Math.abs(digitadoTr - sistemaTr) < 0.01 ? "var(--success-text)" : "var(--error-text)";

  // SALDO REPORTADO: Solo sumamos el EFECTIVO físico (Base + Ventas en Efectivo - Gastos)
  // Los débitos y transferencias no suman al arqueo de caja física.
  const totalDigitado = digitadoEf;

  // SALDO ESPERADO POR EL SISTEMA: Obtenemos el valor que el servidor ya calculó (incluye Base, Ventas y Egresos)
  const totalSistema = parseCurrency(sistemaTotal.textContent || "0");

  const diferencia = totalDigitado - totalSistema;

  digitadoTotal.textContent = moneyFmt(totalDigitado);
  diffTotal.textContent = moneyFmt(diferencia);

  // El resultado final solo es verde si cuadra perfectamente
  diffTotal.style.color = Math.abs(diferencia) < 0.01 ? "var(--success-text)" : "var(--error-text)";
}

function resetCerrarInputs() {
  cerrarEfectivo.value = 0;
  cerrarDebito.value = 0;
  cerrarTransf.value = 0;
  updateDiffs();
}

const sysBase = document.getElementById("sysBase");
const cerrarBase = document.getElementById("cerrarBase");

function applySistemaValues(m) {
  const egs = Number(m.totalEgresos || 0);
  sysBase.textContent = moneyFmt(m.totalInicial);
  sysEfectivo.textContent = moneyFmt(m.efectivo);
  sysDebito.textContent = moneyFmt(m.debito);
  sysTransf.textContent = moneyFmt(m.transferencia);
  sysEgresos.textContent = `- ${moneyFmt(egs)}`; // Prefijo de resta para claridad
  cerrarBase.textContent = moneyFmt(m.totalInicial);

  // Usamos el total esperado calculado por el servidor para mayor precisión
  sistemaTotal.textContent = moneyFmt(m.totalEsperado);

  // Renderizar lista de egresos para poder borrarlos si hay error
  const lista = m.listaEgresos || [];
  const container = document.getElementById("listaEgresosCierre");
  const ul = document.getElementById("ulEgresosCierre");

  if (lista.length > 0) {
    if (container) container.style.display = "block";
    if (ul) {
      ul.innerHTML = lista.map(e => `
        <li style="display: flex; justify-content: space-between; align-items: center; background: #fff1f2; padding: 4px 8px; border-radius: 4px; border: 1px solid #fecaca; margin-bottom: 4px;">
          <span style="color: #991b1b;">${e.observacion}: <strong>${moneyFmt(e.valor)}</strong></span>
          <button type="button" onclick="window.borrarEgreso(${e.id})" style="background: #e11d48; color: white; border: none; border-radius: 4px; padding: 2px 6px; cursor: pointer; font-size: 0.7rem;">Borrar</button>
        </li>
      `).join("");
    }
  } else {
    if (container) container.style.display = "none";
    if (ul) ul.innerHTML = "";
  }

  updateDiffs();
}

// Hacerla global para el onclick
window.borrarEgreso = async function (id) {
  if (!confirm("¿Deseas eliminar este gasto? El saldo del sistema se actualizará.")) return;
  try {
    const res = await fetch(`${API}/egreso/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || "No se pudo eliminar");
    }

    // Recargar datos para el modal
    const response = await fetch(`${API}/${currentClosingId}/movimientos`);
    if (response.ok) {
      applySistemaValues(await response.json());
    }
  } catch (error) {
    console.error("Error borrarEgreso:", error);
    alert("Error: " + error.message);
  }
};

async function prepararCerrarCaja(id) {
  currentClosingId = id;
  cerrarEfectivo.disabled = false;
  cerrarDebito.disabled = false;
  cerrarTransf.disabled = false;
  btnConfirmCerrar.style.display = "";

  const fila = document.querySelector(`tr[data-id="${id}"]`);
  const responsable = fila ? fila.children[2]?.textContent || "" : "";
  const fechaInicio = fila ? fila.children[0]?.textContent || "" : "";

  cerrarResponsableText.textContent = responsable;
  cerrarFechaInicio.textContent = fechaInicio;

  try {
    const response = await fetch(`${API}/${id}/movimientos`);
    if (response.ok) {
      const montos = await response.json();
      applySistemaValues(montos);
    } else {
      applySistemaValues({ efectivo: 0, transferencia: 0, tarjeta: 0 });
    }
  } catch (error) {
    console.warn("No se pudieron obtener movimientos, se usan ceros", error);
    applySistemaValues({ efectivo: 0, transferencia: 0, tarjeta: 0 });
  }

  resetCerrarInputs();
  dlgCerrar.showModal();
}

// ---------- Abrir caja (modulo) ----------
btnAbrir?.addEventListener("click", () => {
  if (abrirResponsable) abrirResponsable.value = "";
  if (abrirDocumentoEmpresa) abrirDocumentoEmpresa.value = "";
  if (abrirTerminal) abrirTerminal.value = "";
  if (abrirTotalInicial) abrirTotalInicial.value = "0";
  if (maskedDots) maskedDots.textContent = "";
  if (toggleMostrarTotal) toggleMostrarTotal.checked = false;
  dlgAbrir.showModal();
});

document
  .querySelectorAll('[data-close="abrir"]')
  .forEach((button) => button.addEventListener("click", () => dlgAbrir.close()));

btnGuardarAbrir?.addEventListener("click", async (event) => {
  event.preventDefault();
  const responsable = (abrirResponsable?.value || "").trim();
  if (!responsable) return alert("El responsable es obligatorio");

  const documentoEmpresa = (abrirDocumentoEmpresa?.value || "").trim();
  if (!documentoEmpresa) return alert("El documento de la empresa es obligatorio");

  const terminalTexto = (abrirTerminal?.value || "").trim();
  const totalInicial = Number(abrirTotalInicial?.value || 0);
  const payload = {
    responsable,
    totalInicial,
    documentoEmpresa,
  };

  if (terminalTexto !== "") {
    const terminalId = Number(terminalTexto);
    if (Number.isNaN(terminalId)) {
      return alert("El terminal debe ser numérico");
    }
    payload.idTerminal = terminalId;
  }

  try {
    const response = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Error desconocido al abrir la caja");
    }

    dlgAbrir.close();
    await cargarCajas();
  } catch (error) {
    console.error("abrirCaja:", error);
    alert(error.message);
  }
});

// Mascara del total inicial
abrirTotalInicial?.addEventListener("input", (event) => {
  const value = event.target.value.replace(/[^0-9.]/g, "");
  event.target.value = value;
  if (maskedDots && !toggleMostrarTotal?.checked) {
    maskedDots.textContent = "".padStart(value.length, "*");
  }
  if (toggleMostrarTotal?.checked && maskedDots) {
    maskedDots.textContent = moneyFmt(value);
  }
});

toggleMostrarTotal?.addEventListener("change", (event) => {
  if (!maskedDots) return;
  if (event.target.checked) {
    maskedDots.textContent = moneyFmt(abrirTotalInicial?.value || 0);
  } else {
    const value = abrirTotalInicial?.value || "";
    maskedDots.textContent = "".padStart(value.length, "*");
  }
});

// ---------- Cerrar caja (modulo) ----------
// El listener ya se definió al inicio del archivo


document
  .querySelectorAll('[data-close="cerrar"]')
  .forEach((button) => button.addEventListener("click", () => dlgCerrar.close()));

btnConfirmCerrar?.addEventListener("click", async (event) => {
  event.preventDefault();
  if (!currentClosingId) return alert("Id de caja invalido");

  const digitado = parseCurrency(digitadoTotal.textContent);
  const sistema = parseCurrency(sistemaTotal.textContent);
  const dif = digitado - sistema;

  if (Math.abs(dif) >= 0.01) {
    const msg = `Atención: Tienes una DIFERENCIA de ${moneyFmt(dif)} entre lo que cuentas y lo que dice el sistema.`;
    if (!confirm(`${msg}\n¿Estás seguro de que deseas cerrar la caja con este descuadre?`)) {
      return;
    }
  }

  try {
    const response = await fetch(`${API}/${currentClosingId}/cerrar`, { method: "PUT" });
    if (!response.ok) throw new Error("Error cerrando caja");
    dlgCerrar.close();
    await cargarCajas();
  } catch (error) {
    console.error("cerrarCaja:", error);
    alert("Error cerrando la caja. Revisa la consola.");
  }
});

// Delegacion: botones tabla
tbody.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;

  if (button.dataset.cerrar) {
    prepararCerrarCaja(Number(button.dataset.cerrar));
    return;
  }

  if (button.dataset.ver) {
    prepararCerrarCaja(Number(button.dataset.ver));
    cerrarEfectivo.disabled = true;
    cerrarDebito.disabled = true;
    cerrarTransf.disabled = true;
    btnConfirmCerrar.style.display = "none";
    return;
  }

  if (button.dataset.facturas) {
    mostrarFacturas(Number(button.dataset.facturas));
    return;
  }

  if (button.dataset.informe) {
    mostrarInforme(Number(button.dataset.informe));
    return;
  }

  if (button.dataset.ticket) {
    mostrarTicket(Number(button.dataset.ticket));
    return;
  }

  if (button.dataset.egreso) {
    prepararEgreso(Number(button.dataset.egreso));
    return;
  }

  if (button.dataset.base) {
    prepararEditarBase(Number(button.dataset.base));
    return;
  }
});

// ---------- Facturas y Inventario ----------
const dlgFacturas = document.getElementById("dlgFacturas");
const tbodyFacturas = document.getElementById("tbodyFacturas");

const dlgInforme = document.getElementById("dlgInforme");
const reportCount = document.getElementById("reportCount");
const reportTotal = document.getElementById("reportTotal");
const tbodyInformeFacturas = document.getElementById("tbodyInformeFacturas");
const tbodyInformeEgresos = document.getElementById("tbodyInformeEgresos");

const dlgTicket = document.getElementById("dlgTicket");
const ticketFecha = document.getElementById("ticketFecha");
const ticketResponsable = document.getElementById("ticketResponsable");
const ticketBase = document.getElementById("ticketBase");
const ticketVentas = document.getElementById("ticketVentas");
const ticketTotal = document.getElementById("ticketTotal");
const ticketEgresos = document.getElementById("ticketEgresos");
const ticketDetalleEgresos = document.getElementById("ticketDetalleEgresos");
const ticketDiferencia = document.getElementById("ticketDiferencia");
const ticketDetallePagos = document.getElementById("ticketDetallePagos");

document.querySelectorAll('[data-close="facturas"]').forEach(btn =>
  btn.addEventListener("click", () => dlgFacturas.close())
);
document.querySelectorAll('[data-close="informe"]').forEach(btn =>
  btn.addEventListener("click", () => dlgInforme.close())
);
document.querySelectorAll('[data-close="ticket"]').forEach(btn =>
  btn.addEventListener("click", () => dlgTicket.close())
);
document.querySelectorAll('[data-close="egreso"]').forEach(btn =>
  btn.addEventListener("click", () => dlgEgreso.close())
);
document.querySelectorAll('[data-close="editarBase"]').forEach(btn =>
  btn.addEventListener("click", () => dlgEditarBase.close())
);

document.getElementById("btnPrintTicket")?.addEventListener("click", () => {
  window.print();
});

document.getElementById("btnPrintInforme")?.addEventListener("click", () => {
  window.print();
});

document.getElementById("btnExcelInforme")?.addEventListener("click", () => {
  exportarAExcel();
});

function exportarAExcel() {
  const count = reportCount.textContent;
  const total = reportTotal.textContent;
  const filas = Array.from(tbodyInformeFacturas.querySelectorAll("tr"));

  const trsFacts = document.querySelectorAll("#tbodyInformeFacturas tr");
  const trsEgs = document.querySelectorAll("#tbodyInformeEgresos tr");

  if (trsFacts.length === 0 && trsEgs.length === 0 && count === "0") {
    return alert("No hay datos para exportar");
  }

  // Encabezados
  let rows = [];
  rows.push(["INFORME DE CAJA"]);
  rows.push([`Facturas Emitidas`, count]);
  rows.push([`Total en Caja`, total.replace("$", "").replace(/\./g, "").trim()]);
  rows.push([]);

  // --- Sección Facturas ---
  rows.push(["FACTURAS EMITIDAS"]);
  rows.push(["Nro Factura", "Valor"]);
  trsFacts.forEach(tr => {
    if (tr.cells.length >= 2 && tr.cells[0].innerText !== "No hay facturas registradas.") {
      const val = tr.cells[1].innerText.replace("$", "").replace(/\./g, "").trim();
      rows.push([tr.cells[0].innerText, val]);
    }
  });

  // --- Sección Egresos ---
  rows.push([]);
  rows.push(["GASTOS / EGRESOS REGISTRADOS"]);
  rows.push(["Descripción / Observación", "Valor"]);
  trsEgs.forEach(tr => {
    if (tr.cells.length >= 2 && tr.cells[0].innerText !== "No se registraron gastos.") {
      const val = tr.cells[1].innerText.replace("$", "").replace(/\./g, "").replace("-", "").trim();
      rows.push([tr.cells[0].innerText, val]);
    }
  });

  const csvContent = rows.map(e => e.join(";")).join("\n");
  const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `Informe_Caja_${new Date().getTime()}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

async function mostrarFacturas(id) {
  try {
    tbodyFacturas.innerHTML = '<tr><td colspan="5">Cargando...</td></tr>';
    dlgFacturas.showModal();

    const response = await fetch(`${API}/${id}/facturas`);
    if (!response.ok) throw new Error("Error cargando facturas");

    const facturas = await response.json();
    if (facturas.length === 0) {
      tbodyFacturas.innerHTML = '<tr><td colspan="5">No hay facturas registradas en este periodo.</td></tr>';
      return;
    }

    tbodyFacturas.innerHTML = facturas.map(f => `
      <tr>
        <td>${formatDateLocal(f.Fecha)}</td>
        <td>${f.Numero}</td>
        <td>${f.Cliente || "-"}</td>
        <td>${f.MediosPago || "-"}</td>
        <td style="text-align: right;">${moneyFmt(f.Total)}</td>
      </tr>
    `).join("");
  } catch (error) {
    console.error(error);
    tbodyFacturas.innerHTML = '<tr><td colspan="5">Error cargando datos.</td></tr>';
  }
}

async function mostrarInforme(id) {
  try {
    reportCount.textContent = "...";
    reportTotal.textContent = "...";
    tbodyInformeFacturas.innerHTML = '<tr><td colspan="2">Cargando...</td></tr>';
    dlgInforme.showModal();

    // 1. Obtener movimientos (para el total esperado)
    const resMovs = await fetch(`${API}/${id}/movimientos`);
    const movimientos = resMovs.ok ? await resMovs.json() : { totalEsperado: 0 };

    // 2. Obtener facturas (para el conteo y la lista)
    const resFacts = await fetch(`${API}/${id}/facturas`);
    const facturas = resFacts.ok ? await resFacts.json() : [];

    // Actualizar UI
    reportCount.textContent = facturas.length;
    reportTotal.textContent = moneyFmt(movimientos.totalEsperado);

    if (facturas.length === 0) {
      tbodyInformeFacturas.innerHTML = '<tr><td colspan="2">No hay facturas registradas.</td></tr>';
    } else {
      tbodyInformeFacturas.innerHTML = facturas.map(f => `
        <tr>
          <td>${f.Numero}</td>
          <td style="text-align: right;">${moneyFmt(f.Total)}</td>
        </tr>
      `).join("");
    }

    // --- Render Egresos ---
    const egresos = movimientos.listaEgresos || [];
    if (egresos.length === 0) {
      tbodyInformeEgresos.innerHTML = '<tr><td colspan="2">No se registraron gastos.</td></tr>';
    } else {
      tbodyInformeEgresos.innerHTML = egresos.map(e => `
        <tr>
          <td>${e.observacion}</td>
          <td style="text-align: right; color: #e11d48;">- ${moneyFmt(e.valor)}</td>
        </tr>
      `).join("");
    }
  } catch (error) {
    console.error(error);
    alert("Error al generar el informe.");
  }
}

async function mostrarTicket(id) {
  try {
    const resMovs = await fetch(`${API}/${id}/movimientos`);
    if (!resMovs.ok) throw new Error("Error cargando datos del ticket");
    const movs = await resMovs.json();

    const fila = document.querySelector(`tr[data-id="${id}"]`);
    const responsable = fila ? fila.children[2]?.textContent || "" : "-";
    const fechaIni = fila ? fila.children[0]?.textContent || "" : "-";

    ticketFecha.textContent = `FECHA: ${fechaIni}`;
    ticketResponsable.textContent = `USUARIO: ${responsable}`;
    ticketBase.textContent = moneyFmt(movs.totalInicial);
    ticketVentas.textContent = moneyFmt(movs.efectivo);
    ticketEgresos.textContent = moneyFmt(movs.totalEgresos);
    ticketTotal.textContent = moneyFmt(movs.totalEsperado);

    // Detalle de medios de pago
    let htmlPagos = "";
    if (movs.efectivo > 0) htmlPagos += `<div style="display:flex;justify-content:space-between"><span> > EFECTIVO:</span><span>${moneyFmt(movs.efectivo)}</span></div>`;
    if (movs.debito > 0) htmlPagos += `<div style="display:flex;justify-content:space-between"><span> > DEBITO:</span><span>${moneyFmt(movs.debito)}</span></div>`;
    if (movs.transferencia > 0) htmlPagos += `<div style="display:flex;justify-content:space-between"><span> > TRANSF.:</span><span>${moneyFmt(movs.transferencia)}</span></div>`;
    ticketDetallePagos.innerHTML = htmlPagos;

    // Detalle de egresos
    let htmlEgresos = "";
    (movs.listaEgresos || []).forEach(e => {
      htmlEgresos += `<div style="display:flex;justify-content:space-between;padding-left:10px;"><span> * ${e.observacion}:</span><span>-${moneyFmt(e.valor)}</span></div>`;
    });
    ticketDetalleEgresos.innerHTML = htmlEgresos;

    // Calcular diferencia si la caja está cerrada
    if (fila && fila.dataset.cerrada === "1") {
      // Necesitaríamos los valores digitados para la diferencia real. 
      // Por ahora, si no los tenemos guardados en la DB de forma explícita (solo los tenemos en el modal),
      // mostramos "-" o el sistema asume 0 diferencia si no hay más data.
      ticketDiferencia.textContent = "CERRADA CON EXITO";
    } else {
      ticketDiferencia.textContent = "EN PROCESO...";
    }

    dlgTicket.showModal();
  } catch (error) {
    console.error(error);
    alert("Error al generar el ticket.");
  }
}

// ---------- Egresos UI ----------
function prepararEgreso(id) {
  currentClosingId = id;
  egresoDescripcion.value = "";
  egresoValor.value = "";
  dlgEgreso.showModal();
}

btnGuardarEgreso?.addEventListener("click", async (event) => {
  event.preventDefault();
  const descripcion = egresoDescripcion.value.trim();
  const valor = Number(egresoValor.value);

  if (!descripcion || !valor || valor <= 0) {
    return alert("Por favor ingresa descripción y un valor válido.");
  }

  try {
    const response = await fetch(`${API}/${currentClosingId}/egreso`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ descripcion, valor })
    });

    if (!response.ok) throw new Error("Error registrando el egreso");

    alert("Gasto registrado satisfactoriamente");
    dlgEgreso.close();
  } catch (error) {
    console.error(error);
    alert("No se pudo registrar el gasto.");
  }
});

// ---------- Editar Base UI ----------
const dlgEditarBase = document.getElementById("dlgEditarBase");
const editarBaseNuevoValor = document.getElementById("editarBaseNuevoValor");
const btnGuardarEditarBase = document.getElementById("btnGuardarEditarBase");

function prepararEditarBase(id) {
  currentClosingId = id;
  const fila = document.querySelector(`tr[data-id="${id}"]`);
  // Intentar obtener el valor actual si es posible
  editarBaseNuevoValor.value = "";
  dlgEditarBase.showModal();
}

btnGuardarEditarBase?.addEventListener("click", async (event) => {
  event.preventDefault();
  const nuevoValor = Number(editarBaseNuevoValor.value);

  if (nuevoValor < 0 || editarBaseNuevoValor.value === "") {
    return alert("Por favor ingresa un valor válido.");
  }

  try {
    const response = await fetch(`${API}/${currentClosingId}/base`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nuevoValor })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || "Error actualizando la base");
    }

    alert("Base inicial actualizada correctamente");
    dlgEditarBase.close();
    await cargarCajas(); // Recargar la tabla para mostrar el nuevo valor
  } catch (error) {
    console.error(error);
    alert(error.message);
  }
});

// inicio
cargarCajas();
