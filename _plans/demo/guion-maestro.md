# RemitIA — Guion maestro del video (3:00, 16:9)

Este documento es el guion maestro: el plan de edición completo del video final.
Reemplaza la tabla "Guion de edición" de `receta-video-demo.md`.
Los pasos de preparación y filmación de la receta siguen vigentes. Las tomas T1–T10 se filman igual; solo cambia el minutado.

El video mezcla 3 fuentes:

- **Tomas reales** (T1–T10): grabador de pantalla del Android + segundo celu. Son la única fuente donde aparece la app.
- **B-roll IA** (IA-1 a IA-4): clips de contexto generados con texto-a-video (Google Veo u otro). Ilustran el mundo del problema. Nunca muestran la app ni una pantalla.
- **Placas** (PL-1, PL-2): título y cierre, hechas en el editor.

## Regla de oro, extendida

El b-roll IA ilustra el contexto: camiones, cajas, un local. **Nunca ilustra el producto.**
Todo lo que se ve de RemitIA es captura real de la notebook y del Android.
La edición corta esperas; nunca inventa estado ni capacidad.

---

## Estructura en 4 actos

| Acto | Tiempo | Contenido | Fuente |
|---|---|---|---|
| 1. Problema | 0:00–0:26 | Camión, cajas, conteo a mano con remito en papel | B-roll IA |
| 2. Solución | 0:26–0:42 | Placa RemitIA + prueba sin internet | Placa + real |
| 3. Demo | 0:42–2:52 | Foto → revisión → conteo → reclamo | Real |
| 4. Cierre | 2:52–3:00 | El camión se va; placa final | B-roll IA + placa |

---

## Línea de tiempo completa

| # | Tiempo | Fuente | Qué se ve | Voz en off (inglés) | Rótulo |
|---|---|---|---|---|---|
| IA-1 | 0:00–0:08 | Veo | Camión de reparto llega a un local de sanitarios | "Every morning, trucks like this one deliver goods to thousands of small stores." | — |
| IA-2 | 0:08–0:16 | Veo | Descarga de cajas al carrito, vereda del local | "What arrives is a paper delivery note — and a pile of boxes. Counting is manual, and mistakes surface days later, when the truck is long gone and the claim is lost." | — |
| IA-3 | 0:16–0:26 | Veo | Empleado apurado cuenta cajas con un remito en la mano | "Cloud AI could help. But these documents are the business — they shouldn't leave the building." | THE DOCUMENTS ARE THE BUSINESS |
| PL-1 | 0:26–0:32 | Placa | Logo RemitIA + tagline | (golpe musical, sin voz) | RemitIA · LOCAL AI FOR GOODS RECEPTION |
| T1 | 0:32–0:42 | Real | Google sin internet + app READY | "This is RemitIA. OCR, a language model, product matching — everything runs on this laptop with QVAC by Tether. No internet, and it still works." | 100% LOCAL · NO CLOUD |
| T2 | 0:42–0:56 | Real | Manos + remito + foto desde la app | "The clerk photographs the delivery note. The document never leaves the building." | THE DOCUMENT NEVER LEAVES THE WAREHOUSE |
| T3 | 0:56–1:06 | Real | Pantalla Procesando; salto del contador (edición honesta) | "QVAC reads it locally: OCR, line extraction, then matching against the store's own catalog." | LOCAL OCR + LOCAL LLM |
| T4 | 1:06–1:16 | Real | Foto movida → pantalla de rechazo | "And if the photo is bad? RemitIA refuses to guess. It asks for a new shot — it never invents data." | BAD PHOTO? IT REFUSES TO GUESS |
| T5 | 1:16–1:34 | Real | Revisión; pregunta del Bilbao; toque en "cromado" | "Most lines matched on their own. And when the model is unsure, it says so: one question, two candidates, one tap." | HONEST AI ASKS INSTEAD OF GUESSING |
| T6 | 1:34–1:50 | Real | Alta de la ducha con `ACC-DUCH-01` | "This product isn't in the catalog at all. The model never invents a SKU — the person creates it, in seconds." | THE MODEL NEVER INVENTS A SKU |
| T7 | 1:50–2:12 | Real | Cámara escanea cajas; contador sube | "Now the count. The phone camera scans each box, and the model does no math at all. Deterministic code adds the numbers." | LLMs DON'T COUNT. CODE DOES. |
| T8 | 2:12–2:24 | Real | Modal "¿Ya contaste todo?" → confirmar | "Twelve flexible hoses expected. Ten scanned. The clerk confirms — the decision stays human." | EXPECTED 12 · COUNTED 10 |
| T9 | 2:24–2:44 | Real | Reclamo con tabla de hechos, scroll lento | "Before the truck leaves, the claim is already written — grounded on the document, the scans, and the differences. Every number comes from code, not from the model." | GROUNDED CLAIM · READY BEFORE THE TRUCK LEAVES |
| T10 | 2:44–2:52 | Real | Resumen + sello QVAC | "What the AI did, what code did, what the person decided — RemitIA keeps that line visible." | PROCESSED LOCALLY WITH QVAC |
| IA-4 | 2:52–2:57 | Veo | El camión se va; el empleado queda tranquilo junto a las cajas | "Local, honest, and ready for the next truck." | — |
| PL-2 | 2:57–3:00 | Placa | Placa final: equipo, track, repo | (música cierra) | RemitIA · TEAM LUIS / RACHID / NAHUEL · QVAC BY TETHER TRACK |

