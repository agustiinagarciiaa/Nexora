# Fotografías de NEXORA

El sistema no guarda imágenes en la base de datos. La portada busca estos archivos y,
si no existen, muestra una composición abstracta en lilas (no hay fotos de relleno).

| Archivo | Uso | Recomendación |
|---|---|---|
| `hero.png` | Portada. Se superpone al título gigante | PNG/WebP **con fondo transparente** (recorte), vertical ~ 4:5 |
| `espacio.jpg` | Sección "Un espacio para vos." | Vertical, luz suave, detalles lilas |
| `bienestar.jpg` | Sección "Cuidarte también es parte de tu esencia." | Horizontal o cuadrada |
| `categorias/<slug>.jpg` | Mosaico de categorías | `<slug>` = nombre de la categoría sin tildes, en minúsculas y con guiones. Ej.: "Pestañas" → `pestanas.jpg`; "Peluquería y tratamientos capilares" → `peluqueria-y-tratamientos-capilares.jpg` |

Texto alternativo: está en `public/app.js` (objeto `FOTOS`). Ajustalo para describir la foto real que subas.
Usá imágenes propias o con licencia, optimizadas (< 300 KB cada una).
