import fetch from "node-fetch";

const TZ_OFFSET = -5; // Bogotá UTC-5

function convertirABogota(fechaISO) {
  const fechaUTC = new Date(fechaISO);
  const fechaBogota = new Date(fechaUTC.getTime() + (TZ_OFFSET * 60 * 60 * 1000));
  return fechaBogota;
}

function fechaDentroDeRango(fechaISO, desde, hasta) {
  const fechaBogota = convertirABogota(fechaISO);
  return fechaBogota >= desde && fechaBogota <= hasta;
}
function obtenerRangoFechas(filtro, desdeCustom, hastaCustom) {
  const ahoraUTC = new Date();
  const ahoraBogota = new Date(ahoraUTC.getTime() + (TZ_OFFSET * 60 * 60 * 1000));

  let desde, hasta;

  // Hoy (Bogotá)
  if (filtro === "hoy") {
    desde = new Date(ahoraBogota);
    desde.setHours(0, 0, 0, 0);

    hasta = new Date(ahoraBogota);
    hasta.setHours(23, 59, 59, 999);
  }

  // Ayer
  if (filtro === "ayer") {
    desde = new Date(ahoraBogota);
    desde.setDate(desde.getDate() - 1);
    desde.setHours(0, 0, 0, 0);

    hasta = new Date(desde);
    hasta.setHours(23, 59, 59, 999);
  }

  // Esta semana (lunes a domingo)
  if (filtro === "semana") {
    const dia = ahoraBogota.getDay() === 0 ? 6 : ahoraBogota.getDay() - 1;
    desde = new Date(ahoraBogota);
    desde.setDate(ahoraBogota.getDate() - dia);
    desde.setHours(0, 0, 0, 0);

    hasta = new Date(desde);
    hasta.setDate(desde.getDate() + 6);
    hasta.setHours(23, 59, 59, 999);
  }

  // Semana pasada
  if (filtro === "semana_pasada") {
    const dia = ahoraBogota.getDay() === 0 ? 6 : ahoraBogota.getDay() - 1;
    desde = new Date(ahoraBogota);
    desde.setDate(ahoraBogota.getDate() - dia - 7);
    desde.setHours(0, 0, 0, 0);

    hasta = new Date(desde);
    hasta.setDate(desde.getDate() + 6);
    hasta.setHours(23, 59, 59, 999);
  }

  // Este mes
  if (filtro === "mes") {
    desde = new Date(ahoraBogota.getFullYear(), ahoraBogota.getMonth(), 1, 0, 0, 0);
    hasta = new Date(ahoraBogota.getFullYear(), ahoraBogota.getMonth() + 1, 0, 23, 59, 59, 999);
  }

  // Personalizado (se asume que el usuario selecciona fechas Bogotá)
  if (filtro === "personalizado") {
    desde = new Date(desdeCustom + "T00:00:00");
    hasta = new Date(hastaCustom + "T23:59:59");
  }

  return { desde, hasta };
}
