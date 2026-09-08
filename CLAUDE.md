# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Qué es esto

Tetris clásico en JavaScript vanilla (ES6+), HTML5 Canvas y CSS puro. Sin `package.json`, sin build, sin dependencias, sin framework. Todo el proyecto son 3 archivos: `index.html`, `style.css`, `game.js`.

## Comandos

No hay build, lint ni tests (no hay `package.json`). Para probar cambios, sirve el directorio y abre el navegador:

```bash
python3 -m http.server 8000    # o: npx serve .
```

o simplemente abre `index.html` directamente en el navegador. La verificación es manual: jugar y comprobar el comportamiento en la consola del navegador.

## Arquitectura

Toda la lógica vive en `game.js` (un solo archivo, sin módulos). Piezas clave:

- **Estado global**: variables de módulo (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval`, etc.) mutadas directamente por las funciones del juego. No hay clases ni store centralizado.
- **Tablero**: matriz `ROWS × COLS` (20×10); cada celda es `0` (vacía) o un índice 1–7 que indexa `COLORS` para identificar a qué pieza pertenece el bloque fijado.
- **Piezas**: definidas como matrices cuadradas en `PIECES`. La rotación (`rotateCW`) transpone + invierte filas; no usa matrices de rotación con estados precomputados (sin SRS).
- **Wall kicks** (`tryRotate`): tras rotar, prueba desplazamientos `[0, -1, 1, -2, 2]` en X hasta encontrar una posición sin colisión, o descarta el giro.
- **Colisión** (`collide`): única función que valida límites del tablero y solapamiento con bloques fijados; todo movimiento (mover, rotar, caer, drop) pasa por aquí.
- **Bucle de juego** (`loop`): basado en `requestAnimationFrame`, acumula delta time y baja la pieza cuando supera `dropInterval`; `pausa`/`gameOver` cortan el bucle con `cancelAnimationFrame`.
- **Fijado de pieza** (`lockPiece` → `merge` + `clearLines` + `spawn`): al no poder bajar más, se fusiona con el tablero, se limpian líneas completas, y se genera la siguiente pieza. Si la nueva pieza colisiona al aparecer (`spawn`), termina el juego (`endGame`).
- **Puntuación/nivel**: tabla clásica `LINE_SCORES = [0,100,300,500,800]` multiplicada por nivel; nivel sube cada 10 líneas; velocidad de caída = `max(100, 1000 - (level-1)*90)` ms.
- **Renderizado**: dos canvas (`board` para el tablero+pieza actual+ghost, `next-canvas` para la vista previa), todo dibujado a mano celda por celda con `drawBlock`. El ghost piece se calcula proyectando hacia abajo (`ghostY`) y se dibuja con alpha reducido.

Constantes fáciles de tunear (documentadas en README.md, sección "Personalización"): `COLS`, `ROWS`, `BLOCK`, `COLORS`, `LINE_SCORES`, `dropInterval`. Si se cambian `COLS`/`ROWS`/`BLOCK`, hay que ajustar también `width`/`height` del `<canvas id="board">` en `index.html` para que coincidan (`COLS × BLOCK` × `ROWS × BLOCK`).

## CI

`.github/workflows/claude-code-review.yml` ejecuta automáticamente `/code-review:code-review --comment` en cada PR. `.github/workflows/claude.yml` responde a menciones `@claude` en issues/comentarios/reviews.
