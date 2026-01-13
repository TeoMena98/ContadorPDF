import express from "express";
import dotenv from "dotenv";
import fetch from "node-fetch";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());


// Servir tu HTML
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

// ================== TU LÓGICA ==================

function fechaDentroDeRango(fechaISO, desde, hasta) {
    const fecha = new Date(fechaISO);
    return fecha >= desde && fecha <= hasta;
}

function obtenerRangoFechas(filtro, desdeCustom, hastaCustom) {
    const hoy = new Date();
    let desde, hasta;

    if (filtro === "dia") {
        desde = new Date();
        desde.setHours(0, 0, 0, 0);
        hasta = new Date();
        hasta.setHours(23, 59, 59, 999);
    }

    if (filtro === "semana") {
        const diaSemana = hoy.getDay();
        desde = new Date(hoy);
        desde.setDate(hoy.getDate() - diaSemana);
        desde.setHours(0, 0, 0, 0);

        hasta = new Date(desde);
        hasta.setDate(desde.getDate() + 6);
        hasta.setHours(23, 59, 59, 999);
    }

    if (filtro === "mes") {
        desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        hasta = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0, 23, 59, 59);
    }

    if (filtro === "personalizado") {
        desde = new Date(desdeCustom);
        hasta = new Date(hastaCustom);
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

// ================== RUTA API ==================

app.post("/api/cotizaciones", async (req, res) => {
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

        res.json({
            filtro,
            desde: fechaDesde,
            hasta: fechaHasta,
            resultados: resultado
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// ================== ARRANQUE SERVIDOR ==================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log("Servidor corriendo en http://localhost:" + PORT);
});
