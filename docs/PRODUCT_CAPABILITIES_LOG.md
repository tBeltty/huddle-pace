# 📖 Registro de Capacidades y Cambios del Producto — HuddlePace

> **REGLA DE ORO DE ESTE DOCUMENTO:**
> Este registro se mantiene estrictamente en **orden cronológico inverso (del más reciente al más antiguo)**.
> Toda nueva funcionalidad, modificación arquitectónica, cambio de diseño o ajuste técnico **debe escribirse ARRIBA**, de modo que lo más nuevo siempre sea lo primero que se lee.

## [2026-10-06] Política de Privacidad Alineada con el Sitio Sin Cookie de Idioma
* **`privacy.html` y `src/locales/*.json`**: se elimina la mención de la cookie `huddlepace_lang`, que el sitio dejó de escribir al pasar a URLs por idioma, y se actualiza la fecha de última modificación al 6 de octubre de 2026.

## [2026-10-06] CSS Versionado por Release para Evitar Caché Obsoleta en Cloudflare
* **Problema:** Cloudflare conservó el `site.css` anterior con la cabecera `immutable` que ya no enviamos, y las páginas nuevas quedaron sin estilos de skip link y FAQ.
* **Solución:** todas las páginas enlazan `/assets/site.css?v=__APP_VERSION__`; el servidor sustituye el marcador por la versión de `package.json`, de modo que cada release usa una URL nueva.

## [2026-10-06] SEO de Contenido: Páginas por Keyword y FAQ con Schema
* **Dos páginas nuevas en inglés y español**:
  * **`/slack-huddle-timer`** y **`/es/temporizador-huddle-slack`**: cómo funciona, qué ve el equipo durante la llamada, comandos reales (`/pace`, `status`, `report`, `clear`, `help`), diseño sin audio y precio.
  * **`/daily-standup-timer-slack`** y **`/es/temporizador-daily-standup-slack`**: daily de 15 minutos con reparto 15 / 60 / 25, avisos privados al speaker, templates y `/pace report 30`.
  * Cada una tiene su título, descripción, canonical, `hreflang`, `WebPage` y `BreadcrumbList`, y entra al sitemap (ahora 10 URLs).
* **FAQ en la home (`index.html`, `landingPage.ts`)**: seis preguntas visibles en ambos idiomas. El JSON-LD `FAQPage` se genera desde las mismas cadenas de `src/locales/*.json`, así el marcado nunca difiere del texto visible.
* **Precio público**: acceso temprano, gratis hoy, cobro futuro por workspace (nunca por usuario) y las funciones actuales siguen gratis. No se publica el cupo de los primeros workspaces para evitar un texto que quede falso.
* **Reescritura de enlaces**: `landingPage.ts` define cada página como un par EN/ES (`PAGE_PAIRS`) y de ahí salen las rutas, el sitemap, los `hreflang` y los enlaces internos de `/es/*`.
* **Nota de proceso**: el informe de keywords proponía comandos que no existen (`/pace 15m`, `start`, `next`, `wrap`, `cancel`). Se descartaron y el copy usa solo los comandos del README.

## [2026-10-06] SEO Técnico: Sitio en Español con URL Propia, Sitemap y Datos Estructurados
* **Idioma por URL (`landingPage.ts`)**:
  * **Rutas:** `/`, `/privacy` y `/terms` sirven inglés. `/es/`, `/es/privacy` y `/es/terms` sirven español. `Accept-Language`, la cookie `huddlepace_lang` y el cambio automático por idioma del navegador ya no alteran el contenido, así que Google puede indexar las dos versiones.
  * **Señales por página:** canonical propio, `hreflang` en/es/x-default, `og:locale` y `og:locale:alternate`. Los enlaces internos de `/es/*` se mantienen dentro de `/es/`.
  * **Redirecciones 301:** `/?lang=es` va a `/es/`, `/?lang=en` va a `/`, y `/es` o las variantes con barra final van a su ruta canónica.
  * **Caché:** el HTML ya no envía `Vary: Cookie` ni `Set-Cookie`, de modo que Cloudflare no puede servir el idioma equivocado.
* **`/sitemap.xml` y `/robots.txt`**: seis URLs con alternates `hreflang`; `robots.txt` declara el sitemap y bloquea `/slack/`. Cloudflare antepone su bloque de content-signals.
* **Datos estructurados**: grafo `Organization` + `WebSite` + `SoftwareApplication`, con descripción e `inLanguage` en español para `/es/`.
* **Performance y accesibilidad**: avatar de 96 px (17 KB en vez de 619 KB), widget de soporte cargado en idle, `Cache-Control` sin `immutable`, `<main>`, skip link, `:focus-visible`, contraste de `--text-muted` y encabezados decorativos convertidos en párrafos.
* **Pendiente**: páginas de contenido por nicho y FAQ (según el mapa de keywords), y revisar el texto legal de privacidad que menciona la cookie de idioma, que el sitio ya no escribe.

