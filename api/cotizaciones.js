import fetch from "node-fetch";

const TZ_OFFSET = -5; // Bogotá UTC-5

function convertirABogota(fechaISO) {
  const fechaUTC = new Date(fechaISO);
  return new Date(fechaUTC.getTime() + TZ_OFFSET * 60 * 60 * 1000);
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
    const dia = ahoraBogota.getDay() === 0 ? 6 : ahoraBogota.getDay() - 1;
    desde = new Date(ahoraBogota);
    desde.setDate(ahoraBogota.getDate() - dia);
    desde.setHours(0, 0, 0, 0);

    hasta = new Date(desde);
    hasta.setDate(desde.getDate() + 6);
    hasta.setHours(23, 59, 59, 999);
  }

  if (filtro === "semana_pasada") {
    const dia = ahoraBogota.getDay() === 0 ? 6 : ahoraBogota.getDay() - 1;
    desde = new Date(ahoraBogota);
    desde.setDate(ahoraBogota.getDate() - dia - 7);
    desde.setHours(0, 0, 0, 0);

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
  const url = `https://www.googleapis.com/drive/v3/files?q='${folderId}' in parents and mimeType='application/pdf' and trashed=false&fields=files(id,name,createdTime)&key=${process.env.GOOGLE_API_KEY}`;
  const resp = await fetch(url);
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error?.message || "Error Google Drive");
  return data.files || [];
}

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

    const resultado = [];

    for (const usuario of carpetas) {
      const pdfs = await obtenerPDFs(usuario.id);

      const pdfsFiltrados = pdfs.filter(pdf =>
        fechaDentroDeRango(pdf.createdTime, fechaDesde, fechaHasta)
      );

      resultado.push({
        usuario: usuario.name,
        total: pdfsFiltrados.length
      });
    }

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
