import fetch from "node-fetch";

function fechaDentroDeRango(fechaISO, desde, hasta) {
  const fecha = new Date(fechaISO);
  return fecha >= desde && fecha <= hasta;
}

function obtenerRangoFechas(filtro, desdeCustom, hastaCustom) {
  const hoy = new Date();
  let desde, hasta;

  // Hoy
  if (filtro === "hoy") {
    desde = new Date(hoy);
    desde.setHours(0, 0, 0, 0);

    hasta = new Date(hoy);
    hasta.setHours(23, 59, 59, 999);
  }

  // Ayer
  if (filtro === "ayer") {
    desde = new Date(hoy);
    desde.setDate(hoy.getDate() - 1);
    desde.setHours(0, 0, 0, 0);

    hasta = new Date(desde);
    hasta.setHours(23, 59, 59, 999);
  }

  // Esta semana (lunes a domingo)
  if (filtro === "semana") {
    const dia = hoy.getDay() === 0 ? 6 : hoy.getDay() - 1; // lunes = 0
    desde = new Date(hoy);
    desde.setDate(hoy.getDate() - dia);
    desde.setHours(0, 0, 0, 0);

    hasta = new Date(desde);
    hasta.setDate(desde.getDate() + 6);
    hasta.setHours(23, 59, 59, 999);
  }

  // Semana pasada
  if (filtro === "semana_pasada") {
    const dia = hoy.getDay() === 0 ? 6 : hoy.getDay() - 1;
    desde = new Date(hoy);
    desde.setDate(hoy.getDate() - dia - 7);
    desde.setHours(0, 0, 0, 0);

    hasta = new Date(desde);
    hasta.setDate(desde.getDate() + 6);
    hasta.setHours(23, 59, 59, 999);
  }

  // Este mes
  if (filtro === "mes") {
    desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1, 0, 0, 0);
    hasta = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0, 23, 59, 59, 999);
  }

  // Personalizado
  if (filtro === "personalizado") {
    desde = new Date(desdeCustom);
    hasta = new Date(hastaCustom);
    hasta.setHours(23, 59, 59, 999);
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
  const { filtro, desde, hasta, usuarios } = req.body;

  try {
    const { desde: fechaDesde, hasta: fechaHasta } = obtenerRangoFechas(
      filtro,
      desde,
      hasta
    );

    let carpetas = await obtenerSubcarpetas(folderIdRaiz);

    if (Array.isArray(usuarios) && usuarios.length > 0) {
      const seleccionados = usuarios.map(u => u.toLowerCase());
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
    console.error(error);
    res.status(500).json({ error: error.message });
  }
}
