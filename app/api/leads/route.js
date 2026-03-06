import { getDb } from '@/lib/db'

export async function POST(request) {
  try {
    const sql = getDb()
    const body = await request.json()
    const { id, vendor_id, name, email, whatsapp, country, interest, exports_today, has_fda, score, notes } = body

    if (!id || !vendor_id || !name) {
      return Response.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }

    const expos = await sql`SELECT id FROM expos WHERE is_active = true LIMIT 1`
    const expo_id = expos[0]?.id || 'fancy-food-2026'

    await sql`
      INSERT INTO expo_leads (id, vendor_id, expo_id, name, email, whatsapp, country, interest, exports_today, has_fda, score, notes, synced)
      VALUES (${id}, ${vendor_id}, ${expo_id}, ${name}, ${email}, ${whatsapp}, ${country}, ${interest}, ${exports_today}, ${has_fda}, ${score}, ${notes}, true)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        email = EXCLUDED.email,
        whatsapp = EXCLUDED.whatsapp,
        country = EXCLUDED.country,
        interest = EXCLUDED.interest,
        exports_today = EXCLUDED.exports_today,
        has_fda = EXCLUDED.has_fda,
        score = EXCLUDED.score,
        notes = EXCLUDED.notes,
        synced = true
    `

    return Response.json({ ok: true, expo_id })
  } catch (err) {
    console.error('Error guardando lead:', err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}

export async function GET(request) {
  try {
    const sql = getDb()
    const { searchParams } = new URL(request.url)
    const vendor_id = searchParams.get('vendor_id')
    const is_admin = searchParams.get('admin') === 'true'
    const expo_id = searchParams.get('expo_id')

    let leads
    if (is_admin) {
      if (expo_id) {
        leads = await sql`SELECT l.*, v.name as vendor_name FROM expo_leads l JOIN vendors v ON l.vendor_id = v.id WHERE l.expo_id = ${expo_id} ORDER BY l.created_at DESC`
      } else {
        leads = await sql`SELECT l.*, v.name as vendor_name FROM expo_leads l JOIN vendors v ON l.vendor_id = v.id ORDER BY l.created_at DESC`
      }
    } else {
      leads = await sql`SELECT * FROM expo_leads WHERE vendor_id = ${vendor_id} ORDER BY created_at DESC`
    }

    return Response.json({ leads })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
