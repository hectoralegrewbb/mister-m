# Arquitectura 0.6
Módulos ES sin dependencias. La simulación no importa presentación; se comunica por eventos (`drainEvents`).
- `config.js` datos y tuning · `util.js` clamp/rng/emit
- Simulación: `engine.js` (API: createGame, setView, selectRoute, command, update, drainEvents) → `player.js`, `enemies.js` (director), `combat.js` (daño), `props.js` (cajas/items), `world.js` (cámara, encuentros, capítulos, rango)
- Presentación: `render.js`, `scenery.js` (capas procedurales prerenderizadas), `sprites.js`+`poses.js` (atlas y mapeo estado→frame), `fx.js`, `audio.js`, `ui.js` (DOM), `input.js`, `store.js`
- `main.js` compone: boot, escala entera, loop, observadores (fx/audio/háptica/ui).
Escala: px de dispositivo enteros por px de juego (`fit()`); el mundo se mide en px internos, carril de profundidad = 64.
