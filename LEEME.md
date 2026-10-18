# Pilot Logbook · guía de instalación

Tu libro de vuelo como app propia: se instala en el iPhone/Android y en el ordenador, funciona sin conexión y sincroniza tus datos entre dispositivos con tu propia base de datos gratuita.

Tiempo total: unos 15 minutos, una sola vez.

---

## 1. Base de datos (Supabase, gratis)

1. Entra en **supabase.com** → *Start your project* → regístrate (con GitHub o email).
2. **New project**:
   - Nombre: `logbook`
   - Contraseña de la base de datos: la que quieras (guárdala, aunque la app no la usa)
   - Región: **West EU (Ireland)** o **Central EU (Frankfurt)**
3. Cuando termine de crearse (1–2 min), ve a **SQL Editor** → *New query*, pega todo el contenido de `schema.sql` y pulsa **Run**. Debe decir *Success*.
4. Ve a **Authentication → Sign In / Providers → Email** y desactiva **Confirm email** (es una app solo para ti; así no tienes que confirmar el correo).
5. Ve a **Project Settings → API** (o *Data API*) y copia:
   - **Project URL** (`https://xxxx.supabase.co`)
   - **anon public** key (la larga que empieza por `eyJ…`)

   La clave *anon* es pública por diseño: tus datos los protege tu usuario y contraseña (seguridad a nivel de fila en `schema.sql`). **No uses nunca la `service_role`.**

## 2. Publicar la app (GitHub Pages, gratis)

1. Entra en **github.com** y crea una cuenta si no tienes.
2. **New repository** → nombre `logbook` → *Public* → *Create repository*.
3. En el repositorio vacío: *uploading an existing file* → arrastra **todo el contenido** de la carpeta `logbook-pwa` (los archivos y las carpetas `icons` y `vendor`, no la carpeta en sí) → *Commit changes*.
4. **Settings → Pages** → *Source: Deploy from a branch* → Branch `main`, carpeta `/ (root)` → *Save*.
5. En 1–2 minutos tu app estará en `https://TU-USUARIO.github.io/logbook/`.

> El código es público pero **tus datos no**: viven en tu Supabase, detrás de tu contraseña. Si prefieres el repositorio privado, Netlify o Cloudflare Pages también sirven (arrastras la carpeta y listo).

## 3. Primer arranque

1. Abre la dirección de la app en el ordenador.
2. **Ajustes → Sincronización en la nube**: pega la *Project URL* y la *anon key* → **Guardar**.
3. Escribe tu email y una contraseña → **Crear mi cuenta**.
4. Opcional pero recomendable: en Supabase → **Authentication → Sign In / Providers**, desactiva **Allow new users to sign up**. Así nadie más puede registrarse en tu proyecto.
5. Ve a **Importar** y arrastra tu Excel o PDF.

## 4. Instalar en cada dispositivo

- **iPhone / iPad**: abre la dirección en **Safari** → botón Compartir → **Añadir a pantalla de inicio**. Ábrela desde el icono, ve a Ajustes, pega URL y clave y pulsa **Entrar** con el mismo email y contraseña.
- **Android**: Chrome → menú ⋮ → **Instalar aplicación**.
- **Mac / PC**: Chrome o Edge → icono de instalar en la barra de direcciones. En Safari del Mac: Archivo → **Añadir al Dock**.

## Novedades de la versión 1.14

- **Informe de Simple Aviation Training**: arrastra en Importar el PDF del logbook de SAT. Se reconoce solo, junta los alumnos de la misma sesión y las franjas solapadas, marca como TRE las LPC/revalidaciones/renovaciones/skill tests y no duplica lo que ya tienes. Úsalo cada mes con el informe nuevo.
- **Exámenes de Pitulin**: pega en Importar el texto del Archivo de Exámenes. Si ese día ya hay una sesión de SAT la marca como TRE; si no, crea una sesión TRE (2 h por candidato, máximo 4 h).
- **Vuelos como LSC**: pega fecha y número de vuelo (una línea por vuelo) y se añade “LSC” en observaciones; opcionalmente cuenta el tiempo como instructor. Los vuelos de Vueling importados llevan el número de vuelo guardado (no se ve en observaciones).
- **Experiencia reciente con el roster**: con vuelos programados, el panel calcula hasta cuándo te mantienes al día (PF alternos, todos o ninguno) y avisa si un vuelo programado cae después de la caducidad.
- **Revalidación TRI y TRE** (Simulador): con las fechas de “Habilitación TRI” y “Certificado de examinador TRE” en Caducidades, comprueba FCL.940.TRI (2 de 3: sesión de 3 h, refresher, evaluación de competencia) y FCL.1025 (2 chequeos por año de validez, refresher y chequeo observado en el último año). Refresher, evaluación y chequeo observado se apuntan en Caducidades con su fecha de “última vez”.
- **Copia de seguridad semanal**: botón “Guardar copia” (en el móvil abre compartir → Google Drive o Archivos) y aviso en el Resumen si pasan 7 días sin copia.
- **Certificado de experiencia** (Estadísticas → Informes → Certificado): totales, aviación general/Airbus, por tipo, simulador TRI/TRE, actividad reciente, licencias y firma. Se imprime o guarda en PDF.
- Caducidades por grupos desplegables y con fecha de última vez; el JSON de copia las incluye.

