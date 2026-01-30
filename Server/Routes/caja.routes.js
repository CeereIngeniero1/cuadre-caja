const express = require("express");
const {
  obtenerResumenCaja,
  listarCajas,
  abrirCaja,
  obtenerMovimientos,
  cerrarCaja,
  obtenerFacturasCaja,
  obtenerInventarioCaja,
  registrarEgreso,
  actualizarBase,
  eliminarEgreso
} = require("../Controllers/caja.controller");

const router = express.Router();

router.get("/resumen", obtenerResumenCaja);
router.get("/", listarCajas);
router.post("/", abrirCaja);
router.get("/:id/movimientos", obtenerMovimientos);
router.put("/:id/cerrar", cerrarCaja);
router.put("/:id/base", actualizarBase);

// Nuevas rutas
router.get("/:id/facturas", obtenerFacturasCaja);
router.get("/:id/inventario", obtenerInventarioCaja);
router.post("/:id/egreso", registrarEgreso);
router.delete("/egreso/:idEgreso", eliminarEgreso);

module.exports = router;
