# Mister M — v0.6 "Beat 'em up de los 90"

Juego web (Canvas 2D, ES modules, sin dependencias de ejecución). Mobile-first, pixel art, integer scaling.

## Ejecutar
```bash
python3 -m http.server 8000 --directory dist   # abrir http://localhost:8000 (usar HTTP, no file://)
npm test                                        # 20 pruebas (motor + entrada)
```
Desde Android en la misma red: http://IP-DE-TU-PC:8000

## Controles
Táctil: arrastrar en la mitad izquierda (joystick flotante) · GOLPE (tocar ×3 = combo, mantener = repetir) · SALTO (+GOLPE en el aire) · caminar contra un enemigo = AGARRE (GOLPE rodillazo, SALTO arrojar) · ESQUIVA · ESPECIAL.
Teclado: WASD/flechas · J golpe · K/Espacio salto · U/Shift esquiva · L especial · P/Esc pausa.

## Jugar online (GitHub Pages)
Al hacer push a `main`, el workflow `.github/workflows/pages.yml` corre las pruebas y publica `dist/`.
Activalo una vez en el repo: Settings → Pages → Source: **GitHub Actions**. La URL queda `https://<usuario>.github.io/<repo>/`.

## Regenerar sprites
`python3 tools/buildSprites.py <carpeta segments.zip> <carpeta segments (1).zip> dist/assets/sprites tools/sheets` (los recortes originales del héroe no están en el repo; las hojas pintadas de Trabajador, Militante y Magnate sí, en `tools/sheets`).
Fuentes: Press Start 2P y Silkscreen (OFL, licencias en dist/fonts).