## [2026-10-06] Edición de Meetups Programados que Aún No Han Iniciado
* **Botón "✏️ Edit" en App Home (`homeTab.ts`, `modalHandlers.ts`)**:
  * **Dónde aparece:** Debajo de cada meetup en *My Scheduled Meetups*, junto a `🚀 Start in Huddle`. Los meetups del resto del workspace no muestran el botón.
  * **Mismo modal, precargado:** `edit_scheduled_meetup_action` abre el modal de agenda con título, canal, speakers, duración, destino, recordatorios y módulos del meetup. El título pasa a `Edit Meetup` y el envío a `Save Changes`. El selector de templates se oculta en este modo.
  * **Duraciones atípicas:** Si el meetup tiene una duración fuera de las opciones del selector (por ejemplo 25 min creada con `/pace`), se agrega como opción para que editar no la cambie en silencio.
* **Reglas y seguridad en el servidor (`meetupService.ts`)**:
  * **Solo speakers:** Quien guarda debe ser speaker del meetup y pertenecer al mismo workspace; se revalida al abrir y al guardar.
  * **Solo `SCHEDULED`:** `updateScheduledMeetup` actualiza dentro de una transacción con la condición `status = SCHEDULED`. Si la sesión arrancó mientras editabas, el modal muestra el error "already started" o, si ocurre justo al guardar, no se aplica ningún cambio y recibes un aviso por DM.
  * **Módulos reemplazados de forma atómica:** Se borran y recrean con las duraciones recalculadas. Si los porcentajes no suman 100, el meetup queda intacto.
  * **Se conserva el horario:** `scheduledFor` no cambia. App Home se refresca para quien edita y para los speakers anteriores y nuevos.
* **Cobertura (`tests/meetupTemplates.test.ts`, `tests/homeTab.test.ts`)**: Reemplazo de campos y módulos, rechazo tras iniciar, rollback por porcentajes inválidos, modal en modo edición y visibilidad del botón por rol.

## [2026-10-06] Reparto Automático del Presupuesto de Tiempo (%) en el Modal de Agenda
* **Valores reales en lugar de placeholders (`scheduleModal.ts`)**:
  * **Reparto inicial listo para agendar:** Los tres módulos arrancan con 15 / 60 / 25, que ya suman 100. Si no necesitas cambios, agendas directo.
  * **Enter para rebalancear:** Slack no avisa al salir de un campo, solo al pulsar Enter o por cada tecla (lo que haría inestable el modal mientras escribes). Los campos de % usan `dispatch_action_config` con `on_enter_pressed`.
* **Reglas de reparto (`src/utils/percentages.ts`, `modalHandlers.ts`)**:
  * **Edición:** Al confirmar un % con Enter, el resto se reparte en partes iguales entre los demás módulos. Con 30 / 40 / 30, cambiar el primero a 40 deja 40 / 30 / 30. Si el resto no divide exacto, las unidades sobrantes van a los primeros módulos.
  * **Límites:** El valor editado se acota para que cada otro módulo conserve al menos 1%. Un valor que no sea entero mayor o igual a 1 no modifica el formulario.
  * **Agregar módulo:** El módulo nuevo toma una parte equitativa (100 / n) y los existentes se reducen en proporción, así el total sigue en 100.
  * **Validación intacta:** El envío sigue exigiendo 100% como respaldo si alguien escribe un valor sin pulsar Enter.
* **Cobertura (`tests/percentages.test.ts`)**: Reparto parejo, límites, módulo único, total siempre en 100 de 1 a 10 módulos y valores iniciales del modal.

## [2026-10-06] Templates de Sesión: Guarda una vez, agenda en un clic
* **Guardar como Template desde el modal de agenda (`scheduleModal.ts`, `modalHandlers.ts`, `meetupService.ts`)**:
  * **Checkbox "Save as template":** Al final del modal `Schedule Meetup` puedes marcar la opción antes de agendar. El template toma el título de la sesión como nombre; si guardas otro con el mismo título, lo actualiza en lugar de duplicarlo.
  * **Qué se guarda:** Canal, speakers, duración, destino del Huddle (`auto` o feed principal), recordatorios de cierre y todos los módulos con su porcentaje.
  * **Hilos de Huddle específicos no se guardan:** Un hilo concreto termina con la llamada, así que el template vuelve a detectar el Huddle activo (`auto`). El destino "feed principal" sí se conserva.
* **Usar un template (`template_select`)**:
  * **Selector "Start from a template":** Aparece arriba del modal cuando tienes templates guardados, desde `/pace`, el botón de App Home y el atajo global. Al elegir uno, todos los campos se precargan y, si no necesitas cambios, solo pulsas `Schedule & Ready`.
  * **Precarga confiable:** Slack conserva lo que ya escribiste en inputs con el mismo `block_id` e ignora el nuevo `initial_value`. Por eso los `block_id` llevan un sufijo de revisión (`modalBlockId`) que cambia al aplicar un template, y los handlers leen los valores por `action_id` (`getModalAction`).
  * **Eliminar:** Con un template elegido aparece `🗑 Delete template` con confirmación.
