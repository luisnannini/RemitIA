# RemitIA — Secuencia de clips (esqueleto de edición)

Este archivo es la lista de montaje: los 16 clips del video final, en orden, con nombre de archivo fijo.
El texto exacto de cada voz en off (VO) y de cada rótulo está en `guion-maestro.md`. Acá solo se referencian.

## Carpeta de edición

Creá esta carpeta fuera del repo (por ejemplo `D:\demo-video-edit\`):

```
demo-video-edit/
├─ video/     ← los 16 clips, con los nombres exactos de la tabla
├─ audio/
│  ├─ vo/     ← vo-01.wav … vo-14.wav (un archivo por bloque de voz)
│  └─ musica.mp3
└─ export/    ← el corte final
```

## Los 16 clips

| # | Archivo | Tiempo | Fuente | Qué se ve | Audio | ¿Cuándo? |
|---|---|---|---|---|---|---|
| 01 | `01-stock-camion.mp4` | 0:00–0:08 | Stock | Camión de reparto llega a un local | VO-01 + música sube | **HOY** |
| 02 | `02-stock-descarga.mp4` | 0:08–0:16 | Stock | Descarga de cajas al carrito | VO-02 | **HOY** |
| 03 | `03-stock-conteo.mp4` | 0:16–0:26 | Stock | Empleado cuenta cajas con papel en mano | VO-03 | **HOY** |
| 04 | `04-placa-titulo.mp4` | 0:26–0:32 | Placa (grabar `placa-titulo.html`) | Logo + tagline | Golpe musical, sin voz | **HOY** |
| 05 | `05-t1-sin-internet.mp4` | 0:32–0:42 | Real (T1) | Google sin internet + app READY | VO-04 | Mañana |
| 06 | `06-t2-foto-remito.mp4` | 0:42–0:56 | Real (T2) | Manos + remito + foto desde la app | VO-05 | Mañana |
| 07 | `07-t3-procesando.mp4` | 0:56–1:06 | Real (T3) | Pantalla Procesando, salto de contador | VO-06 | Mañana |
| 08 | `08-t4-foto-mala.mp4` | 1:06–1:16 | Real (T4) | Foto movida → rechazo | VO-07 | Mañana |
| 09 | `09-t5-revision.mp4` | 1:16–1:34 | Real (T5) | Pregunta del Bilbao → toque en "cromado" | VO-08 | Mañana |
| 10 | `10-t6-alta-sku.mp4` | 1:34–1:50 | Real (T6) | Alta de la ducha `ACC-DUCH-01` | VO-09 | Mañana |
| 11 | `11-t7-escaneo.mp4` | 1:50–2:12 | Real (T7) | Cámara escanea las 3 cajas iguales; contador sube | VO-10 | Mañana |
| 12 | `12-t8-confirmar.mp4` | 2:12–2:24 | Real (T8) | Modal "¿Ya contaste todo?" → confirmar | VO-11 | Mañana |
| 13 | `13-t9-reclamo.mp4` | 2:24–2:44 | Real (T9) | Reclamo con tabla de hechos, scroll lento | VO-12 | Mañana |
| 14 | `14-t10-resumen.mp4` | 2:44–2:52 | Real (T10) | Resumen + sello QVAC | VO-13 | Mañana |
| 15 | `15-stock-camion-se-va.mp4` | 2:52–2:57 | Stock | El camión se va | VO-14 | **HOY** |
| 16 | `16-placa-final.mp4` | 2:57–3:00 | Placa (grabar `placa-final.html`) | Equipo, track, repo | Música cierra | **HOY** |

## Método: premontaje hoy, relleno mañana

La técnica es premontar el timeline completo HOY con huecos, y mañana solo reemplazar los huecos.

### Hoy

1. Creá la carpeta de edición con la estructura de arriba.
2. Grabá la voz en off completa (texto en `guion-maestro.md`). Cada línea dos veces. Cortá en 14 archivos: `vo-01` a `vo-14`.
3. Bajá los 4 clips de stock (búsquedas en `guion-maestro.md`). Renombralos: `01`, `02`, `03`, `15`.
4. Bajá la música (Mixkit o Pixabay Music). Guardala como `musica.mp3`.
5. Grabá las 2 placas: abrí `placa-titulo.html` y `placa-final.html` en Chrome, F11, clic para iniciar la animación, grabá 8 segundos con OBS o la barra de juegos de Windows (Win+Alt+R). Recortá y renombrá: `04`, `16`.
6. Premontá: proyecto 1920×1080. Poné la música y los 14 bloques de voz en sus tiempos. Colocá los clips 01–04, 15 y 16. En cada hueco T1–T10 poné un fondo negro con el nombre del clip como texto.
7. Reproducí el premontaje entero. El video ya funciona de punta a punta, con 10 huecos rotulados.

### Mañana

1. Filmá según la receta. Volcá las capturas a `video/`.
2. Recortá cada toma y renombrala `05` a `14`.
3. Reemplazá los huecos negros uno por uno. El tiempo de cada hueco ya está fijado por la voz.
4. Agregá los rótulos como texto del editor (lista en `guion-maestro.md`).
5. Mirá el corte completo una vez. Exportá 1080p H.264 a `export/`.

## Regla del premontaje

La voz manda. Si una toma real dura más que su hueco, se recorta la toma, no se estira el hueco.
