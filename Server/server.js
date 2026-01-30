const path = require("path");
// Cargar .env desde la ubicación actual o desde la carpeta superior (estructuras dev vs prod)
require("dotenv").config();
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3600;

const { poolPromise } = require("./bd/db");


// Rutas API
const cajaRoutes = require("./Routes/caja.routes");

// Ajustes básicos
app.disable("x-powered-by");
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// Archivos estáticos (frontend)
app.use(express.static(path.join(__dirname, "public")));

// Health check
app.get("/ping", (_req, res) => res.json({ ok: true }));

// API (ambos caminos válidos)
app.use("/api/caja", cajaRoutes);
app.use("/api/cajas", cajaRoutes);

// 404 para rutas API no encontradas
app.use("/api", (_req, res) => {
  res.status(404).json({ ok: false, error: "Recurso no encontrado" });
});

// Manejador de errores
app.use((err, _req, res, _next) => {
  console.error("💥 Error:", err);
  res.status(500).json({ ok: false, error: "Error interno del servidor" });
});

// Levantar servidor
app.listen(PORT, () => {
  console.log(`✅ Server on http://localhost:${PORT}`);
});
