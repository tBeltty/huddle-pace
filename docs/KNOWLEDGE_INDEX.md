# HuddlePace — Master Knowledge & Skills Index

Este documento centraliza el mapa de navegación completo a todos los recursos de conocimiento, guías normativas, perfiles de marca y habilidades (`skills`) disponibles en el repositorio de **HuddlePace**.

---

## 🧭 1. Suite de Skills (`.agents/skills/`)

HuddlePace cuenta con 10 habilidades especializadas para redacción editorial, control de calidad anti-IA, arquitectura de contenidos y distribución de apps en Slack.

| Habilidad | Archivo Principal | Referencias y Plantillas | Propósito y Activación |
| :--- | :--- | :--- | :--- |
| **`no-ai-slop`** | [`SKILL.md`](file:///Users/jhonatan/Documents/huddle-pace/.agents/skills/no-ai-slop/SKILL.md) | — | **Obligatorio para toda copia visible**. Erradica contrastes binarios (*"no es X, es Y"*), aperturas de carraspeo, listas escolares y revelaciones con dos puntos. |
| **`text-humanizer`** | [`SKILL.md`](file:///Users/jhonatan/Documents/huddle-pace/.agents/skills/text-humanizer/SKILL.md) | — | Reescribe textos sintéticos en prosa humana natural. Calibra variación de longitud oracional (*burstiness*), protege datos inmutables y busca legibilidad Flesch 60–70. |
| **`copywriting`** | [`SKILL.md`](file:///Users/jhonatan/Documents/huddle-pace/.agents/skills/copywriting/SKILL.md) | • [`copy-frameworks.md`](file:///Users/jhonatan/Documents/huddle-pace/.agents/skills/copywriting/references/copy-frameworks.md)<br>• [`natural-transitions.md`](file:///Users/jhonatan/Documents/huddle-pace/.agents/skills/copywriting/references/natural-transitions.md) | Redacción y reescritura de páginas de inicio, landing pages, secciones de producto y llamadas a la acción (CTA). |
| **`copy-editing`** | [`SKILL.md`](file:///Users/jhonatan/Documents/huddle-pace/.agents/skills/copy-editing/SKILL.md) | • [`plain-english-alternatives.md`](file:///Users/jhonatan/Documents/huddle-pace/.agents/skills/copy-editing/references/plain-english-alternatives.md) | Edición sistemática de copia mediante pases enfocados en claridad, ritmo y reducción de fricción verbal. |
| **`proofreading`** | [`SKILL.md`](file:///Users/jhonatan/Documents/huddle-pace/.agents/skills/proofreading/SKILL.md) | — | Barrido mecánico de ortografía, puntuación y gramática en español e inglés sin reescribir la estructura del mensaje. |
| **`paragraph-structure`** | [`SKILL.md`](file:///Users/jhonatan/Documents/huddle-pace/.agents/skills/paragraph-structure/SKILL.md) | — | Diagnóstico y división de límites de párrafo para evitar bloques densos y optimizar la escaneabilidad visual. |
| **`ogilvy`** | [`SKILL.md`](file:///Users/jhonatan/Documents/huddle-pace/.agents/skills/ogilvy/SKILL.md) | — | Principios publicitarios de David Ogilvy orientados a ventas: posicionamiento claro, promesas verificables y lógica visual. |
| **`content-strategy`** | [`SKILL.md`](file:///Users/jhonatan/Documents/huddle-pace/.agents/skills/content-strategy/SKILL.md) | — | Planificación de contenidos, clusters temáticos y calendario editorial para atracción orgánica. |
| **`competitor-alternatives`** | [`SKILL.md`](file:///Users/jhonatan/Documents/huddle-pace/.agents/skills/competitor-alternatives/SKILL.md) | • [`content-architecture.md`](file:///Users/jhonatan/Documents/huddle-pace/.agents/skills/competitor-alternatives/references/content-architecture.md)<br>• [`templates.md`](file:///Users/jhonatan/Documents/huddle-pace/.agents/skills/competitor-alternatives/references/templates.md) | Creación de páginas de comparativa de competidores (*vs pages* y *alternatives*) para SEO y habilitación de ventas. |
| **`slack-app-distribution`** | [`SKILL.md`](file:///Users/jhonatan/Documents/huddle-pace/.agents/skills/slack-app-distribution/SKILL.md) | — | Gestión del ciclo de vida del manifest de Slack, flujos OAuth 2.0 multi-workspace, triggers de reinstalación y despliegue. |

---

## 🏛️ 2. Manuales Centrales de Operación

Documentos raíz que gobiernan la ejecución de agentes, la arquitectura del bot y los estándares del proyecto.

* **[Central Agentic Guidelines (`AGENTS.md`)](file:///Users/jhonatan/Documents/huddle-pace/AGENTS.md)**  
  Manual de operaciones obligatorio para agentes autónomos. Detalla invariantes de captura de Huddles, regla de hora exacta y zona única, límites de SSH en VPS, flujo CI/CD y políticas de release.
* **[Technical Architecture & Setup (`README.md`)](file:///Users/jhonatan/Documents/huddle-pace/README.md)**  
  Guía maestra de configuración técnica: transporte dual (Socket Mode vs Native HTTP OAuth), esquema Prisma con SQLite WAL, comandos de Slack y despliegue con systemd/PM2.
* **[Historial de Versiones (`CHANGELOG.md`)](file:///Users/jhonatan/Documents/huddle-pace/CHANGELOG.md)**  
  Registro atómico de releases bajo el estándar [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/) y SemVer.
* **[Directivas de Seguridad (`SECURITY.md`)](file:///Users/jhonatan/Documents/huddle-pace/SECURITY.md)**  
  Aislamiento estricto de secretos, rotación de tokens y políticas de reporte de vulnerabilidades.

---

## 📦 3. Producto, Mercado y Tutoriales (`docs/`)

Fuentes de verdad sobre capacidades funcionales, segmentos de usuarios e instrucciones paso a paso.

* **[Product Capabilities & Changes Log](file:///Users/jhonatan/Documents/huddle-pace/docs/PRODUCT_CAPABILITIES_LOG.md)**  
  Inventario maestro de todo lo que HuddlePace hace y registro cronológico inverso de modificaciones funcionales.
* **[Target Niches & Market Personas](file:///Users/jhonatan/Documents/huddle-pace/docs/TARGET_NICHES.md)**  
  Segmentos de mercado clave (Scrum Masters, Tech Leads, Agencias Remotas), dolores de reuniones, modelos de monetización y estrategia GTM.
* **[Pace Guide for Tutorials & Support](file:///Users/jhonatan/Documents/huddle-pace/docs/guides/PACE_GUIDE.md)**  
  Referencia verificada de cada forma de crear, iniciar, correr y reprogramar un pace (vía botones de App Home o comando `/pace`), con cadenas exactas de la interfaz y lista de claims prohibidos.
* **[Knowledge Base & Help Articles CLI](file:///Users/jhonatan/Documents/huddle-pace/docs/guides/HELP_ARTICLES_CLI.md)**  
  Integración con el widget Beacon y la API central de base de conocimientos (`capylite.co/api`) bajo el App ID `07dc5cf9-2bc9-4f85-a7fa-e9eb76fe4ff1`.
* **[Admin Dashboard & Support Inbox Handoff](file:///Users/jhonatan/Documents/huddle-pace/docs/handoffs/ADMIN_DASHBOARD_SUPPORT_INBOX.md)**  
  Especificación de integración para formulario de contacto público y recepción de correos en el dashboard CRM.

---

## 🎨 4. Identidad de Marca y Mascota

Definición visual y narrativa del universo HuddlePace.

* **[Brand Identity & System Guide](file:///Users/jhonatan/Documents/huddle-pace/docs/BRAND.md)**  
  Paleta cromática oficial (*Aerospace Telemetry*), tipografía Inter/JetBrains Mono, fórmulas de prompts para arte y tokens hex canónicos.
* **[Perfil de Personaje: Vector — The Pacer Falcon](file:///Users/jhonatan/Documents/huddle-pace/docs/VECTOR_CHARACTER_PROFILE.md)**  
  Lore del halcón peregrino Vector en el *Vibecoder Universe*, gadgets visuales (HUD visor ámbar, flight vest, headset) y rol como controlador de cadencia.
* **[Dossier de Marketing y Marca (`marketing/MARKETING.md`)](file:///Users/jhonatan/Documents/huddle-pace/marketing/MARKETING.md)**  
  Documento local y privado con hojas de personaje en alta resolución, mockups y material de lanzamiento para el Slack App Directory.

---

## 🛡️ 5. Guías Normativas de Ingeniería (`docs/guidelines/`)

Reglas de oro que definen la calidad técnica y arquitectónica del código.

* **[Coding Standards & Architecture](file:///Users/jhonatan/Documents/huddle-pace/docs/guidelines/CODING.md)**  
  Estructura de módulos en TypeScript, inmutabilidad de datos, separación de responsabilidades y manejo resiliente de errores.
* **[UI, Block Kit & Styling](file:///Users/jhonatan/Documents/huddle-pace/docs/guidelines/UI_SLACK_BLOCKS_CSS.md)**  
  Jerarquía visual en Block Kit, renderizado de barras de progreso monoespaciadas y constructores libres de reloj (*clock-free UI*).
* **[Editorial Standards & Writing Hygiene](file:///Users/jhonatan/Documents/huddle-pace/docs/guidelines/EDITORIAL_STANDARDS.md)**  
  Estándares de cadencia humana directa, erradicación de clichés sintéticos y lenguaje estricto 100% inglés dentro de Slack.
* **[Repository & Git Hygiene](file:///Users/jhonatan/Documents/huddle-pace/docs/guidelines/REPOSITORY_HYGIENE.md)**  
  Commits convencionales, estándares de nombres en CI y aislamiento de secretos.
* **[Infrastructure & Deployment](file:///Users/jhonatan/Documents/huddle-pace/docs/guidelines/INFRASTRUCTURE.md)**  
  Topología de VPS, gestión de daemons con systemd/PM2, durabilidad de SQLite WAL y despliegue continuo vía GitHub Actions.
* **[Security & Token Standards](file:///Users/jhonatan/Documents/huddle-pace/docs/guidelines/SECURITY.md)**  
  Cifrado de tokens de bots, scopes mínimos necesarios de Slack y validación con esquemas Zod en tiempo de ejecución.
* **[Dependency Pins](file:///Users/jhonatan/Documents/huddle-pace/docs/guidelines/DEPENDENCY_PINS.md)**  
  Registro razonado de dependencias fijadas y justificación técnica de versiones.
* **[Definition of Done (DoD)](file:///Users/jhonatan/Documents/huddle-pace/docs/guidelines/DEFINITION_OF_DONE.md)**  
  Criterios no negociables para considerar cualquier tarea técnica o funcional como completada.
* **[Release Process & Versioning Standards](file:///Users/jhonatan/Documents/huddle-pace/docs/guidelines/RELEASE_PROCESS.md)**  
  Protocolo de versionado SemVer, actualización atómica de changelog, generación de tags y publicación automatizada de GitHub Releases.

---

## ✍️ 6. Playbooks Editoriales y Anti-IA

* **[Copywriting & Editorial Playbook](file:///Users/jhonatan/Documents/huddle-pace/docs/marketing/COPYWRITING_PLAYBOOK.md)**  
  Pipeline obligatorio de 14 pasos para redacción de contenido largo, páginas de destino y artículos técnicos. Asegura inmunidad frente a detectores de IA (GPTZero, Copyleaks) mediante calibración de *burstiness* y anclaje estricto en el código.
