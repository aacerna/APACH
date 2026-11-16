# 02 — Identidad visual, experiencia y pantallas

## Paleta de marca
- Terracota `#B2632D`
- Naranja `#EC8022`
- Celeste `#5C9CBA`
- Azul petróleo `#213E46`
- Amarillo suave `#DDDA6F`
Crear tokens CSS con jerarquía cromática, estados accesibles y alto contraste. No usar todos los colores simultáneamente para decoración.

## Principios
APACH es aplicación educativa, **no blog**. Diseño original: acciones claras, lenguaje comprensible, accesibilidad WCAG como objetivo, responsive, breadcrumbs donde correspondan, teclado, etiquetas en inputs, mensajes de error claros y estados vacíos. Mascota Pacho solo cuando exista activo autorizado; componente placeholder neutro, no logo inventado.

## Pantallas
- Login/activación/reset; error 403.
- Dashboard STUDENT: bienvenida y video opcional configurable; cuatro acciones destacadas **Revisar mi documento**, **Crear una referencia**, **Aprender APA**, **Mis trabajos**; accesos a cursos, plantillas, biblioteca.
- Selección de curso → carga DOCX con validación y progreso.
- Resultados: resumen por tipos, filtros, evidencia y ubicación honesta, CTA «Aprender a corregir», acceso a generador cuando procede.
- Generador: selector buscable de fuentes → campos dinámicos → vista previa → copiar/guardar.
- «Explora las referencias APA»: catálogo por categoría, ficha con estructura/ejemplo y CTA al generador si implementado.
- «Aprende APA»: fichas pequeñas con «Qué es / Cómo se aplica / Ejemplo / Errores frecuentes / Cómo corregirlo».
- Panel docente: cursos propios, lista de documentos, revisión y comentarios.
- Panel administrador: CRUD, CSV con previsualización, plantillas, reglas, reportes.

## Interacciones y estados
Loading, vacío, error, éxito, archivo no verificable, caducidad de sesión, sistema offline; confirmación para operaciones destructivas; no botones ficticios. Alumnos sin cursos ven explicación y contacto institucional configurable. Evitar calificar automáticamente trabajo con «nota APA».

## Criterios
Flujos clave navegables en móvil y escritorio, contraste suficiente, no reflujo horizontal, formularios etiquetados, errores por campo, accesibilidad teclado, capturas opcionales de evidencia de pruebas.
