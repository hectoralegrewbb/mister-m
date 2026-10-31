# Cambios
## 0.6.2 — Elenco pintado
Trabajador, Militante y Magnate (jefe global) pasan a usar las hojas pintadas nuevas (`tools/sheets`): recorte por flood fill del fondo blanco, descarte de gotas/polvo/monedas flotantes, mismo pipeline de píxel que el héroe. Caminata propia de 8 frames; ataque con zarpazo (arco) y avance; derribo rotando el frame de reposo. Quedan sin animación de combate propia: golpeado, caído y levantarse reutilizan el frame de reposo.
## 0.6.1 — Botín, tortas, agarre
**Botín** (economía/corrupción): dólar, sobre, bono (+energía), lingote y maletín, con imán al acercarse. Salen de cajas/tachos/carritos y de enemigos hostiles (40 %); los jefes sueltan 3 maletines. Contador U$S en el HUD, fila "BOTÍN" en el resumen y mención en el acto final. La comida (medialuna, mate, choripán, asado) sigue curando.
**Tortas de Excel**: vida y energía del especial son tortas 3D de píxeles (porción perdida "explotada", rastro naranja), ~34×24 px; el jefe/objetivo tiene su torta junto al nombre y cada enemigo herido una mini torta sobre la cabeza.
**Agarre**: caminar contra un enemigo (0,18 s) lo agarra, salvo jefes. GOLPE = rodillazo (el 3.º lo arroja), SALTO = arrojar en la dirección del stick. El arrojado daña y derriba a quien choque. Recibir un golpe te suelta; a los 3 s se zafa.
**Caminata**: las carpetas no traen un ciclo de caminata dedicado; se armó un "guard-walk" con los frames de paso/postura del set a (a-38…44) para inclinación suave del stick y se mantiene la carrera (set b) a inclinación plena. Reemplazable cuando haya un ciclo propio.
## 0.6 — Beat 'em up de los 90
**Arte**: halo blanco de los recortes eliminado (flood por borde), reescalado a grilla de píxel limpia (héroe 74 px), contorno de 1 px, paleta reducida; 11 atlas (≈610 KB, antes 1,4 MB en 40 PNG). Enemigos = palette swaps del héroe + accesorios (casco, gorra, vincha, gorro, mochila), como en los clásicos. Escala entera por píxel de dispositivo (canvas interno ≈300×190–420).
**Carga/menú**: carga real con progreso (fuentes+sprites), mínimo 0,9 s (antes 4,5 s falsos), consejos rotativos, "TOCÁ PARA EMPEZAR" (desbloquea audio), menú sobre escena viva, selección de alianza, cómo jugar, ajustes, récord persistente.
**Controles**: joystick flotante (zona izquierda completa), ancla que sigue al pulgar, 4 botones en arco, modo zurdo, botones on/off, teclado completo.
**Movimiento/combate**: aceleración, combo de 3 golpes con buffer (jab, cruzado, patada que derriba), salto + patada aérea, golpes bajos esquivables saltando, esquiva en 2 ejes, especial giratorio que se carga golpeando, knockdown con vuelo y "strike" contra otros enemigos, guardia (poise) en trabajador y jefes, hit-stop, shake, flashes, onomatopeyas.
**IA**: director con turnos (1 atacante, 2 en la vigilia), telegrafiado naranja, carga del jefe, refuerzos al 50 % de vida, ayuda adaptativa tras caer.
**Entorno**: 4 escenarios con parallax (plaza, barrio, vigilia, casa), pantalla scroll con bloqueo y "GO", cajas/tachos/carritos rompibles con medialuna/mate/choripán/asado, palomas que huyen, neón, velas, hilos de marioneta en el jefe.
**Retención**: capítulos con rango S–C y resumen, continues (3 créditos, reinicio de capítulo), tutorial contextual de primera partida, música chiptune + SFX sintetizados.
**Contenido**: los jefes pasan a ser arquetipos ficticios (El Titiritero / El Magnate) en lugar de personas reales; etiquetas "KUKA"/"ZURDO" → "MILITANTE"/"AGITADOR".
Pendiente: probar en Android físico (vibración, multitáctil, rendimiento), balance con jugadores, arte propio para enemigos.
