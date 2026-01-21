import fetch from "node-fetch";

const TZ_OFFSET = -5; // Bogotá UTC-5

function convertirABogota(fechaISO) {
  const fechaUTC = new Date(fechaISO);
  return new Date(fechaUTC.getTime() + TZ_OFFSET * 60 * 60 * 1000);
}

function obtenerClaveCotizacion(nombre) {
  let limpio = nombre.replace(".pdf", "").toLowerCase().trim();

  if (!limpio.startsWith("cotizacion")) return null;

  // Quitar con guia / sin guia
  limpio = limpio.replace(" con guia", "");
  limpio = limpio.replace(" sin guia", "");

  // Normalizar espacios
  limpio = limpio.replace(/\s+/g, " ").trim();

  return limpio;
}

function obtenerLunesBogota(fecha) {
  const dia = fecha.getDay(); // 0=domingo, 1=lunes...
  const diff = dia === 0 ? -6 : 1 - dia; // ajustar a lunes
  const lunes = new Date(fecha);
  lunes.setDate(fecha.getDate() + diff);
  lunes.setHours(0, 0, 0, 0);
  return lunes;
}



function obtenerDestinoDesdeNombre(nombre) {
  const limpio = nombre.replace(".pdf", "").trim().toLowerCase();

  if (!limpio.startsWith("cotizacion")) return null;

  // Quitar "cotizacion"
  let resto = limpio.replace("cotizacion", "").trim();

  // Cortar antes del IATA (MDE_, BOG_, CLO_, etc)
  const partes = resto.split("_");
  const destinoConIata = partes[0].trim();

  // Separar palabras
  const palabras = destinoConIata.split(" ");

  // Quitar el último bloque si es un IATA (3 letras)
  const posibleIata = palabras[palabras.length - 1];
  if (/^[a-z]{3}$/i.test(posibleIata)) {
    palabras.pop();
  }

  let destino = palabras.join(" ").trim();

  // Normalizar casos especiales
  destino = destino.replace(" con guia", "");
  destino = destino.replace(" sin guia", "");

  // Limpiar espacios
  destino = destino.replace(/\s+/g, " ").trim();

  return destino;
}





function fechaDentroDeRango(fechaISO, desde, hasta) {
  const fechaBogota = convertirABogota(fechaISO);
  return fechaBogota >= desde && fechaBogota <= hasta;
}

function obtenerRangoFechas(filtro, desdeCustom, hastaCustom) {
  const ahoraUTC = new Date();
  const ahoraBogota = new Date(ahoraUTC.getTime() + TZ_OFFSET * 60 * 60 * 1000);

  let desde, hasta;

  if (filtro === "hoy") {
    desde = new Date(ahoraBogota);
    desde.setHours(0, 0, 0, 0);

    hasta = new Date(ahoraBogota);
    hasta.setHours(23, 59, 59, 999);
  }

  if (filtro === "ayer") {
    desde = new Date(ahoraBogota);
    desde.setDate(desde.getDate() - 1);
    desde.setHours(0, 0, 0, 0);

    hasta = new Date(desde);
    hasta.setHours(23, 59, 59, 999);
  }

if (filtro === "semana") {
  desde = obtenerLunesBogota(ahoraBogota);

  hasta = new Date(desde);
  hasta.setDate(desde.getDate() + 6);
  hasta.setHours(23, 59, 59, 999);
}

if (filtro === "semana_pasada") {
  desde = obtenerLunesBogota(ahoraBogota);
  desde.setDate(desde.getDate() - 7);

  hasta = new Date(desde);
  hasta.setDate(desde.getDate() + 6);
  hasta.setHours(23, 59, 59, 999);
}


  if (filtro === "mes") {
    desde = new Date(ahoraBogota.getFullYear(), ahoraBogota.getMonth(), 1, 0, 0, 0);
    hasta = new Date(ahoraBogota.getFullYear(), ahoraBogota.getMonth() + 1, 0, 23, 59, 59, 999);
  }

  if (filtro === "personalizado") {
    desde = new Date(desdeCustom + "T00:00:00");
    hasta = new Date(hastaCustom + "T23:59:59");
  }

  return { desde, hasta };
}

async function obtenerSubcarpetas(folderId) {
  const url = `https://www.googleapis.com/drive/v3/files?q='${folderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id,name)&key=${process.env.GOOGLE_API_KEY}`;
  const resp = await fetch(url);
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error?.message || "Error Google Drive");
  return data.files || [];
}