* **Persistencia y privacidad (`schema.prisma`)**:
  * **Nuevo modelo `MeetupTemplate`:** Único por `teamId + ownerUserId + name`. Cada template es privado de su creador dentro del workspace; las consultas de lectura y borrado filtran por dueño.
  * **Sin migraciones manuales:** El modelo es aditivo y el pipeline de deploy ya ejecuta `pnpm db:push`.
* **Cobertura (`tests/meetupTemplates.test.ts`)**: Guardado, actualización por nombre, aislamiento por usuario y workspace, borrado, visibilidad del selector, revisión de `block_id` y precarga de módulos.

## [2026-09-30] Control de Acceso Basado en Roles y Rol Delegado "Bot Manager" para Ajustes
* **Jerarquía de Permisos en Ajustes (`meetupService.ts`, `settingsModal.ts`, `homeHandlers.ts`, `commandHandlers.ts`, `modalHandlers.ts`)**:
  * **Acceso de Edición Reservado (`canEdit`):** Solo pueden modificar los valores globales del espacio de trabajo los administradores/propietarios de Slack (`is_admin`, `is_owner`, `is_primary_owner`), el instalador original de la aplicación (`installedByUserId`) y los miembros designados con el rol delegado de "Bot Manager".
  * **Modo de Solo Lectura para Miembros Generales:** Si un usuario sin privilegios abre el modal (desde el botón `Settings` en App Home o mediante `/pace settings`), visualiza una vista informativa bloqueada (`🔒 Read-Only View`) con los valores vigentes de recordatorios, margen de flexibilidad y la lista de Bot Managers, sin botón de guardado.
  * **Selector de Bot Managers Delegados (`multi_users_select`):** Los administradores y gestores autorizados disponen de un selector múltiple de usuarios (`manager_settings_block`) para designar o remover compañeros con acceso a la configuración del bot sin necesidad de otorgarles permisos de administrador a nivel de todo el workspace de Slack.
  * **Validación de Seguridad en el Backend:** El manejador `submit_settings_modal` revalida la autorización del usuario antes de persistir cambios en la base de datos, rechazando intentos de guardado no autorizados.
  * **Persistencia en Base de Datos (`schema.prisma`):** Campo `managerUserIds` en el modelo `WorkspaceSettings` para almacenar los identificadores de Slack delegados.

## [2026-09-30] Modal de Ajustes de Workspace: Toggles Independientes de Recordatorio y Control de Flexibilidad
* **Toggles Independientes de Recordatorio en Hilo (`settingsModal.ts`, `scheduleModal.ts`, `timerWorker.ts`, `schema.prisma`)**:
  * **Envío Sutil vs. Visual:** El recordatorio de aproximación al cierre (~16.7% restante) envía de forma predeterminada un bloque de texto de contexto (`⏱️ Healthy Reminder: Approaching our scheduled finish line...`), permitiendo activar el banner ilustrado de Vector a quienes prefieran un formato más visual y llamativo en el hilo del Huddle.
  * **Controles Separados de Texto e Imagen:** Se implementan dos opciones configurables por separado: *"Send reminder text"* (activo por defecto) y *"Send reminder image"* (desactivado por defecto).
  * **Persistencia en Dos Niveles:** Los valores predeterminados del equipo se configuran en el modelo `WorkspaceSettings`. Al agendar una reunión específica en `Schedule Meetup` (`buildScheduleModal`), los organizadores pueden anular o personalizar estos controles para dicha sesión (`Meetup.reminderTextEnabled` y `Meetup.reminderImageEnabled`).
  * **Despacho Condicional en el Worker:** El motor en segundo plano (`timerWorker.ts`) evalúa las banderas de la sesión: si solo el texto está activo, despacha únicamente el bloque de contexto; si la imagen está activa, incluye el banner de Vector; si ambas están desactivadas, no envía ningún mensaje.
* **Control de Flexibilidad y Margen de Tolerancia en Ajustes (`meetupService.ts`, `settingsModal.ts`)**:
  * **Tres Modos de Margen de Gracia (`flexibilityMode`):**
    * **Standard (15% grace buffer — Predeterminado):** Proporciona de 3 a 10 minutos según la duración programada, marcando reuniones extendidas como `⏳ Flexible` sin penalizar el cumplimiento del equipo.
    * **Relaxed (25% grace buffer):** Margen de tolerancia ampliado (5 a 15 minutos) para sesiones de discusión abierta.
    * **Strict (0% buffer):** Cero margen de gracia; cualquier minuto extra trascurrido se clasifica directamente como `⚠️ Overtime`.
  * **Aplicación Automática en Analytics:** `getPacingReportStats` lee la configuración del espacio de trabajo para computar la tasa de puntualidad (`complianceRate`) según el modo seleccionado.
* **Puntos de Acceso al Modal de Ajustes (`homeTab.ts`, `homeHandlers.ts`, `commandHandlers.ts`)**:
  * **Botón en App Home:** Se agrega el botón interactivo `Settings` a la barra de acciones principales (`home_action_bar`), junto a `➕ Schedule Meetup`, `Analytics` y `Guide`.
  * **Comando Slash:** Soporte para `/pace settings` y `/pace config`, abriendo de inmediato el modal de configuración nativo en Slack.

