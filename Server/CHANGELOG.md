# Historial de Cambios (Changelog)

Este documento detalla las mejoras y correcciones realizadas al sistema de Cuadre de Caja para mejorar la precisión financiera y la experiencia del usuario.

---

## [1.5.1] - 2026-03-03

### 🔧 Corrección Crítica: Facturas Anuladas se Contaban en el Cuadre
- **Problema:** Las facturas con estado "Anulado" (`Id Estado = 5`) seguían siendo sumadas en los totales de la caja, causando diferencias entre el dinero físico y el reporte.
- **Solución:** Se añadió el filtro `AND f.[Id Estado] <> @estadoAnulada` en las consultas `obtenerMovimientos` y `obtenerFacturasCaja`.
- **Configuración:** Se añadió la variable `DB_CAJA_ESTADO_ANULADA_FACTURA=5` al `.env` para que el ID del estado sea configurable por cliente.

---

## [1.5.0] - 2026-02-23

### 🔧 Corrección Crítica: Discrepancia en Ticket e Informes
- **Unificación de Rango de Búsqueda:** Se modificó la lógica para que el ticket y los informes busquen ventas siempre desde las **00:00:00 AM** de la fecha de apertura. 
- **Consistencia Retroactiva:** El cambio permite que cajas cerradas en el pasado ahora muestren los valores correctos al visualizar el ticket nuevamente.

### ⚙️ Configuración
- **Actualización de Base de Datos:** Se actualizó la conexión por defecto en el `.env` para apuntar a la base de datos `Naaturamerica2`.

---

## [1.4.1] - 2026-01-27

### 🕒 Corrección de Tiempos y Zona Horaria
- **Sincronización con Hora Local:** Se reemplazó el uso de `GETDATE()` (SQL) por la hora del servidor Node.js en todos los registros (apertura, cierre y gastos). Esto soluciona de forma definitiva el problema de "horas aleatorias" causado por el desfase UTC de la base de datos.
- **Formato de UI Limpio:** Se eliminaron los segundos de todas las vistas del sistema (Tabla principal, Facturas y Tickets) para mejorar la legibilidad.

---

## [1.4.0] - 2026-01-27

### ✨ Mejoras de UI y Clasificación
- **Separación de Transferencias:** Se creó una categoría explícita para "Transferencias" (Nequi, Daviplata, Bancolombia), separándola de "Débito" (Tarjetas).
- **Eliminación de Crédito:** Se retiró la opción de auditar "Crédito" manualmente en el cierre, simplificando el proceso.

### 🛠️ Cambio Crítico en Lógica de Cuadre (Solo Efectivo)
- **Conciliación Centrada en Efectivo:** El "Saldo Final" y el cálculo de diferencias ahora se basan **exclusivamente en el dinero físico**.
  - **Nueva Fórmula:** `Base + Ventas en Efectivo - Gastos = Total Esperado en Caja`.
  - **Impacto:** Las ventas por Débito y Transferencia se muestran informativamente para auditoría, pero **NO** suman al total que el cajero debe tener en el cajón, evitando descuadres por dinero que nunca ingresó físicamente.
- **Tickets e Informes:** Se actualizaron las etiquetas para reflejar que el total mostrado es "Total en Caja (Efectivo)".

---

## [1.2.0] - 2026-01-14

### ✨ Nuevas Funcionalidades
- **Gestión de Gastos (Egresos):** Ahora se pueden visualizar y eliminar gastos registrados directamente desde el modal de cierre. Esto permite corregir errores de dedo antes de finalizar el turno.
- **Actualización en Tiempo Real:** Los cálculos de totales y diferencias en el modal de cierre ahora se actualizan instantáneamente mientras el usuario escribe, sin necesidad de cerrar y abrir el modal.
- **Diseño Responsivo en Modal:** Se optimizó la tabla de auditoría para evitar desplazamientos horizontales y mejorar la alineación visual de las cifras (textos a la izquierda, números a la derecha).

### 🛠️ Cambios en la Lógica de Conciliación
- **Cambio a "Opción B" de Cuadre:** Se eliminó la suma automática de la Base Inicial en la columna de reporte del usuario.
  - **Antes:** El sistema sumaba la base al efectivo reportado, lo que causaba confusión y duplicidad si el usuario ya incluía ese dinero en su conteo físico.
  - **Ahora:** El usuario reporta **únicamente** el dinero físico que tiene en mano (el cual naturalmente ya contiene lo sobrante de la base). El sistema compara este valor contra la meta calculada: `(Base + Ventas - Gastos)`.
  - **Resultado:** Si te quedan $10.000 y escribes 10.000, la diferencia es **$0**.

### 🔧 Correcciones (Fixes)
- **Error de Botón "Cerrar":** Se restauraron identificadores críticos (`cerrarBase`) que se habían perdido en limpiezas visuales anteriores, devolviendo la funcionalidad al botón de cierre.
- **Formateo de Moneda:** Se centralizó y mejoró la función `moneyFmt` para asegurar que el formato de pesos colombianos (`$ 10.000`) sea consistente y sin decimales ruidosos en toda la app.
- **Rutas API:** Se añadieron nuevos endpoints para soportar el borrado de egresos (`DELETE /api/cajas/egreso/:id`).

---

## [1.1.0] - 2025-12-29

### ✨ Mejoras de UI
- Implementación de **Glassmorphism** y diseño premium en modales.
- Enmascaramiento del total inicial en la apertura de caja para mayor privacidad.
- Micro-animaciones en botones y transiciones de estado.

---

## [1.0.0] - Inicio del Proyecto
- Versión inicial con apertura/cierre básico y conexión a Base de Datos SIO.
