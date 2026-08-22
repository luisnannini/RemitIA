# RemitIA — Receta del video de demo (3:00)

Entrega: **sábado 12:00**. Hoy se prepara todo; mañana solo se filma, se edita y se sube.

---

## Ingredientes

### Fierros
- [ ] Notebook con la demo andando (FastAPI en LAN: `REMITIA_HOST=0.0.0.0`, commit `869a9a7` de Rachid).
- [ ] Android con Chrome: corre la app y escanea con la cámara.
- [ ] Segundo celu: filma las manos, las cajas y la foto al remito.
- [ ] Impresora, tijera, plasticola o cinta de papel.
- [ ] 8 cajas de cartón de tamaños parecidos.
- [ ] Lámpara o buena luz de frente.

### Imprimibles (carpeta `demo-video`)
- [ ] `remito-a.html` → **2 copias** (protagonista + repuesto).
- [ ] `remito-b.html` → **1 copia** (remito "no visto", respaldo).
- [ ] `etiquetas.html` → **2 copias** (8 etiquetas Code 128 + repuestos).
- Imprimir al **100% de escala**, sin "ajustar a página".

### Software que tiene que estar listo (viene del otro chat)
- [ ] FE-05: escaneo por cámara en la pantalla de conteo.
- [ ] Pipeline real de punta a punta: foto → revisión → conteo → reclamo.

---

## Paso a paso — HOY (preparación)

1. Imprimí los 3 archivos con las copias indicadas.
2. Recortá las 8 etiquetas. Pegá una por caja: cara más grande y plana, horizontal, pegamento **solo en los bordes**. Nunca cinta transparente sobre las barras.
3. En el Android activá `chrome://flags/#unsafely-treat-insecure-origin-as-secure` con `http://IP-DE-LA-NOTEBOOK:8000`. Reiniciá Chrome.
4. Probá cada etiqueta con la cámara del Android apenas la pegues.
5. Ensayo completo cronometrado: foto al remito A → revisión → conteo → reclamo. Anotá cuánto tarda el procesamiento.
6. Grabá la voz en off (guion abajo): lugar silencioso, cada línea dos veces.

---

## Paso a paso — MAÑANA (filmación)

Regla: **el flujo de la app se captura con el grabador de pantalla del Android** (activá "mostrar toques"). El segundo celu filma solo lo físico. La edición corta esperas; nunca inventa estado.

1. Android: No molestar activado, brillo al máximo, batería cargada.
2. Filmá primero la **toma de la foto mala** (recepción aparte): foto movida al remito A → pantalla de rechazo.
3. Después una **pasada real completa** con el grabador de pantalla prendido todo el tiempo:
   - Foto al remito A (el segundo celu filma las manos en simultáneo).
   - Revisión: elegí **cromado** en la pregunta del Bilbao; dá de alta la ducha con SKU exacto **`ACC-DUCH-01`**.
   - Conteo: filmá 4 o 5 escaneos vistosos; completá el resto fuera de cámara (mismo estado real).
   - Finalizar → reclamo → resumen → reset.
4. Toma extra: pestaña con google.com **sin internet** al lado de la app con banner READY.

### Conteo guionado (los números tienen que dar esto)

| Caja | Remito dice | Escaneás | Resultado |
|---|---|---|---|
| Cinta teflón | 6 | 6 | completo |
| Bilbao cromado | 4 | 4 | completo |
| Ducha higiénica (`ACC-DUCH-01`) | 2 | 2 | completo |
| Flexible malla 40cm | 12 | **10** | **faltan 2 → reclamo** |
| Sifón botella | 3 | 3 | completo |

Escanear la misma caja N veces vale por N unidades.

---

## Guion de edición (cortes, voz y rótulos)

| # | Tiempo | Qué se ve | Voz en off (inglés) | Rótulo en pantalla |
|---|---|---|---|---|
| T1 | 0:00–0:15 | Google sin internet + app READY | "This is RemitIA. Everything you'll see — OCR, a language model, product matching — runs on this laptop with QVAC by Tether. No cloud. Look: no internet, and it still works." | 100% LOCAL · NO CLOUD |
| T2 | 0:15–0:35 | Manos + remito + foto desde la app | "A truck just arrived at a plumbing supplies store. The clerk photographs the delivery note. The document never leaves the building." | THE DOCUMENT NEVER LEAVES THE WAREHOUSE |
| T3 | 0:35–0:50 | Pantalla Procesando; salto del contador de segundos (edición honesta) | "QVAC reads it locally: OCR, line extraction, then matching against the store's own catalog." | LOCAL OCR + LOCAL LLM |
| T4 | 0:50–1:00 | Foto movida → pantalla de rechazo | "And if the photo is bad? RemitIA refuses to guess. It asks for a new shot — it never invents data." | BAD PHOTO? IT REFUSES TO GUESS |
| T5 | 1:00–1:20 | Revisión; pregunta del Bilbao; toque en "cromado" | "Here's the review. Most lines matched on their own. And when the model is unsure, it says so: one question, two candidates, one tap." | HONEST AI ASKS INSTEAD OF GUESSING |
| T6 | 1:20–1:40 | Alta de la ducha con `ACC-DUCH-01` | "This product isn't in the catalog at all. The model never invents a SKU — the person creates it, in seconds." | THE MODEL NEVER INVENTS A SKU |
| T7 | 1:40–2:05 | Cámara escanea cajas; contador sube | "Now the count. The phone camera scans each box, and the model does no math at all. Deterministic code adds the numbers." | LLMs DON'T COUNT. CODE DOES. |
| T8 | 2:05–2:20 | Modal "¿Ya contaste todo?" → confirmar | "Twelve flexible hoses expected. Ten scanned. The clerk confirms — the decision stays human." | EXPECTED 12 · COUNTED 10 |
| T9 | 2:20–2:45 | Reclamo con tabla de hechos, scroll lento | "Before the truck leaves, the claim is already written — grounded on the document, the scans, and the differences. Every number comes from code, not from the model." | GROUNDED CLAIM · READY BEFORE THE TRUCK LEAVES |
| T10 | 2:45–3:00 | Resumen + sello QVAC + reset | "What the AI did, what code did, what the person decided — RemitIA keeps that line visible. Local, honest, and ready for the next truck." | PROCESSED LOCALLY WITH QVAC · NO CLOUD |

---

## Paso a paso — MAÑANA (edición y entrega)

1. Ensamblá los cortes en el orden de la tabla. Exportá 16:9, 1080p; las capturas verticales van centradas.
2. Pegá la voz en off y los rótulos de cada corte.
3. Mirá el video completo una vez: ¿dura 3:00 o menos? ¿Se entiende sin audio?
4. Exportá y subí la submission. **Buffer de 30 minutos antes de las 12:00: intocable.**

## Regla de oro

El video edita esperas, **nunca falsifica una capacidad**. Todo lo que se ve en pantalla pasó de verdad en la notebook.
