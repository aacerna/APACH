# Registro de decisiones de arquitectura (ADR ligero)

| Fecha | Decisión | Razón | Estado |
|---|---|---|---|
| 2026-11-16 | Nuevo proyecto APACH, sin código previo obligatorio | Solicitud de creación desde cero | Confirmado |
| 2026-11-16 | React/TS + FastAPI + PostgreSQL, Docker local | Stack editable, demostrable y exportable | Confirmado |
| 2026-11-16 | Revisión DOCX determinista, sin IA generativa | Evitar tokens y garantizar evidencia | Confirmado |
| 2026-11-16 | Guía APA ECC no implementada hasta recibir fuente | Evitar inventar reglas | Confirmado |
| 2026-11-16 | Plantillas Google Drive por URL administrable | URLs disponibles aún no entregadas | Confirmado |

Añadir nuevas decisiones reales al trabajar, especialmente desviaciones respecto de la documentación o dependencias elegidas. No borrar decisiones anteriores: anotar reemplazos.
| 2026-11-16 | Formateador APA único en TypeScript (`packages/shared/src/references`), ejecutado en el navegador | El generador debe funcionar offline; duplicar reglas en Python violaría «un solo origen de verdad». Se omite `POST /references/format`; el backend persiste entrada estructurada + segmentos validados (`PUT /references/{client_id}`) | Confirmado |
| 2026-11-16 | Fichas «Aprende APA» en `packages/shared/content/guides.json`, leídas por API y empaquetadas en el frontend | Misma fuente para `/apa/guides/{slug}` y para uso offline; pytest verifica que todo `guide_slug` de regla exista | Confirmado |
| 2026-11-16 | Sesión en servidor (tabla `user_sessions`, token hasheado) + cookie HttpOnly SameSite=Lax + token CSRF por sesión en cabecera `X-CSRF-Token` | Revocable al desactivar usuario o restablecer contraseña; sin JWT en almacenamiento del navegador | Confirmado |
| 2026-11-16 | Objetos ajenos responden 404 (no 403); falta de rol responde 403; sin sesión 401 | No revelar existencia de documentos de otros (IDOR) | Confirmado |
| 2026-11-16 | Protección de fuerza bruta persistente: 5 fallos / 15 min por correo (tabla `login_attempts`) | Sobrevive reinicios; sin servicios externos | Confirmado |
| 2026-11-16 | Sin SMTP: el ADMIN genera enlaces de activación/restablecimiento; solo se muestran en `development/demo` (`APACH_EXPOSE_DEV_LINKS`) | El spec prohíbe afirmar envíos de correo | Confirmado |
| 2026-11-16 | Análisis síncrono en `POST /documents/{id}/analyze`; cada análisis crea una corrida nueva vinculada a `rule_set_version` | DOCX ≤10 MB se analizan en <1 s; simplifica la demo. Si crece el volumen, mover a cola de trabajos | Confirmado |
| 2026-11-16 | Severidad: ERROR solo con `CHECKED`; el motor degrada automáticamente cualquier ERROR no verificado. APA-08/09 (citas↔referencias) nunca son ERROR | Regla «no clasificar incertidumbre como error seguro» | Confirmado |
| 2026-11-16 | Convención de idioma del generador: «&» entre autores en la lista de referencias; «y» en citas narrativas y parentéticas; «s. f.», «En», «(2.ª ed.)», «[Video]», fechas «(2024, 12 de febrero)» | Práctica habitual de adaptaciones de APA 7 en español. **Revisar cuando llegue la guía ECC** (puede exigir «y» también en la lista) | Provisional |
| 2026-11-16 | El generador no convierte títulos a tipo oración; solo advierte | Una conversión automática dañaría nombres propios (no inventar ni alterar datos) | Confirmado |
| 2026-11-16 | Guía, catálogo y generador accesibles sin sesión; guardar en biblioteca requiere sesión | Contenido educativo no sensible; permite uso offline y demostración. Reversible protegiendo las rutas en `App.tsx` | Confirmado |
| 2026-11-16 | Biblioteca offline en IndexedDB por usuario (`apach-library-<id>`), sync last-write-wins con lápidas; al cerrar sesión con todo sincronizado se borra la base local; sin red se conserva oculta (se elimina la «pista» de sesión) | Requisito de privacidad en dispositivos compartidos (09-PWA-OFFLINE) | Confirmado |
| 2026-11-16 | Service worker: precaché de assets; `/api/*` NetworkOnly; actualización con aviso al usuario | No cachear respuestas autenticadas | Confirmado |
| 2026-11-16 | Iconos PWA provisionales con la leyenda «PROVISIONAL»; Pacho como marcador neutro | No improvisar identidad institucional | Confirmado |
| 2026-11-16 | Secreto de build opcional `extra_ca` (Compose) para CA de proxies con inspección TLS; archivo vacío por defecto | El entorno de desarrollo en la nube lo necesitó; útil en redes institucionales. No altera imágenes cuando está vacío | Confirmado |
| 2026-11-16 | Dominio ficticio de demo `demo.example.edu` | `.local`/`.test` son rechazados por el validador de correo | Confirmado |
