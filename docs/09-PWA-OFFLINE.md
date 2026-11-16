# 09 — PWA y operaciones offline

## Instalable
Manifest con nombre APACH/Apapacho, iconos provisionales claramente marcados, start_url, display, theme_color; service worker y política de actualización. Documentar que `localhost` funciona como contexto seguro en navegadores compatibles, pero una PWA accesible desde otros dispositivos de la LAN puede necesitar HTTPS real/certificados confiables.

## Offline real
Debe funcionar sin red, una vez cargados los recursos necesarios:
1. Centro Aprende APA (contenido empaquetado o cacheado).
2. Generador de citas/referencias con lógica en navegador.
3. Referencias locales en IndexedDB, respetando identidad de sesión y privacidad.
Mostrar disponibilidad y almacenamiento local, no prometer sincronización cuando backend inaccesible.

## Requieren backend local
Login, roles, consulta/sincronización de cursos, carga y análisis, comentarios docentes, administración. Google Drive requiere conexión a internet.

## Cache y seguridad
Nunca almacenar sin criterio documentos privados, tokens o respuestas sensibles en caché compartida. Evitar cachear endpoints autenticados. Estrategia precache para assets/guía y network-only para API protegida. Al cerrar sesión, impedir que otro usuario vea referencias de la cuenta anterior sin autenticación, incluso offline.

## Aceptación
Tras cargar PWA, desactivar red y abrir guía/generador; generar y conservar referencia local. La app indica honestamente que el análisis de documentos requiere servidor.