async function obtenerPDFs(folderId) {
  let todos = [];
  let pageToken = null;

  do {
    const url = new URL("https://www.googleapis.com/drive/v3/files");
    url.searchParams.append("q", `'${folderId}' in parents and mimeType='application/pdf' and trashed=false`);
    url.searchParams.append("fields", "nextPageToken, files(id,name,createdTime)");
    url.searchParams.append("pageSize", "100");
    if (pageToken) url.searchParams.append("pageToken", pageToken);
    url.searchParams.append("key", process.env.GOOGLE_API_KEY);

    const resp = await fetch(url.toString());
    const data = await resp.json();

    if (!resp.ok) throw new Error(data.error?.message || "Error Google Drive");

    todos = todos.concat(data.files || []);
    pageToken = data.nextPageToken;

  } while (pageToken);

  return todos;
}


const USUARIOS = [
  "carolina", "marly", "ana", "alex", "andres", "camilo.r", "aleja.u", "juan.h",
  "jefferson.c", "shara.c", "laura.c", "manuela.f", "mariadelmar.s", "juan.r",
  "johanna.c", "manuela.s", "leandro.b", "jennifer.h", "catalina.g", "juliana.v",
  "melissa.u", "angelica.p", "joha.g", "joan.o", "manuel.f", "cristian.m",
  "alexandra.c", "erika.v", "camila.m", "ingrid.p", "ana.a", "manuela.j",
  "yurany.g", "mariana.q"
];


export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const folderIdRaiz = "1HL5lFce29wBN17LAEv3ACvczRPb4aV5m";
  const { filtro, desde, hasta, busqueda, tipoBusqueda } = req.body;

  try {
    const { desde: fechaDesde, hasta: fechaHasta } = obtenerRangoFechas(
      filtro,
      desde,
      hasta
    );

    let carpetas = await obtenerSubcarpetas(folderIdRaiz);

    // Solo filtrar si es por usuario
    if (tipoBusqueda === "usuario" && Array.isArray(busqueda) && busqueda.length > 0) {
      const seleccionados = busqueda.map(u => u.toLowerCase());
      carpetas = carpetas.filter(c =>
        seleccionados.includes(c.name.toLowerCase())
      );
    }

    const mapaResultados = {};

    if (tipoBusqueda === "usuario") {
      for (const usuario of USUARIOS) {
        mapaResultados[usuario] = 0;
      }
    }

    // ===== RECORRER CARPETAS UNA SOLA VEZ =====
    for (const carpeta of carpetas) {
      const nombreUsuario = carpeta.name.toLowerCase().trim();

      // Si la carpeta no es de un usuario válido, saltar
      if (tipoBusqueda === "usuario" && !USUARIOS.includes(nombreUsuario)) {
        continue;
      }

      const pdfs = await obtenerPDFs(carpeta.id);

      const pdfsFiltrados = pdfs.filter(pdf =>
        fechaDentroDeRango(pdf.createdTime, fechaDesde, fechaHasta)
      );

      // ===== CONTAR POR USUARIO (DEDUPLICADO) =====
      if (tipoBusqueda === "usuario") {
        const cotizacionesUnicas = new Set();

        for (const pdf of pdfsFiltrados) {
          const claveCotizacion = obtenerClaveCotizacion(pdf.name);
          if (!claveCotizacion) continue;

          cotizacionesUnicas.add(claveCotizacion);
        }

        mapaResultados[nombreUsuario] += cotizacionesUnicas.size;
      }

      // ===== CONTAR POR DESTINO =====
      // ===== CONTAR POR DESTINO (DEDUPLICADO) =====
      if (tipoBusqueda === "destino") {

        const cotizacionesPorDestino = {};

        for (const pdf of pdfsFiltrados) {
          const destino = obtenerDestinoDesdeNombre(pdf.name);
          if (!destino) continue;

          if (Array.isArray(busqueda) && busqueda.length > 0) {
            if (!busqueda.map(d => d.toLowerCase()).includes(destino)) {
              continue;
            }
          }

          const claveCotizacion = obtenerClaveCotizacion(pdf.name);
          if (!claveCotizacion) continue;

          if (!cotizacionesPorDestino[destino]) {
            cotizacionesPorDestino[destino] = new Set();
          }

          cotizacionesPorDestino[destino].add(claveCotizacion);
        }

        // Sumar resultados finales
        for (const destino in cotizacionesPorDestino) {
          if (!mapaResultados[destino]) {
            mapaResultados[destino] = 0;
          }

          mapaResultados[destino] += cotizacionesPorDestino[destino].size;
        }
      }

    }


    // Convertir a array
    const resultado = Object.entries(mapaResultados).map(([nombre, total]) => ({
      usuario: nombre,
      total
    }));


    res.status(200).json({
      filtro,
      desde: fechaDesde,
      hasta: fechaHasta,
      resultados: resultado
    });

  } catch (error) {
    console.error("ERROR API:", error);
    res.status(500).json({
      error: "Error interno en la API",
      detalle: error.message
    });
  }
}