## [2026-09-30] Inyección Dinámica de Versión en Footer Web e Indicador de Release
* **Inyección Dinámica de SemVer en Footer Web (`landingPage.ts`, `site.css`, HTMLs y diccionarios de i18n)**:
  * **Cero Versiones Hardcodeadas:** La versión oficial de la aplicación se lee dinámicamente desde `package.json` mediante `getAppVersion()` en el arranque y en tiempo de renderizado SSR (`getPageHtml` y `getLocaleDictionary`).
  * **Insignia Visual `.version-tag` en Notas de Versión:** En el footer de la página principal (`index.html`), políticas de privacidad (`privacy.html`) y términos (`terms.html`), el enlace a *"Release Notes"* / *"Notas de Versión"* incorpora una insignia de telemetría (`v1.1.0`) estilizada con fondo translúcido y acento cian.
  * **Sincronización con Píldora de Telemetría:** El indicador de metadatos en el pie de página (`footerPill`) actualiza dinámicamente la versión activa de Vector tanto en la renderización del servidor como en el cambio de idioma dinámico en el cliente.
  * **Pruebas de Cobertura Automatizadas:** Se valida con pruebas unitarias que `getAppVersion()` retorne una cadena SemVer estricta y que el HTML servido nunca exponga el token crudo `__APP_VERSION__`.

## [2026-09-30] Flexibilidad en Analytics (Grace Period), Enrutamiento de Permisos a Threads y Recordatorio Amistoso Canónico de Vector
* **Flexibilidad en Analytics y Margen de Tolerancia (`meetupService.ts`, `reportBlock.ts`)**:
  * **Cálculo de Gracia Inteligente Proporcional (`calculateGraceMinutes`):** Se establece un margen de tolerancia equivalente a ~16.7% del tiempo programado con un piso de 3 minutos ($\max(3, \text{round}(\text{totalMinutes} \times 0.1667))$). En reuniones de 1 hora otorga 10 minutos de tolerancia (a tiempo hasta los 70m); en 30m otorga 5 minutos; en 15m otorga 3 minutos.
  * **Preservación del Compliance Rate:** Las llamadas que terminan entre 3 y 5 minutos después de su presupuesto ya no se penalizan injustamente como `Overtime` ni degradan el porcentaje de puntualidad del equipo.
  * **Visualización Tripartita en Reportes:** `/huddle report` y App Home reflejan tres estados en el registro histórico: `✅ On Time` (dentro del tiempo exacto), `⏳ Flexible (+Xm)` (dentro del margen de gracia) y `⚠️ Overtime` (fuera del margen).
* **Enrutamiento de Advertencias de Permisos al Mismo Thread (`actionHandlers.ts`)**:
  * **Inyección de `thread_ts` en `chat.postEphemeral`:** En los cinco manejadores de control interactivo (`start_scheduled_meetup_action`, `next_module_action`, `casual_chat_meetup_action`, `snooze_meetup_action`, `conclude_meetup_action`), las notificaciones privadas de `Access Denied` incluyen ahora el identificador del hilo (`b.message?.thread_ts || b.message?.ts || meetup.threadTs`).
  * **Eliminación de Contaminación en Canal Raíz:** Las alertas privadas se despliegan en el mismo hilo del Huddle donde el espectador hizo clic, previniendo apariciones fuera de contexto en el feed principal del canal.
* **Recordatorio Amistoso Poco Invasivo con Banner Canónico de Vector (`timerWorker.ts`, `public/assets/reminder-healthy.jpg`)**:
  * **Despacho Único y No Invasivo por Sesión:** El motor del temporizador despacha exactamente un único aviso en el hilo del Huddle al ingresar en la ventana proporcional previa al cierre (10 minutos antes en sesiones de 1h, 5m antes en 30m, 3m antes en 15m).
  * **Asset Canónico de Vector:** Composición visual limpia con el arte oficial de Vector sonriente (`vectorfull.png`), arnés táctico, visor ámbar, fondo aeroespacial y tipografía clásica Newsreader (*"Healthy reminder / We're approaching our scheduled finish line / Time check"*).
  * **Mensaje de Cierre Colaborativo en Block Kit:** Acompañado de un bloque de contexto sutil en inglés estricto invitando al equipo a alinear tareas pendientes y cerrar acuerdos sin cortar abruptamente la conversación.