## Novedades de la versión 1.11 · Fatiga

- **Pestaña Fatiga**: agrupa tus vuelos en actividades (firma 45/60 min antes según el convenio, fin a calzos + 20 min), calcula la FDP frente a la tabla de ORO.FTL.205, el descanso previo frente a ORO.FTL.235 y el convenio (12 h en base, 10 h fuera), y marca madrugones, noches que tocan la WOCL (02:00–04:59), finales tardíos (23:00–01:59), FDP al 90 % o por encima de la tabla y actividades de 4+ sectores.
- **Mapa de calor año × mes** con un índice de carga por mes (block, block en 28 días, madrugones, noches, finales tardíos, FDP, descansos, días seguidos y días sin actividad frente a los 12 días libres del convenio). Colores por quintiles de tu propio historial. Tocando un mes ves cada actividad con sus alertas y qué suma el índice.
- **Tabla por año**: block frente a 900 h, madrugones, noches, finales tardíos, horas nocturnas del convenio (22:00–06:00), máximo block en 28 días, máximo de días seguidos y peor mes.
- Por defecto analiza la línea (Airbus) y cuenta los simuladores como días de actividad; se puede cambiar arriba.
- **Firma en base** configurable (por defecto 55 min antes de la salida) y desde qué año aplica; fuera de base, 45/60 min del convenio.

## Novedades de la versión 1.10

- **Pestaña Mapa**: mapa grande con zoom (rueda, botones o pellizco), arrastre y pantalla completa. Filtra por año, últimos 12 meses o todo el libro, y por Airbus o aviación general. Tocando un aeropuerto (en el mapa o en la tabla) se resaltan sus rutas y ves su ficha: llegadas, salidas, aterrizajes como PF, horas, media por año, años distintos, primera y última vez y con qué aeropuertos conecta.
- **Ranking de destinos**: llegadas por aeropuerto con % del total, media por año, años visitados, aterrizajes PF y fechas; ordenable por cualquier columna, con buscador y opción de incluir o no la base. Al lado, llegadas por país.
- **Ampliar mapa** desde la portada.
- **Aviación general y Airbus**: en Resumen, una tabla con PIC, copiloto, instructor, dual, noche, IFR y total separados (Airbus = A319, A320, A321 y neo; el resto, aviación general; el saldo inicial cuenta como aviación general). También en Estadísticas → Función a bordo (del periodo) y en el informe de experiencia.

## Novedades de la versión 1.9

- **Horas anteriores (saldo inicial)** en Ajustes: las horas que traías antes del primer vuelo de la app, columna a columna (total, SE/ME/MP, noche, IFR, funciones, FSTD, T/O y aterrizajes). Se suman a la portada, los hitos, el resumen de experiencia y a “total from previous pages” de la primera página EASA. Las estadísticas por periodo no las incluyen. Se sincroniza entre dispositivos y viaja en la copia JSON.
- Base de aeropuertos: añadido Berlín-Tegel (EDDT, cerrado en 2020) para los vuelos antiguos.

## Novedades de la versión 1.8.2

- Al importar un **JSON** (copia de seguridad o archivo preparado), los vuelos entran tal cual: por defecto no se recalcula la noche, no se rellena multi-pilot/IFR y no se asigna función. Las casillas siguen ahí si las quieres activar.

## Portada: mapa de rutas

Sobre el mapa de la portada eliges qué rutas ver: un **año** (desplegable; el actual incluye lo que queda programado), **All** (todo el libro), el **mes actual** (lo volado más lo que queda programado) y el **mes siguiente** (lo programado desde el roster). Las rutas programadas se dibujan discontinuas. Debajo, número de rutas, sectores y horas de ese periodo.