La voz en off manda el ritmo. Grabá primero el audio completo. Después cortá la imagen sobre la voz, no al revés.

---

## Prompts para el b-roll IA (Google Veo u otro)

Reglas para los 4 prompts:

- Pedí clips de 8 segundos, 16:9.
- Generá 2 variantes por prompt. Elegí la mejor.
- Nunca pidas texto legible ni logos: la IA los garabatea y arruina el plano.
- Nada de pantallas, celulares ni apps en el b-roll: eso es territorio de las tomas reales.
- Emparejá el color de los 4 clips en la edición para que parezcan una sola cámara.

**IA-1 — llegada:**
"Cinematic 16:9 shot, morning light: a small white delivery truck pulls up and parks in front of a modest plumbing-supplies storefront on a quiet South American street. Handheld documentary feel, shallow depth of field, natural colors. No readable text, no logos, no close-up faces."

**IA-2 — descarga:**
"Cinematic 16:9 medium shot: a delivery worker unloads cardboard boxes from the back of a small truck and stacks them on a hand cart on the sidewalk of a small hardware store. Morning light, handheld documentary style. No readable text, no logos."

**IA-3 — conteo a mano:**
"Cinematic 16:9 shot inside a small plumbing-supplies store: a store clerk holds a paper document and counts stacked cardboard boxes, slightly rushed. Warm practical lighting, handheld documentary style, shallow depth of field. The paper is seen at an angle, never readable. No logos."

**IA-4 — cierre:**
"Cinematic 16:9 shot: a small white delivery truck drives away down a quiet street; in the foreground, a store clerk stands calm at the doorway of the shop next to neatly stacked cardboard boxes. Late-morning light, documentary style, gentle push-in. No readable text, no logos."

Generá estos clips HOY. La generación tarda, gasta créditos y a veces hay que reintentar.

---

## Tratamiento de las capturas verticales

El grabador del Android entrega video vertical. El lienzo final es 16:9, 1080p. Para cada toma T:

1. Poné la captura centrada, con fondo desenfocado de la misma captura (o un panel liso del color de la marca).
2. En los momentos clave, hacé zoom al área de la interfaz que importa. No muestres siempre el teléfono entero.
3. El rótulo va en el espacio lateral libre, no sobre la interfaz.

---

## Música y mezcla

- Una sola pista, instrumental, libre de derechos: YouTube Audio Library o Pixabay Music. Una pista con copyright puede bloquear la submission.
- Estructura: la música sube en el acto 1, golpea en PL-1, queda de fondo en la demo y cierra en PL-2.
- Volumen: la voz siempre por encima; bajá la música unos 15–20 dB cuando hay voz.

---

## Lista de control final

- [ ] Dura 3:00 o menos.
- [ ] Se entiende con el audio apagado (rótulos + subtítulos de la voz si hay tiempo).
- [ ] El hook está en los primeros 5 segundos.
- [ ] Ninguna toma IA muestra la app, una pantalla o texto legible.
- [ ] La placa final tiene equipo, track y link al repo.
- [ ] Exportación 16:9, 1080p, H.264.