## [2026-09-30] Estándar Enterprise Audit-Only, Matriz de Permisos y Política de Seguridad
* **Reingeniería de Documentación Pública y Postura de Seguridad (`README.md`, `SECURITY.md`)**:
  * **Alineación con Licencia Source-Available & Audit-Only:** Se erradican guías de despliegue local o configuración de bots en Slack para terceros; el repositorio se posiciona oficialmente como código abierto para auditoría de seguridad, privacidad y cumplimiento por parte de administradores de Slack.
  * **Sección de Postura de Seguridad y Privacidad:** Declaración explícita de invariantes arquitectónicos: cero captura o procesamiento de flujos de audio/voz, cero telemetría hacia LLMs externos (OpenAI, Anthropic), minimización estricta de datos (solo metadatos temporales de sesión) y controles por rol.
  * **Matriz de Auditoría de Scopes de Slack:** Tabla técnica que justifica la necesidad operativa de cada uno de los 9 permisos solicitados en `manifest.json`, disipando inquietudes de seguridad sobre `channels:history` o `groups:history`.
  * **Verificación de Integridad para Auditores:** Sustitución de guías de desarrollo por comandos deterministas de auditoría (`pnpm install && pnpm test`) para ejecutar la suite de 99 pruebas y controles negativos sin credenciales de red.
  * **Resumen Arquitectónico de Alto Nivel:** Sustitución del árbol ASCII de 50 archivos por un mapa modular de 4 capas (`src/slack`, `src/services`, `src/scheduler`, `prisma`).
  * **Política Oficial de Seguridad (`SECURITY.md`):** Creación del archivo canónico en la raíz del repositorio definiendo versiones soportadas, invariantes del sistema y procedimiento de divulgación responsable mediante correo privado (`support@huddlepace.com`).

## [2026-09-30] Role-Gating Estricto en App Home, Estandarización de Releases y Transparencia Web
* **Aislamiento de Controles por Rol en App Home (`homeTab.ts`, `tests/homeTab.test.ts`)**:
  * **Ocultamiento de "Start in Huddle" a Espectadores:** En la sección "📅 Workspace Meetups", el botón accesorio `🚀 Start in Huddle` (`start_scheduled_meetup_action`) se omite para los usuarios que no figuran como oradores (`speakerUserId`) de la sesión. Los miembros que participan como espectadores visualizan los detalles de la agenda, los oradores y el desglose de módulos sin botones interactivos no ejecutables.
  * **Ocultamiento de "Conclude" en Sesiones Activas a No-Oradores:** En "🟢 Active Sessions", el botón `⏹️ Conclude` (`conclude_meetup_action`) queda condicionado a que el usuario sea orador asignado (`isSpeaker`). Los espectadores observan la barra de progreso y el estado en tiempo real sin controles destructivos de finalización.
  * **Coherencia UI / Backend:** Se elimina la discrepancia visual donde la interfaz mostraba acciones que el interceptor de seguridad del backend (`actionHandlers.ts: isUserAuthorizedForMeetup`) ya bloqueaba con `Access Denied`.
* **Sistema Oficial de Releases y Registro de Cambios (`CHANGELOG.md`, `release.yml`, `RELEASE_PROCESS.md`)**:
  * **Adopción de SemVer 2.0.0 y Keep a Changelog 1.1.0:** Estructuración de `CHANGELOG.md` con categorías semánticas estandarizadas (`Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`) y enlaces de comparación diferencial entre etiquetas de Git.
  * **Pipeline de GitHub Releases Automatizado (`.github/workflows/release.yml`):** Al enviar etiquetas `v*.*.*` al repositorio remoto, GitHub Actions extrae de forma autónoma la sección de notas del changelog y genera o actualiza el release correspondiente en GitHub.
  * **Comandos de Versionado en `package.json`:** Incorporación de scripts `pnpm version:patch`, `version:minor` y `version:major` para sincronizar versiones sin etiquetas prematuras.
  * **Guía Operativa de Publicación (`docs/guidelines/RELEASE_PROCESS.md`):** Protocolo normativo paso a paso para pruebas previas, actualización de changelog, bumping, verificación en CI/CD y despliegue de etiquetas.
* **Transparencia de Código y Enlaces a GitHub en la Web Pública (`index.html`, `privacy.html`, `terms.html`, traducciones)**:
  * **Acceso a Repositorio en Navbar:** Adición de botón con el ícono vectorial de GitHub en la barra superior de navegación en la landing principal y páginas legales.
  * **Columna de Confianza y Seguridad en Footer:** Enlace directo a "Código Fuente Auditable (GitHub)" en el pie de página, reflejando el modelo de licencia Source-Available / Audit-Only.
  * **Redirección de Release Notes:** El enlace de "Notas de la Versión" apunta directamente al historial de GitHub Releases (`https://github.com/tBeltty/huddle-pace/releases`).
* **Identidad de Bot y Descripción Detallada en Manifiesto de Slack (`manifest.json`)**:
  * **Nombre de Bot Diferenciado (`Vector`):** Configuración de `features.bot_user.display_name: "Vector"` para que el bot aparezca identificado como Vector en canales, mensajes directos e hilos de Huddles, manteniendo el nombre de producto `HuddlePace` a nivel de aplicación.
  * **Descripción Extendida (`long_description`):** Incorporación de descripción estructurada en Markdown detallando las capacidades de HuddlePace (timeboxing modular, barra de progreso, alertas privadas al orador y controles por rol) visible en la pestaña informativa del perfil del bot en Slack.
