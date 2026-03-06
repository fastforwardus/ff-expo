import { google } from 'googleapis'

const SHEET_ID = '10jMM81ocvDuPiLJCvURDxHIuAPzIPSg0qIgv0TAOR5o'

const VENDOR_SHEETS = {
  tomas:     'Tomas',
  francisco: 'Francisco',
  mauricio:  'Mauricio',
  emiliano:  'Emiliano',
  daiana:    'Daiana',
}

function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
}

const HEADERS = ['Fecha', 'Nombre', 'Empresa', 'Email', 'WhatsApp', 'País', 'Interés', 'Exporta hoy', 'Tiene FDA', 'Score', 'Notas', 'Vendedor', 'Expo']

async function ensureHeaders(sheets, sheetName) {
  try {
    const r = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${sheetName}!A1:M1` })
    if (!r.data.values || r.data.values.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `${sheetName}!A1`,
        valueInputOption: 'RAW',
        requestBody: { values: [HEADERS] }
      })
    }
  } catch {}
}

export async function appendLead(lead, vendorName, expoName) {
  const auth = getAuth()
  const sheets = google.sheets({ version: 'v4', auth })

  const row = [
    new Date(lead.created_at).toLocaleString('es-AR'),
    lead.name || '',
    lead.company || '',
    lead.email || '',
    lead.whatsapp || '',
    lead.country || '',
    lead.interest || '',
    lead.exports_today ? 'Sí' : 'No',
    lead.has_fda ? 'Sí' : 'No',
    (lead.score || '').toUpperCase(),
    lead.notes || '',
    vendorName || '',
    expoName || '',
  ]

  const vendorSheet = VENDOR_SHEETS[lead.vendor_id]

  // Agregar a hoja del vendedor
  if (vendorSheet) {
    await ensureHeaders(sheets, vendorSheet)
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `${vendorSheet}!A:M`,
      valueInputOption: 'RAW',
      requestBody: { values: [row] }
    })
  }

  // Agregar a hoja Todos
  await ensureHeaders(sheets, 'Todos')
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: 'Todos!A:M',
    valueInputOption: 'RAW',
    requestBody: { values: [row] }
  })
}
