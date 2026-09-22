# 📖 Registro de Capacidades y Cambios del Producto — HuddlePace

> **REGLA DE ORO DE ESTE DOCUMENTO:**
> Este registro se mantiene estrictamente en **orden cronológico inverso (del más reciente al más antiguo)**.
> Toda nueva funcionalidad, modificación arquitectónica, cambio de diseño o ajuste técnico **debe escribirse ARRIBA**, de modo que lo más nuevo siempre sea lo primero que se lee.

---

## [2026-09-22] Estado Inicial Consolidado — Todo lo que hace HuddlePace hoy

### 1. Programación y Creación de Sesiones (`/pace` y Shortcuts)
* **Modal interactivo de creación:** Se dispara con el comando `/pace`, `/pace schedule` o mediante el Global Shortcut de Slack.
* **Agendas modulares dinámicas:** Soporte para configurar de 1 a 10 módulos temáticos por reunión (respetando el límite de 100 bloques de Slack Block Kit).
* **Timeboxing porcentual estricto:** 
  * Los organizadores asignan porcentajes de tiempo a cada módulo (ej. Contexto 20%, Demo 50%, Q&A 30%).
  * Validación en tiempo de ejecución con **Zod**: el formulario rechaza el envío y muestra errores en el modal si la suma no es exactamente 100%.
* **Asignación de Speakers por tema:** Cada módulo permite seleccionar al orador responsable mediante un selector de usuarios (`user_select`).
* **Canales y duración total:** Configuración de canal de destino (público o privado) y duración total en minutos.

### 2. Detección y Enlace con Slack Huddles (`huddleDiscovery.ts`)
* **Detección inteligente de llamadas:** El modal de programación escanea el historial reciente del canal para detectar Huddles activos o recientes.
* **Opciones de enlace:**
  * Enlazar a un Huddle detectado en el canal.
  * Autodetección automática al iniciar la reunión.
  * Publicación directa en el feed del canal si no hay Huddle activo.
  * Ingreso de enlace o ID de hilo personalizado (`thread_ts`).
* **Modal de desambiguación:** Si al momento de iniciar existen múltiples Huddles activos en el canal, HuddlePace abre un modal de selección para elegir la llamada correcta en un solo paso.
* **Membresía transparente:**
  * Si el canal es público, el bot se auto-une usando el scope `channels:join`.
  * Si el canal es privado, detecta si es miembro y muestra un mensaje solicitando invitar al bot (`/invite @HuddlePace`).

### 3. Seguimiento en Vivo dentro del Huddle (`trackerBlock.ts`, `timerWorker.ts`)
* **Hilo nativo del Huddle (`thread_ts`):** La tarjeta de progreso vive dentro del chat del Huddle, sin ensuciar el canal principal.
* **Heartbeat de 30 segundos:** Un worker en background actualiza el mensaje en tiempo real cada 30 segundos sin recargar el hilo.
* **Barra de progreso visual:** Muestra el avance del módulo y de la reunión mediante caracteres Unicode (`[████████░░░░░░░░] 50%`).
* **Indicadores en vivo:** Muestra tema actual, speaker responsable y minutos/segundos restantes.

### 4. Control de Acceso y Protección de Speakers (`actionHandlers.ts`)
* **Botones con control de rol (`role-gated`):** Los botones interactivos (`[ ⏭️ Siguiente Tema ]`, `[ ☕ Just Chatting ]`, `[ ⏹️ Concluir ]`) verifican la identidad del usuario contra los speakers asignados o el organizador.
* **Bloqueo a usuarios no autorizados:** Si un espectador sin permisos hace clic en los controles, recibe un aviso efímero privado de acceso denegado.
* **Alertas privadas por Slack DM:** Las advertencias de tiempo restante y notificaciones de cambio de turno se envían por mensaje directo privado al speaker asignado, evitando interrupciones incómodas en el audio de la llamada.

### 5. Modo "Just Chatting" (`actionHandlers.ts`)
* **Transición a charla casual:** El botón `[ ☕ Switch to Just Chatting ]` permite cerrar la agenda formal pero mantener el Huddle abierto.
* **Congelamiento de métricas:** Congela las estadísticas de la presentación formal para los reportes de cumplimiento, mientras continúa contabilizando el tiempo de conversación informal.

### 6. Detección del Fin de la Llamada (`huddleHandlers.ts`)
* **Escucha de ciclo de vida nativo:** Monitorea los eventos de mensajes del canal en busca de marcadores de terminación (`room.has_ended: true`).
* **Conclusión automática:** Cuando todos los participantes abandonan el Huddle, HuddlePace concluye la sesión automáticamente y publica el resumen final de duración y cumplimiento.

### 7. Dashboard en App Home y Analítica (`homeTab.ts`, `reportBlock.ts`)
* **Slack App Home Tab:**
  * Vista centralizada del workspace con sesiones en vivo, módulos activos y accesos directos.
  * Botón directo `[ ➕ Schedule New Meetup ]`.
  * Estadísticas de puntualidad de los últimos 30 días.
* **Reportes de Pacing bajo demanda:**
  * Comando `/pace report [días]` (por defecto 30 días).
  * Desglose de porcentaje de cumplimiento de timebox, minutos formales vs. informales, y tabla histórica de sesiones.

### 8. Comandos Slash Disponibles
* `/pace`: Abre el modal interactivo de programación.
* `/pace status`: Lista las sesiones activas en el canal actual.
* `/pace report [días]`: Genera y muestra el reporte de cumplimiento y duración.
* `/pace help`: Muestra el menú de ayuda y consejos de uso.

### 9. Arquitectura Técnica e Infraestructura
* **Transporte Dual:**
  * **Modo Socket (Dev / Monotenant):** Conexión vía WebSockets salientes sin necesidad de IP pública ni túneles.
  * **Modo HTTP Nativo con OAuth v2 (Producción Multitenant):** Endpoint listo para instalar el bot en múltiples workspaces externos mediante el flujo "Add to Slack".
* **Base de Datos:** SQLite embebido con Prisma ORM, con modo WAL habilitado para lecturas y escrituras concurrentes de alta velocidad.
* **Sin dependencias de IA:** Costo operativo cero por APIs de transcripción o tokens de LLMs.
* **Suite de Pruebas:** Tests automatizados para validaciones de esquemas Zod, límites de acceso de speakers, renderizado de barras de progreso y cálculo matemático de asignación de minutos.