* **Corrección de Resolución de Manifiesto en CI (`package.json`)**:
  * **Eliminación de `main` en `package.json`:** Al tratarse de un servicio de aplicación independiente y no una librería npm, se retira la clave `"main": "dist/index.js"`. Esto previene que el sistema de resolución de paquetes de Node.js ejecute `dist/index.js` en Linux ante enlaces simbólicos de dependencias opcionales de plataforma (`fsevents`) durante la ejecución de pruebas automatizadas en CI.

## [2026-09-22] Chat Bidireccional en Vivo en Widget y Erradicación de Despacho de Correo
* **Chat Interactivo en Tiempo Real dentro del Widget (`support-widget.js`, `vano.tbelt.online`)**:
  * **Hilo Conversacional en Vivo (`thread view`):** Tras enviar el formulario de contacto inicial en el widget de `huddlepace.com`, la vista ya no muestra un texto estático de confirmación ni finaliza el flujo: transiciona de inmediato a la vista interactiva de chat (`thread`), idéntica al sistema de soporte en vivo de Capylite.
  * **Burbujas y Mensajería Dinámica:** Interfaz con flujo cronológico de mensajes. Los mensajes del visitante se alinean a la derecha con acento temático de marca (`#06b6d4`), y las respuestas del agente de soporte se alinean a la izquierda con avatar/nombre del equipo de soporte y marca temporal.
  * **Respuestas de Seguimiento y Polling:** El visitante puede enviar réplicas continuas directamente desde el compositor del widget mediante `POST /api/v1/conversations/:id/messages` con rol de cliente (`senderRole: customer`). El widget sondea actualizaciones cada 5 segundos de forma silenciosa e incorpora las respuestas del agente al instante.
  * **Persistencia de Sesión y Tarjeta en Home:** La conversación activa se preserva en `localStorage`. Si el visitante navega o refresca la web, la pestaña Home del widget destaca una tarjeta con acceso directo ("Conversación en curso") para retomar el chat o iniciar una nueva consulta.
  * **Indicador de Mensajes No Leídos:** Notificación visual tipo insignia numérica en el botón flotante del widget (`launcher badge`) cuando ingresan mensajes del agente mientras el panel permanece cerrado.
  * **Cero Correo a Visitantes del Widget:** Erradicación total del envío de correos electrónicos al responder a tickets generados desde el widget (`userId: null`). Toda la comunicación se canaliza exclusivamente a través del chat interactivo del widget en el navegador.

## [2026-09-22] Skill Especializado: Ciclo de Vida y Distribución de Apps de Slack (`slack-app-distribution`)
* **Incorporación del Skill de Distribución (`.agents/skills/slack-app-distribution/SKILL.md`, `AGENTS.md`)**:
  * **Matriz de modelos de distribución:** Guía arquitectónica comparativa entre apps monotenant no distribuidas, apps multitenant no listadas (distribución pública mediante OAuth 2.0 y enlace directo) y aplicaciones listadas en el Slack Marketplace.
  * **Requisitos técnicos previos de distribución:** Protocolo de cumplimiento obligatorio de SSL/TLS (HTTPS) para URLs de OAuth redirect, interactividad, carga de opciones externas de Block Kit y suscripciones a Events API; almacenamiento seguro multitenant y compatibilidad con Enterprise Grid (`is_enterprise_install`).
  * **Mecánica de desinstalación y regla crítica de scopes:** Guía de manejo del evento `app_uninstalled` y alerta operativa sobre desinstalaciones automáticas cuando el usuario instalador abandona el workspace (impacto de solicitar scopes más allá de `bot`, `incoming-webhook`, `commands` e `identify`).
  * **Matriz de actualizaciones de manifest y reinstalación:** Mapeo de cambios que detonan `permissions_updated: true` en `apps.manifest.update` (requiriendo reautorización de administradores) frente a cambios de aplicación inmediata (metadatos de display, comandos slash, configuración de Socket Mode).
  * **Automatización CI/CD con Slack CLI:** Configuración de hooks de despliegue (`.slack/hooks.json`) y pipeline automatizado con GitHub Actions utilizando `slack deploy` y `SLACK_SERVICE_TOKEN`.

## [2026-09-22] Protocolo de Cero Manipulación de VPS y Despliegue Continuo Obligatorio (CI/CD)
* **Automatización y Regla de Despliegue Obligatorio en CI/CD (`AGENTS.md`, `DEFINITION_OF_DONE.md`)**:
  * **Cero intervención manual en el VPS:** Queda formalmente prohibida la copia manual de archivos (`scp`), edición remota directa o reinicio manual de procesos para aplicar funcionalidades en producción.
  * **Flujo único de entrega:** Toda feature, corrección, migración o ajuste debe pasar por commit con Conventional Commits, push a `origin/main` y ejecución exitosa del pipeline de GitHub Actions (`.github/workflows/ci.yml`).
  * **Prohibición de cambios locales huérfanos:** Ninguna tarea se considera terminada si el código permanece en el árbol de trabajo local (`working tree dirty`). El agente debe verificar que el job de Continuous Deployment se ejecute y reporte éxito (`✓`) en la VPS automáticamente.
  * **Límite operativo de SSH:** El acceso SSH al servidor queda acotado exclusivamente a tareas de diagnóstico de sólo lectura (inspección de logs de PM2 o systemd en caso de incidentes).