## Novedades de la versión 1.6 · Simulador

La pestaña Simulador es un libro de horas de FSTD:

- **Registro de sesión**: fecha, tipo (EBT EVAL, MV, SBT, LOFT, LPC, OPC, skill test, curso de tipo, mando…), módulo, rol (TRI/SFI, TRE/SFE o propia), tiempo, T/O+LDG, aproximaciones instrumentales, tipo de FSTD, centro y dispositivo, escenario y observaciones. Casilla para que cuente en la columna 11 del libro EASA.
- **Plantillas** de un toque y “+ Guardar como plantilla”.
- **Arriba, gráficos y análisis**: totales, requisitos de instructor y examinador frente a tus mínimos (Ajustes), tus OPC/LPC con caducidad, próximas sesiones, horas por mes (instructor / examinador / propias), por tipo, por centro, por año y por día de la semana.
- **Libro de simulador en formato EASA**: 18 líneas por página con fecha, tipo, FSTD/centro, sesión, función, tiempo como instructor / examinador / alumno-tripulación y total (horas y minutos separados), T/O-LDG y remarks; totales de página, de páginas anteriores y total, y certificación con tu firma. **Imprimir / PDF** saca cada página en un A4 apaisado.
- **Vistas en Vuelos y Simulador**: *Tabla* (por defecto: lista completa, la más reciente arriba, con buscador, filtros y totales) o *Página EASA* (el libro página a página, con flechas, número de página y “ir a la fecha”). Tocando una línea se edita.
- **Imprimir / PDF** en Vuelos y Simulador: elige qué (libro EASA o tabla) y el alcance: libro completo, página actual, rango de páginas, rango de fechas o lo que ves con los filtros. La app te dice cuántas páginas o líneas saldrán.
- Al registrar tu propio OPC/LPC, la app propone la nueva caducidad.

## Novedades de la versión 1.4

- **Actividad, FDP y descanso** (Estadísticas): agrupa tus vuelos en días de actividad, estima la presentación (ajustable en Ajustes), calcula la FDP y la compara con el máximo de ORO.FTL.205 (tripulación aclimatada, sin extensiones), marca descansos menores de 12 h, racha de días libres o de actividad, máximo de días seguidos y el tiempo de actividad de 7/14/28 días frente a 60/110/190 h. Incluye una calculadora FDP. En el vuelo en directo te dice la hora límite de calzos.
- **Roster** (Importar): PDF, foto, captura o texto pegado. Los sectores quedan como **programados** en Vuelos; cada uno se confirma con un toque (a mano, con foto del ACARS o en directo), y se pueden mandar al calendario.
- **Tripulación**: campo opcional en cada vuelo (copiloto o alumno). Aparece en las tarjetas y en "Con quién has volado".
- **Calendario .ics**: exporta los vuelos del periodo de Estadísticas como eventos.
- **Firma** (Ajustes): dibújala una vez; se imprime en los informes y en las páginas cerradas.
- **Cierre de página** (Informes → Libro EASA): cuando una página está completa (18 líneas) puedes cerrarla y firmarla. Se guarda una huella digital del contenido; si algo cambia después (o se inserta un vuelo anterior), la página aparece como modificada. Casilla "Solo páginas cerradas" para imprimir el libro firmado.

> Vuelve a ejecutar `schema.sql` entero en Supabase si ya lo habías hecho: amplía los tipos de registro (programados, páginas cerradas, firma). No borra nada.

## Novedades de la versión 1.3

- **Portada** en Resumen: tu nombre, cargo y licencia, el total de horas al estilo del libro, los totales por columna y el mapa de tus rutas de los últimos 12 meses.
- **Vuelo en directo**: botón ● en Resumen y en Vuelos. Pulsa OUT / OFF / ON / IN según ocurren y la hora UTC queda marcada (y se puede corregir). Al terminar, "Guardar en el libro" rellena el vuelo. Si cierras la app, el vuelo en curso se conserva.
- **Añadir la vuelta**: al guardar un sector, un aviso te ofrece crear el de vuelta con aeropuertos invertidos y la misma matrícula.
- **Filtros** en Vuelos: función, tipo, matrícula, con noche, con aterrizaje.
- **Hitos y objetivo personal**: próximo hito de horas totales y PIC con fecha estimada al ritmo actual; en Ajustes puedes fijar un objetivo propio (por ejemplo 1500 h para una fecha) y ver las horas al mes que necesitas.
- **Este mes**: horas, sectores y días, comparado con el mes anterior, con los últimos 12 meses en miniatura.
- **Estadísticas**: comparativa año a año de horas por mes, pasaporte de aeropuertos (visitas, primera y última vez, país) y comandantes con los que más has volado.
- **Tarjeta del vuelo**: desde cualquier vuelo, una imagen cuadrada con el mapa de la ruta y los tiempos, para compartir.
- Iconos en la barra del móvil y detalles del tema Libro (pan de oro, hoja apilada).