## [2026-09-22] Botón "Next Module" (⏭️), Comando `/pace clear` y Homologación de Nomenclatura
* **Botón interactivo "Next Module" (`⏭️`) en el Live Tracker (`trackerBlock.ts`, `actionHandlers.ts`, `meetupService.ts`)**:
  * Permite a los oradores saltar al siguiente tema si terminan antes de tiempo.
  * **Transferencia de tiempo al módulo siguiente:** El módulo actual concluye en el minuto transcurrido real; el tiempo ahorrado se transfiere íntegramente al módulo inmediato siguiente para ampliar su duración, mientras que los módulos posteriores (módulo 3 en adelante) conservan inalterados sus horarios de inicio y fin originales.
  * **Control de acceso estricto (`role-gated`):** Solo los speakers asignados o el organizador pueden activar el salto; espectadores reciben un aviso efímero de acceso denegado.
  * Notificación privada por DM a los speakers confirmando el avance de tema y refresco en tiempo real del App Home.
* **Comando `/pace clear` (`commandHandlers.ts`)**:
  * Limpieza del historial de mensajes privados (DMs) del usuario con el bot de HuddlePace.
  * Localiza la conversación 1 a 1 mediante `conversations.open`, recupera los mensajes y elimina en lote los mensajes emitidos por el bot.
* **Homologación de Nomenclatura en Instrucciones y Copys de Usuario**:
  * Sustitución sistemática de menciones de "Vector" en guías e instrucciones operativas por **"HuddlePace bot"** o **"HuddlePace"**.
  * Actualización del artículo del Help Center (`aefc06b6-abe7-4f89-9ef3-19bb2c19478a`) en producción reflejando el botón `Next Module`, `/pace clear` y las alertas reales.

* **Corrección de precisión operativa en producción (`aefc06b6-abe7-4f89-9ef3-19bb2c19478a`)**:
  * Sustitución de explicaciones ambiguas sobre la detección automática de Huddles por los flujos reales de la arquitectura:
    * Sesiones programadas (`/pace` modal): auto-inicio directo en el hilo del Huddle al detectar la llamada en el canal o al entrar el speaker responsable.
    * Huddles espontáneos sin programar: tarjeta en standby en el hilo del Huddle con botones de despegue rápido (`15m Quick Flight`, `25m Sync`), menciones `@HuddlePace 15m` o `/pace 15m [Título]`.
    * Lanzamiento manual de agenda pendiente mediante `/pace start`.
  * Documentación de controles interactivos con restricción de roles (`role-gated`): protección de botones (`Siguiente Tema`, `Just Chatting`, `Concluir`) para evitar interrupciones por parte de espectadores no autorizados.
  * Documentación de notificaciones privadas por DM al speaker para avisos de mitad de tiempo y relevo de turnos sin interrumpir el audio.
  * Documentación de auto-cierre al finalizar el Huddle y visualización de analíticas de 30 días en el App Home y `/pace report`.
  * Erradicación de patrones sintéticos de IA y guiones largos en el HTML publicado en producción.
* **Guía de integración del CLI (`docs/guides/HELP_ARTICLES_CLI.md`)**:
  * Documentación del puente multi-tenant con el CRM central (`capylite.co/api`, `appId: 07dc5cf9-2bc9-4f85-a7fa-e9eb76fe4ff1`) para gestionar artículos de soporte desde la terminal.

* **Adaptación arquitectónica desde `finances_app`**:
  * Creación del documento canónico de referencia de marca [`docs/BRAND.md`](BRAND.md), formalizando las decisiones de diseño e identidad visual de HuddlePace.
  * **Paleta Atmos "Aerospace Telemetry"**: Especificación formal de tokens CSS y roles semánticos:
    * Base: Space Navy (`#080B11`, `--bg-base`) y Cockpit Slate (`#0F172A`, `--bg-surface`).
    * Acentos: Telemetry Cyan (`#06B6D4`, `--accent-cyan`), Visor Amber (`#F59E0B`, `--accent-amber`), Pilot Orange (`#F97316`, `--accent-orange`), y Slack Aubergine (`#611F69`, `--accent-slack`).
    * Mapeo de estados de Slack Block Kit: tiempo activo (Cyan/`⏱️`), midpoint/bloqueos (Amber/`🧭`), último minuto (Orange/`⚠️`), overtime (Red/`🚨`), y cierre (Emerald/`✅`).
  * **Tipografía oficial**: Plus Jakarta Sans (Display, UI, Web) y JetBrains Mono con números tabulares para ASCII progress bar y telemetría de cronómetro.
  * **Ficha de personaje y plantilla de prompts de Vector (The Pacer Falcon)**: Estandarización de lore en el universo Vibecoder (junto a Cluck-O), especificaciones de gadgets (HUD monocle ámbar, headset táctico, chaleco de vuelo) y prompt base parametrizado para pipelines de generación visual de poses.
  * **Directrices de Slack App Directory**: Estandarización de nombres de visualización, descripciones cortas/largas en EN/ES y colores de fondo oficiales.
  * **Higiene de repositorio**: Vinculación cruzada en `docs/README.md`, `docs/guidelines/UI_SLACK_BLOCKS_CSS.md` y `AGENTS.md`.

## [2026-09-22] Auditoría Forense y Optimización del Copy de Todo el Sitio (Web & Legales)
* **Erradicación estricta de em-dashes (`—`) y contrastes binarios**:
  * Eliminación sistemática de guiones largos en títulos, descripciones y cuerpos de texto en `public/index.html`, `public/privacy.html`, `public/terms.html`, y los diccionarios i18n (`src/locales/en.json`, `src/locales/es.json`, `public/locales/en.json`, `public/locales/es.json`).
  * Desactivación del patrón sintético de contraste binario (*"not just X, but Y"* / *"no solo X, sino Y"*) en las políticas de privacidad y términos, sustituyéndolo por declaraciones técnicas asertivas e integradas en la arquitectura.
* **Calibración de cadencia humana y eliminación de simetría tripartita (AI-Slop)**:
  * Sustitución de listas de tres elementos rítmicos artificiales (*"zero X, zero Y, 100% Z"*) por beneficios directos fundamentados en la realidad del trabajo remoto (evitar que la daily invada el bloque de desarrollo, sin grabar audio).
  * Eliminación de revelaciones dramáticas con dos puntos en las alertas del simulador (`simAlert`), unificando en avisos claros y contextualizados con el dolor real de un standup ágil (destrabar PRs y bloqueos antes de que acabe el tiempo).
* **Corrección idiomática en español (Tuteo estricto y eliminación de calcos)**:
  * Corrección de la doble negación errónea en la descripción de Vector (*"evitando que nadie..."* -> *"para que nadie tenga que hacer de policía en la reunión"*).
  * Sustitución del término anacrónico *"Orador"* por *"Speaker"* en los metadatos de sincronización diaria.
  * Reemplazo de calcos literales anglosajones (*"valoran el foco"* -> *"cuidan su tiempo"*).
* **Sincronización total SSR y cliente**:
  * Alineación exacta de las cadenas de texto del servidor SSR (`src/web/landingPage.ts`) y del cliente interactivo en el DOM.
  * Actualización de aserciones en la suite de pruebas automatizadas (`tests/landingPage.test.ts`), manteniendo 100% de tests en verde (96 pruebas pasando).

## [2026-09-22] Suite de Redacción Avanzada, Playbook Editorial y Protocolo Anti-AI Slop
* **Migración y adaptación desde `finances_app`**:
  * Incorporación de la suite completa de 9 habilidades de redacción en `.agents/skills/` (versionadas en Git) y sincronizadas en `.claude/skills/`:
    * `no-ai-slop`: Erradicación obligatoria de patrones sintéticos de IA (contrastes binarios, revelaciones dramáticas con dos puntos, aperturas de autoayuda, muletillas corporativas) contextualizada para Slack Block Kit, landing y documentación.
    * `text-humanizer`: Calibración de burstiness, perplejidad, voz activa y escudo inmutable para tokens protegidos de Slack (`/pace`, menciones `<@U...>`, minutos y métricas).
    * `copywriting`: Redacción persuasiva y de conversión para Slack App Directory, landing bento/atmos y páginas de producto.
    * `copy-editing`: Framework de las Siete Pasadas (*Seven Sweeps*) y velocidad estructural.
    * `proofreading`: Revisión mecánica y ortotipográfica en inglés y español (jerarquía RAE de coma vs. punto y coma vs. punto y seguido).
    * `paragraph-structure`: Auditoría de límites de párrafos para evitar saltos de contexto ocultos.
    * `ogilvy`: Principios de David Ogilvy de posicionamiento (*¿qué hace y para quién es?*), promesa única y segmentación psicológica de equipos ágiles.
    * `content-strategy`: Planificación de contenidos enfocados en los dolores reales de Scrum Masters, Tech Leads y Agencias.
    * `competitor-alternatives`: Arquitectura y plantillas para comparativas contra alternativas (Clockwise, temporizador nativo de Slack, Fellow, Standuply).
    * `NOTICE-boraoztunc.md`: Atribución y trazabilidad de licencias MIT.
* **Playbook Editorial Anti-IA de 14 Pasos (`docs/marketing/COPYWRITING_PLAYBOOK.md`)**:
  * Protocolo integral de redacción pre-entrega diseñado para superar detectores de IA (GPTZero, Copyleaks) mediante escenas de fricción física y sensorial de reuniones remotas (lag al desmutear el micrófono, silencio incómodo de 10 segundos, debates de 40 minutos en el PR, calendar Tetris).
* **Actualización normativa de estándares**:
  * Actualización de [`docs/guidelines/EDITORIAL_STANDARDS.md`](guidelines/EDITORIAL_STANDARDS.md) y [`AGENTS.md`](../AGENTS.md) con la política estricta de 100% inglés en Slack UI y tuteo obligatorio (cero voseo) con traducción semántica en marketing y documentación.

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