## Alta de vuelos con foto del ACARS

En **Vuelos → Foto ACARS** (o en el botón **Foto del ACARS** del formulario) haces una foto a la página de tiempos OOOI del ACARS o a la impresión. La app lee vuelo, aeropuertos, OUT/OFF/ON/IN y fecha, rellena el formulario (OUT/IN como horas de calzos, total = block) y calcula la noche. Revisas y pulsas Guardar.

Necesita tu clave de la API de Claude en **Ajustes** (`console.anthropic.com`). La foto se reduce en el móvil y se envía directamente a Anthropic; no se guarda en ningún sitio.

## Novedades de la versión 1.1

- **Noche automática**: al dar de alta un vuelo con aeropuertos y horas off/on, calcula la noche EASA (crepúsculo civil, sol 6° bajo el horizonte) minuto a minuto con la posición del avión en ruta, y decide si el despegue y el aterrizaje fueron de noche. También al importar, y en Ajustes puedes recalcular todo el libro.
- **Mapa de rutas y distancias** en Estadísticas: rutas ortodrómicas, aeropuertos, millas y kilómetros, vueltas a la Tierra, velocidad media, vuelo más lejano.
- **Calendario de actividad**: cada día coloreado por horas voladas.
- **Caducidades** (médico, TR, OPC, LPC, TRI, TRE, ELP, CRM…): aviso en Resumen con la antelación que elijas y exportación al calendario del móvil (.ics).
- **Temas**: Libro, Cabina (pantallas de cabina, tipografía B612 de Airbus) y Carta (carta aeronáutica). Ajustes → Apariencia.
- **Libro EASA imprimible**: Estadísticas → Informes → Libro EASA. Mismo formato que el libro de papel, 18 líneas por página, con totales arrastrados.
- **Resumen anual**: póster de tu año listo para descargar como imagen.
- **Aeropuertos**: base de unos 8.700 aeropuertos (OurAirports). Los que falten se añaden en Ajustes.

> Si ya habías ejecutado `schema.sql` antes de esta versión, vuelve a ejecutarlo entero en Supabase: amplía la tabla para guardar caducidades y aeropuertos propios. No borra nada.

## Cómo funciona

- **Sin conexión**: todo se guarda primero en el dispositivo. El indicador de arriba muestra *Sincronizado* o *N pendientes*; al volver la red se sube solo.
- **Importar Excel/CSV**: detecta las columnas; revisa la asignación y mira la vista previa. Los vuelos que ya estén en el libro (misma fecha, origen, destino y hora) se saltan.
- **Importar PDF**: la *lectura rápida* reconoce filas con fecha, dos códigos OACI y horas. Para PDF con formatos complicados, pon tu clave de la API de Claude en Ajustes (`console.anthropic.com`) y usa **Interpretar con Claude**: cada página se envía directamente a Anthropic desde tu dispositivo.
- **Copia de seguridad**: Importar → *Exportar todo a Excel* o *Exportar JSON*. El JSON se puede volver a importar.

## Actualizar la app

Cuando haya una versión nueva, sustituye los archivos en GitHub (*Add file → Upload files*). Cambia también la línea `const VERSION = "lb-1.1.0"` de `sw.js` (por ejemplo a `lb-1.1.1`) para que los dispositivos descarguen la nueva versión. La app avisará: *Nueva versión lista*.

## Archivos

| Archivo | Qué es |
|---|---|
| `index.html`, `styles.css`, `app.js` | La app |
| `manifest.webmanifest`, `icons/` | Nombre, icono y modo app al instalar |
| `sw.js` | Funcionamiento sin conexión |
| `airports.js`, `geo.js` | Base de aeropuertos y contornos del mapa (dominio público: OurAirports y Natural Earth) |
| `vendor/` | Librerías incluidas (Supabase, lector de Excel, lector de PDF), para que funcione offline |
| `schema.sql` | Tabla y seguridad de la base de datos |
