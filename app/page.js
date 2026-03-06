'use client'
import { useState, useEffect } from 'react'

const VENDORS_LOCAL = {
  carlos:    { name:'Carlos',              color:'linear-gradient(135deg,#f7931e,#ff4d6d)', initials:'C',  admin:true },
  tomas:     { name:'Tomas Marino',        color:'linear-gradient(135deg,#4f6ef7,#7b93ff)', initials:'TM', admin:false },
  francisco: { name:'Francisco Logarzo',   color:'linear-gradient(135deg,#06b6d4,#4f6ef7)', initials:'FL', admin:false },
  mauricio:  { name:'Mauricio Lobaton',    color:'linear-gradient(135deg,#8b5cf6,#4f6ef7)', initials:'ML', admin:false },
  emiliano:  { name:'Emiliano Caracciolo', color:'linear-gradient(135deg,#10b981,#06b6d4)', initials:'EC', admin:false },
  daiana:    { name:'Daiana Guastella',    color:'linear-gradient(135deg,#ec4899,#f43f5e)', initials:'DG', admin:false },
}

const COUNTRIES = ['Argentina','México','Colombia','Chile','Perú','Brasil','Uruguay','Ecuador','Bolivia','Paraguay','Venezuela','Guatemala','Costa Rica','Otro']
const INTERESTS = ['FDA Registration','LLC Formation','Trademark','Amazon','US Agent','Otro']

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2) }
function getLocalLeads() { try { return JSON.parse(localStorage.getItem('ff_leads') || '[]') } catch { return [] } }
function saveLocalLead(lead) {
  const leads = getLocalLeads()
  const idx = leads.findIndex(l => l.id === lead.id)
  if (idx >= 0) leads[idx] = lead; else leads.unshift(lead)
  localStorage.setItem('ff_leads', JSON.stringify(leads))
}
async function syncLeads() {
  const leads = getLocalLeads().filter(l => !l.synced)
  for (const lead of leads) {
    try {
      const r = await fetch('/api/leads', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(lead) })
      if (r.ok) { lead.synced = true; saveLocalLead(lead) }
    } catch {}
  }
}

export default function App() {
  const [screen, setScreen] = useState('login')
  const [vendor, setVendor] = useState(null)
  const [vendors, setVendors] = useState({})
  const [pinTarget, setPinTarget] = useState(null)
  const [pinBuffer, setPinBuffer] = useState('')
  const [pinConfirm, setPinConfirm] = useState('')
  const [pinStep, setPinStep] = useState('enter') // 'enter' | 'setup' | 'confirm'
  const [pinError, setPinError] = useState('')
  const [leads, setLeads] = useState([])
  const [online, setOnline] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [newExpoName, setNewExpoName] = useState('')
  const [newExpoLocation, setNewExpoLocation] = useState('')
  const [expos, setExpos] = useState([])
  const [adminTab, setAdminTab] = useState('leads')
  const [form, setForm] = useState({ name:'', email:'', whatsapp:'', country:'', interest:'', exports_today:null, has_fda:null, score:'', notes:'' })
  const [formStep, setFormStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setOnline(navigator.onLine)
    window.addEventListener('online', () => { setOnline(true); doSync() })
    window.addEventListener('offline', () => setOnline(false))
    loadVendors()
  }, [])

  useEffect(() => {
    if (vendor) { loadLeads(); if (vendor.admin) loadExpos() }
  }, [vendor])

  async function loadVendors() {
    try {
      const r = await fetch('/api/vendors')
      const data = await r.json()
      const map = {}
      ;(data.vendors || []).forEach(v => { map[v.id] = v })
      setVendors(map)
    } catch {}
  }

  async function doSync() { setSyncing(true); await syncLeads(); setSyncing(false) }

  async function loadLeads() {
    if (!online) { setLeads(getLocalLeads().filter(l => vendor.admin || l.vendor_id === vendor.id)); return }
    try {
      const url = vendor.admin ? '/api/leads?admin=true' : `/api/leads?vendor_id=${vendor.id}`
      const r = await fetch(url)
      const data = await r.json()
      setLeads(data.leads || [])
    } catch { setLeads(getLocalLeads().filter(l => vendor.admin || l.vendor_id === vendor.id)) }
  }

  async function loadExpos() {
    try { const r = await fetch('/api/expos'); const data = await r.json(); setExpos(data.expos || []) } catch {}
  }

  async function createExpo() {
    if (!newExpoName.trim()) return
    try {
      await fetch('/api/expos', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name: newExpoName, location: newExpoLocation }) })
      setNewExpoName(''); setNewExpoLocation(''); loadExpos()
    } catch {}
  }

  function selectVendor(id) {
    const dbVendor = vendors[id]
    const hasPin = dbVendor?.has_pin
    setPinTarget(id)
    setPinBuffer('')
    setPinConfirm('')
    setPinError('')
    setPinStep(hasPin ? 'enter' : 'setup')
    setScreen('pin')
  }

  function handlePin(k) {
    const current = pinStep === 'confirm' ? pinConfirm : pinBuffer
    const setter = pinStep === 'confirm' ? setPinConfirm : setPinBuffer
    if (current.length >= 4) return
    const next = current + k
    setter(next)
    if (next.length === 4) setTimeout(() => checkPin(next), 150)
  }

  function handleDel() {
    if (pinStep === 'confirm') setPinConfirm(p => p.slice(0,-1))
    else setPinBuffer(p => p.slice(0,-1))
  }

  async function checkPin(buf) {
    if (pinStep === 'enter') {
      // Verificar contra DB
      try {
        const r = await fetch(`/api/vendors?verify=true`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id: pinTarget, pin: buf, action: 'verify' }) })
        const data = await r.json()
        if (data.ok) {
          loginVendor(pinTarget)
        } else {
          setPinError('PIN incorrecto. Intentá de nuevo.')
          setTimeout(() => { setPinBuffer(''); setPinError('') }, 800)
        }
      } catch {
        // Offline: verificar localmente si está guardado
        const saved = localStorage.getItem(`pin_${pinTarget}`)
        if (saved === buf) { loginVendor(pinTarget) }
        else { setPinError('Sin conexión, no se puede verificar.'); setTimeout(() => { setPinBuffer(''); setPinError('') }, 1000) }
      }
    } else if (pinStep === 'setup') {
      setPinConfirm('')
      setPinStep('confirm')
    } else if (pinStep === 'confirm') {
      if (buf === pinBuffer) {
        // Guardar PIN
        try {
          await fetch('/api/vendors', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id: pinTarget, pin: pinBuffer }) })
        } catch {}
        localStorage.setItem(`pin_${pinTarget}`, pinBuffer)
        loginVendor(pinTarget)
      } else {
        setPinError('Los PINs no coinciden. Intentá de nuevo.')
        setTimeout(() => { setPinBuffer(''); setPinConfirm(''); setPinStep('setup'); setPinError('') }, 900)
      }
    }
  }

  function loginVendor(id) {
    const v = VENDORS_LOCAL[id]
    setVendor({ id, ...v })
    setScreen('home')
    setPinBuffer('')
    setPinConfirm('')
  }

  function logout() {
    setVendor(null); setLeads([]); setScreen('login')
    setForm({ name:'', email:'', whatsapp:'', country:'', interest:'', exports_today:null, has_fda:null, score:'', notes:'' })
    setFormStep(1)
  }

  function calcScore() {
    if (form.exports_today && !form.has_fda) return 'hot'
    if (form.exports_today && form.has_fda) return 'warm'
    return 'cold'
  }

  async function saveLead() {
    setSaving(true)
    const score = calcScore()
    const lead = { id: genId(), vendor_id: vendor.id, ...form, score, synced: false, created_at: new Date().toISOString() }
    saveLocalLead(lead)
    if (online) {
      try {
        const r = await fetch('/api/leads', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(lead) })
        if (r.ok) { lead.synced = true; saveLocalLead(lead) }
      } catch {}
    }
    setSaving(false); setSaved(true)
    setTimeout(() => { setSaved(false); setForm({ name:'', email:'', whatsapp:'', country:'', interest:'', exports_today:null, has_fda:null, score:'', notes:'' }); setFormStep(1); loadLeads(); setScreen('home') }, 1500)
  }

  const pendingSync = getLocalLeads().filter(l => !l.synced).length
  const hotLeads = leads.filter(l => l.score === 'hot').length
  const warmLeads = leads.filter(l => l.score === 'warm').length

  const s = {
    app:{ height:'100vh', display:'flex', flexDirection:'column', background:'#0a0c1e', fontFamily:"'DM Sans',sans-serif", color:'#e8eaf6', overflow:'hidden' },
    topbar:{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 20px', background:'#12152e', borderBottom:'1px solid #1e2248', flexShrink:0 },
    logo:{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:17, color:'#fff' },
    syncBtn:{ display:'flex', alignItems:'center', gap:5, fontSize:11, padding:'4px 10px', borderRadius:20, background:'rgba(79,110,247,0.15)', border:'1px solid rgba(79,110,247,0.3)', cursor:'pointer', color:'#8ba3ff' },
    body:{ flex:1, overflowY:'auto', overflowX:'hidden', padding:20 },
    card:{ background:'#141730', border:'1px solid #1e2248', borderRadius:20, padding:20, marginBottom:16 },
    btn:{ width:'100%', padding:'15px', borderRadius:14, border:'none', fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:15, cursor:'pointer', transition:'.15s' },
    btnPrimary:{ background:'linear-gradient(135deg,#4f6ef7,#7b93ff)', color:'#fff' },
    btnSecondary:{ background:'#1c2045', color:'#8ba3ff', border:'1px solid #1e2248' },
    input:{ width:'100%', padding:'13px 16px', borderRadius:12, background:'#0d0f2b', border:'1px solid #1e2248', color:'#e8eaf6', fontSize:15, fontFamily:"'DM Sans',sans-serif", outline:'none', boxSizing:'border-box' },
    label:{ fontSize:12, color:'#5a6494', marginBottom:6, display:'block', letterSpacing:'0.5px', textTransform:'uppercase' },
    bottomnav:{ display:'flex', background:'#12152e', borderTop:'1px solid #1e2248', flexShrink:0 },
    navbtn:{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3, padding:'10px 8px', cursor:'pointer', border:'none', background:'none', color:'#5a6494', fontSize:10, fontFamily:"'DM Sans',sans-serif" },
    avatar:{ width:42, height:42, borderRadius:13, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:15, color:'#fff', flexShrink:0 },
  }

  // ─── LOGIN ───────────────────────────────────────────────
  if (screen === 'login') return (
    <div style={{...s.app, alignItems:'center', justifyContent:'center', padding:24, background:'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(79,110,247,0.18) 0%, transparent 70%), #0a0c1e'}}>
      <div style={{textAlign:'center', marginBottom:28}}>
        <img src="https://fastfwdus.com/wp-content/uploads/2025/04/logorwhitehorizontal.png" style={{width:150, opacity:.9}} />
        <div style={{display:'inline-flex', alignItems:'center', gap:6, marginTop:12, padding:'4px 14px', borderRadius:20, background:'rgba(79,110,247,0.12)', border:'1px solid rgba(79,110,247,0.25)', fontSize:11, letterSpacing:'2.5px', textTransform:'uppercase', color:'#8ba3ff', fontFamily:"'Syne',sans-serif", fontWeight:700}}>
          <span style={{width:6, height:6, borderRadius:'50%', background:'#8ba3ff', display:'inline-block'}}></span>
          Expo 2026
        </div>
      </div>
      <div style={{width:'100%', maxWidth:360, background:'#141730', border:'1px solid #1e2248', borderRadius:24, padding:'24px 20px', display:'flex', flexDirection:'column', gap:10}}>
        <div style={{fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:16, marginBottom:4}}>¿Quién sos?</div>
        {Object.entries(VENDORS_LOCAL).map(([id, v]) => (
          <button key={id} onClick={() => selectVendor(id)} style={{display:'flex', alignItems:'center', gap:12, padding:'14px 16px', background:'#0d0f2b', border:'1px solid #1e2248', borderRadius:14, cursor:'pointer', textAlign:'left', width:'100%'}}>
            <div style={{...s.avatar, background:v.color}}>{v.initials}</div>
            <div style={{flex:1}}>
              <div style={{fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:14, color:'#e8eaf6'}}>{v.name}</div>
              {v.admin && <div style={{fontSize:11, color:'#5a6494', marginTop:2}}>Admin</div>}
            </div>
            <div style={{color:'#5a6494', fontSize:20}}>›</div>
          </button>
        ))}
      </div>
      <div style={{marginTop:16, fontSize:11, color:'#5a6494', textAlign:'center', lineHeight:1.8}}>
        <strong style={{color:'#8ba3ff'}}>FF Expo App</strong> · Funciona sin internet
      </div>
    </div>
  )

  // ─── PIN ─────────────────────────────────────────────────
  if (screen === 'pin') {
    const v = VENDORS_LOCAL[pinTarget] || {}
    const currentBuf = pinStep === 'confirm' ? pinConfirm : pinBuffer
    const pinTitle = pinStep === 'enter' ? 'Ingresá tu PIN' : pinStep === 'setup' ? 'Elegí tu PIN' : 'Confirmá tu PIN'
    const pinSub = pinStep === 'enter' ? '' : pinStep === 'setup' ? 'Primera vez — elegí 4 dígitos' : 'Ingresá el PIN de nuevo'
    return (
      <div style={{...s.app, alignItems:'center', justifyContent:'center', padding:32, gap:20, position:'relative'}}>
        <button onClick={() => setScreen('login')} style={{position:'absolute', top:20, left:20, background:'none', border:'none', color:'#5a6494', fontSize:24, cursor:'pointer'}}>←</button>
        <div style={{...s.avatar, width:72, height:72, borderRadius:22, fontSize:26, background:v.color, boxShadow:'0 8px 24px rgba(0,0,0,.4)'}}>{v.initials}</div>
        <div style={{textAlign:'center'}}>
          <div style={{fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:22}}>{v.name}</div>
          <div style={{fontSize:14, color:'#8ba3ff', marginTop:6, fontWeight:600}}>{pinTitle}</div>
          {pinSub && <div style={{fontSize:12, color:'#5a6494', marginTop:4}}>{pinSub}</div>}
        </div>
        <div style={{display:'flex', gap:14}}>
          {[0,1,2,3].map(i => (
            <div key={i} style={{width:16, height:16, borderRadius:'50%', background: i < currentBuf.length ? '#4f6ef7' : '#1e2248', transition:'.15s'}}></div>
          ))}
        </div>
        <div style={{fontSize:13, color:'#ff4d6d', minHeight:18, textAlign:'center'}}>{pinError}</div>
        <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, width:'100%', maxWidth:280}}>
          {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((k,i) => (
            <button key={i} onClick={() => k === '⌫' ? handleDel() : k ? handlePin(k) : null}
              style={{aspectRatio:'1', borderRadius:18, background: k ? '#141730' : 'transparent', border: k ? '1px solid #1e2248' : 'none', color: k === '⌫' ? '#5a6494' : '#e8eaf6', fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:22, cursor: k ? 'pointer' : 'default'}}>
              {k}
            </button>
          ))}
        </div>
      </div>
    )
  }

  // ─── HOME ─────────────────────────────────────────────────
  if (screen === 'home') return (
    <div style={s.app}>
      <div style={s.topbar}>
        <div style={s.logo}>FF <span style={{color:'#8ba3ff'}}>Expo</span></div>
        <div style={{display:'flex', alignItems:'center', gap:10}}>
          {pendingSync > 0 && <div style={{fontSize:11, color:'#f7a94f'}}>{pendingSync} pendientes</div>}
          <button onClick={doSync} style={{...s.syncBtn, opacity: syncing ? .6 : 1}}>
            <span style={{width:7, height:7, borderRadius:'50%', background: online ? '#4ade80' : '#f7a94f', display:'inline-block'}}></span>
            {syncing ? 'Sincronizando...' : online ? 'Online' : 'Offline'}
          </button>
        </div>
      </div>
      <div style={s.body}>
        <div style={{display:'flex', alignItems:'center', gap:12, marginBottom:20}}>
          <div style={{...s.avatar, background:vendor.color}}>{vendor.initials}</div>
          <div>
            <div style={{fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:18}}>Hola, {vendor.name.split(' ')[0]}</div>
            <div style={{fontSize:12, color:'#5a6494'}}>Fancy Food NYC 2026</div>
          </div>
        </div>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:20}}>
          {[{label:'Total', value:leads.length, color:'#8ba3ff'},{label:'🔥 Hot', value:hotLeads, color:'#ff4d6d'},{label:'🟡 Warm', value:warmLeads, color:'#f7a94f'}].map(st => (
            <div key={st.label} style={{...s.card, padding:'14px', textAlign:'center', marginBottom:0}}>
              <div style={{fontSize:24, fontFamily:"'Syne',sans-serif", fontWeight:800, color:st.color}}>{st.value}</div>
              <div style={{fontSize:11, color:'#5a6494', marginTop:2}}>{st.label}</div>
            </div>
          ))}
        </div>
        <button onClick={() => setScreen('new-lead')} style={{...s.btn, ...s.btnPrimary, marginBottom:12, fontSize:17, padding:18}}>+ Nuevo Lead</button>
        <div style={{fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:13, color:'#5a6494', marginBottom:10, letterSpacing:.5}}>ÚLTIMOS LEADS</div>
        {leads.slice(0,5).map(l => (
          <div key={l.id} style={{...s.card, padding:'14px 16px', marginBottom:10, display:'flex', alignItems:'center', gap:12}}>
            <div style={{width:36, height:36, borderRadius:10, background: l.score==='hot'?'rgba(255,77,109,0.15)':l.score==='warm'?'rgba(247,169,79,0.15)':'rgba(74,222,128,0.15)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16}}>
              {l.score==='hot'?'🔥':l.score==='warm'?'🟡':'🟢'}
            </div>
            <div style={{flex:1, minWidth:0}}>
              <div style={{fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:14, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{l.name}</div>
              <div style={{fontSize:11, color:'#5a6494'}}>{l.interest||'Sin interés'} · {l.country||''}</div>
            </div>
            {!l.synced && <span style={{fontSize:10, color:'#f7a94f'}}>⏳</span>}
          </div>
        ))}
        {leads.length === 0 && <div style={{textAlign:'center', color:'#5a6494', fontSize:14, padding:32}}>Todavía no hay leads. ¡A capturar!</div>}
      </div>
      <div style={s.bottomnav}>
        <button onClick={() => setScreen('home')} style={{...s.navbtn, color:'#8ba3ff'}}>🏠<span>Home</span></button>
        <button onClick={() => setScreen('new-lead')} style={s.navbtn}>➕<span>Nuevo</span></button>
        <button onClick={() => setScreen('leads')} style={s.navbtn}>📋<span>Leads</span></button>
        {vendor.admin && <button onClick={() => setScreen('admin')} style={s.navbtn}>⚡<span>Admin</span></button>}
        <button onClick={logout} style={s.navbtn}>🚪<span>Salir</span></button>
      </div>
    </div>
  )

  // ─── NEW LEAD ─────────────────────────────────────────────
  if (screen === 'new-lead') {
    const f = form
    const set = (k, v) => setForm(p => ({...p, [k]:v}))
    if (saved) return (
      <div style={{...s.app, alignItems:'center', justifyContent:'center', gap:16}}>
        <div style={{fontSize:64}}>✅</div>
        <div style={{fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:22}}>Lead guardado</div>
        <div style={{fontSize:14, color:'#5a6494'}}>{online ? 'Sincronizado' : 'Se sincronizará cuando haya WiFi'}</div>
      </div>
    )
    return (
      <div style={s.app}>
        <div style={s.topbar}>
          <button onClick={() => setScreen('home')} style={{background:'none', border:'none', color:'#5a6494', fontSize:22, cursor:'pointer'}}>←</button>
          <div style={{fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:16}}>Nuevo Lead</div>
          <div style={{fontSize:12, color:'#5a6494'}}>Paso {formStep}/3</div>
        </div>
        <div style={{...s.body, paddingTop:16}}>
          <div style={{display:'flex', gap:6, marginBottom:24}}>
            {[1,2,3].map(i => <div key={i} style={{flex:1, height:3, borderRadius:3, background: i <= formStep ? '#4f6ef7' : '#1e2248', transition:'.3s'}}></div>)}
          </div>
          {formStep === 1 && (
            <div style={{display:'flex', flexDirection:'column', gap:16}}>
              <div style={{fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:20, marginBottom:4}}>Datos de contacto</div>
              <div><label style={s.label}>Nombre completo *</label><input style={s.input} value={f.name} onChange={e => set('name', e.target.value)} placeholder="Nombre completo" /></div>
              <div><label style={s.label}>Email</label><input style={s.input} type="email" value={f.email} onChange={e => set('email', e.target.value)} placeholder="email@empresa.com" /></div>
              <div><label style={s.label}>WhatsApp</label><input style={s.input} type="tel" value={f.whatsapp} onChange={e => set('whatsapp', e.target.value)} placeholder="+1 234 567 8900" /></div>
              <div><label style={s.label}>País</label>
                <select style={{...s.input, appearance:'none'}} value={f.country} onChange={e => set('country', e.target.value)}>
                  <option value="">Seleccioná...</option>
                  {COUNTRIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <button onClick={() => f.name ? setFormStep(2) : null} style={{...s.btn, ...s.btnPrimary, opacity: f.name ? 1 : .5}}>Siguiente →</button>
            </div>
          )}
          {formStep === 2 && (
            <div style={{display:'flex', flexDirection:'column', gap:16}}>
              <div style={{fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:20, marginBottom:4}}>Calificación</div>
              <div>
                <label style={s.label}>Interés principal</label>
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
                  {INTERESTS.map(i => (
                    <button key={i} onClick={() => set('interest', i)} style={{padding:'11px', borderRadius:12, border:`1px solid ${f.interest===i?'#4f6ef7':'#1e2248'}`, background: f.interest===i?'rgba(79,110,247,0.15)':'#0d0f2b', color: f.interest===i?'#8ba3ff':'#5a6494', fontSize:13, cursor:'pointer', fontFamily:"'DM Sans',sans-serif"}}>
                      {i}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={s.label}>¿Exporta hoy a USA?</label>
                <div style={{display:'flex', gap:8}}>
                  {[['Sí',true],['No',false]].map(([label,val]) => (
                    <button key={label} onClick={() => set('exports_today', val)} style={{flex:1, padding:'12px', borderRadius:12, border:`1px solid ${f.exports_today===val?'#4f6ef7':'#1e2248'}`, background: f.exports_today===val?'rgba(79,110,247,0.15)':'#0d0f2b', color: f.exports_today===val?'#8ba3ff':'#5a6494', fontSize:15, cursor:'pointer', fontFamily:"'Syne',sans-serif", fontWeight:700}}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={s.label}>¿Tiene registro FDA?</label>
                <div style={{display:'flex', gap:8}}>
                  {[['Sí',true],['No',false]].map(([label,val]) => (
                    <button key={label} onClick={() => set('has_fda', val)} style={{flex:1, padding:'12px', borderRadius:12, border:`1px solid ${f.has_fda===val?'#4f6ef7':'#1e2248'}`, background: f.has_fda===val?'rgba(79,110,247,0.15)':'#0d0f2b', color: f.has_fda===val?'#8ba3ff':'#5a6494', fontSize:15, cursor:'pointer', fontFamily:"'Syne',sans-serif", fontWeight:700}}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {f.exports_today !== null && f.has_fda !== null && (
                <div style={{padding:'12px 16px', borderRadius:12, background: calcScore()==='hot'?'rgba(255,77,109,0.1)':calcScore()==='warm'?'rgba(247,169,79,0.1)':'rgba(74,222,128,0.1)', border:`1px solid ${calcScore()==='hot'?'rgba(255,77,109,0.3)':calcScore()==='warm'?'rgba(247,169,79,0.3)':'rgba(74,222,128,0.3)'}`, textAlign:'center'}}>
                  <div style={{fontSize:24}}>{calcScore()==='hot'?'🔥':calcScore()==='warm'?'🟡':'🟢'}</div>
                  <div style={{fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:14, marginTop:4}}>
                    {calcScore()==='hot'?'Lead HOT — Necesita FDA urgente':calcScore()==='warm'?'Lead WARM — Ya exporta, tiene FDA':'Lead COLD — Aún no exporta'}
                  </div>
                </div>
              )}
              <div style={{display:'flex', gap:8}}>
                <button onClick={() => setFormStep(1)} style={{...s.btn, ...s.btnSecondary, flex:1}}>← Volver</button>
                <button onClick={() => setFormStep(3)} style={{...s.btn, ...s.btnPrimary, flex:2}}>Siguiente →</button>
              </div>
            </div>
          )}
          {formStep === 3 && (
            <div style={{display:'flex', flexDirection:'column', gap:16}}>
              <div style={{fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:20, marginBottom:4}}>Nota (opcional)</div>
              <textarea value={f.notes} onChange={e => set('notes', e.target.value)} placeholder="Ej: muy interesado en FDA, tiene productos lácteos, vuelve mañana..." style={{...s.input, height:120, resize:'none', lineHeight:1.6}} />
              <div style={{...s.card, padding:'16px'}}>
                <div style={{fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:13, color:'#5a6494', marginBottom:10}}>RESUMEN</div>
                <div style={{fontSize:14, lineHeight:2}}>
                  <div><strong>{f.name}</strong> · {f.country}</div>
                  <div style={{color:'#8ba3ff'}}>{f.interest}</div>
                  <div>{f.email} {f.whatsapp && `· ${f.whatsapp}`}</div>
                  <div style={{marginTop:4}}>Score: <strong>{calcScore().toUpperCase()}</strong> {calcScore()==='hot'?'🔥':calcScore()==='warm'?'🟡':'🟢'}</div>
                </div>
              </div>
              <div style={{display:'flex', gap:8}}>
                <button onClick={() => setFormStep(2)} style={{...s.btn, ...s.btnSecondary, flex:1}}>← Volver</button>
                <button onClick={saveLead} disabled={saving} style={{...s.btn, ...s.btnPrimary, flex:2, opacity: saving?.7:1}}>
                  {saving ? 'Guardando...' : '✅ Guardar Lead'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ─── LEADS LIST ───────────────────────────────────────────
  if (screen === 'leads') return (
    <div style={s.app}>
      <div style={s.topbar}>
        <button onClick={() => setScreen('home')} style={{background:'none', border:'none', color:'#5a6494', fontSize:22, cursor:'pointer'}}>←</button>
        <div style={{fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:16}}>Mis Leads</div>
        <div style={{fontSize:13, color:'#8ba3ff', fontWeight:600}}>{leads.length} total</div>
      </div>
      <div style={s.body}>
        {['hot','warm','cold'].map(score => {
          const filtered = leads.filter(l => l.score === score)
          if (!filtered.length) return null
          return (
            <div key={score}>
              <div style={{fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:12, color:'#5a6494', marginBottom:8, letterSpacing:.5}}>
                {score==='hot'?'🔥 HOT':score==='warm'?'🟡 WARM':'🟢 COLD'} · {filtered.length}
              </div>
              {filtered.map(l => (
                <div key={l.id} style={{...s.card, marginBottom:10}}>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
                    <div style={{fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:15}}>{l.name}</div>
                    {!l.synced && <span style={{fontSize:10, color:'#f7a94f'}}>⏳ pendiente</span>}
                  </div>
                  <div style={{fontSize:13, color:'#5a6494', marginTop:4}}>{l.interest} · {l.country}</div>
                  {l.email && <div style={{fontSize:12, color:'#8ba3ff', marginTop:4}}>{l.email}</div>}
                  {l.whatsapp && <div style={{fontSize:12, color:'#4ade80', marginTop:2}}>📱 {l.whatsapp}</div>}
                  {l.notes && <div style={{fontSize:12, color:'#5a6494', marginTop:8, fontStyle:'italic', borderTop:'1px solid #1e2248', paddingTop:8}}>"{l.notes}"</div>}
                  {vendor.admin && l.vendor_name && <div style={{fontSize:11, color:'#5a6494', marginTop:6}}>👤 {l.vendor_name}</div>}
                </div>
              ))}
            </div>
          )
        })}
        {leads.length === 0 && <div style={{textAlign:'center', color:'#5a6494', fontSize:14, padding:48}}>No hay leads todavía</div>}
      </div>
      <div style={s.bottomnav}>
        <button onClick={() => setScreen('home')} style={s.navbtn}>🏠<span>Home</span></button>
        <button onClick={() => setScreen('new-lead')} style={s.navbtn}>➕<span>Nuevo</span></button>
        <button onClick={() => setScreen('leads')} style={{...s.navbtn, color:'#8ba3ff'}}>📋<span>Leads</span></button>
        {vendor.admin && <button onClick={() => setScreen('admin')} style={s.navbtn}>⚡<span>Admin</span></button>}
        <button onClick={logout} style={s.navbtn}>🚪<span>Salir</span></button>
      </div>
    </div>
  )

  // ─── ADMIN ────────────────────────────────────────────────
  if (screen === 'admin') {
    const ranking = Object.entries(VENDORS_LOCAL).filter(([id]) => id !== 'carlos').map(([id, v]) => ({
      id, name: v.name, color: v.color, initials: v.initials,
      total: leads.filter(l => l.vendor_id === id).length,
      hot: leads.filter(l => l.vendor_id === id && l.score === 'hot').length,
    })).sort((a,b) => b.total - a.total)
    return (
      <div style={s.app}>
        <div style={s.topbar}>
          <button onClick={() => setScreen('home')} style={{background:'none', border:'none', color:'#5a6494', fontSize:22, cursor:'pointer'}}>←</button>
          <div style={{fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:16}}>Admin</div>
          <div style={{fontSize:12, color:'#f7a94f'}}>⚡ Carlos</div>
        </div>
        <div style={{display:'flex', gap:0, background:'#0d0f2b', borderBottom:'1px solid #1e2248', flexShrink:0}}>
          {[['leads','Leads'],['ranking','Ranking'],['expos','Expos']].map(([tab, label]) => (
            <button key={tab} onClick={() => setAdminTab(tab)} style={{flex:1, padding:'12px 8px', border:'none', background:'none', color: adminTab===tab?'#8ba3ff':'#5a6494', fontSize:13, cursor:'pointer', fontFamily:"'Syne',sans-serif", fontWeight:700, borderBottom: adminTab===tab?'2px solid #4f6ef7':'2px solid transparent'}}>
              {label}
            </button>
          ))}
        </div>
        <div style={s.body}>
          {adminTab === 'leads' && (
            <>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:20}}>
                {[{label:'Total',value:leads.length,color:'#8ba3ff'},{label:'🔥 Hot',value:leads.filter(l=>l.score==='hot').length,color:'#ff4d6d'},{label:'🟡 Warm',value:leads.filter(l=>l.score==='warm').length,color:'#f7a94f'}].map(st => (
                  <div key={st.label} style={{...s.card, padding:'14px', textAlign:'center', marginBottom:0}}>
                    <div style={{fontSize:22, fontFamily:"'Syne',sans-serif", fontWeight:800, color:st.color}}>{st.value}</div>
                    <div style={{fontSize:11, color:'#5a6494', marginTop:2}}>{st.label}</div>
                  </div>
                ))}
              </div>
              {leads.map(l => (
                <div key={l.id} style={{...s.card, marginBottom:10}}>
                  <div style={{display:'flex', justifyContent:'space-between'}}>
                    <div style={{fontFamily:"'Syne',sans-serif", fontWeight:700}}>{l.name}</div>
                    <span>{l.score==='hot'?'🔥':l.score==='warm'?'🟡':'🟢'}</span>
                  </div>
                  <div style={{fontSize:12, color:'#5a6494', marginTop:4}}>{l.interest} · {l.country}</div>
                  {l.vendor_name && <div style={{fontSize:11, color:'#f7a94f', marginTop:4}}>👤 {l.vendor_name}</div>}
                  {l.email && <div style={{fontSize:12, color:'#8ba3ff', marginTop:4}}>{l.email}</div>}
                </div>
              ))}
            </>
          )}
          {adminTab === 'ranking' && (
            <>
              <div style={{fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:18, marginBottom:16}}>🏆 Ranking del día</div>
              {ranking.map((v, i) => (
                <div key={v.id} style={{...s.card, marginBottom:10, display:'flex', alignItems:'center', gap:14}}>
                  <div style={{fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:22, color: i===0?'#f7a94f':i===1?'#94a3b8':'#cd7f32', width:28}}>{i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1}</div>
                  <div style={{...s.avatar, width:40, height:40, fontSize:13, background:v.color}}>{v.initials}</div>
                  <div style={{flex:1}}>
                    <div style={{fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:14}}>{v.name.split(' ')[0]}</div>
                    <div style={{fontSize:12, color:'#5a6494'}}>{v.hot} 🔥 hot</div>
                  </div>
                  <div style={{fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:26, color:'#8ba3ff'}}>{v.total}</div>
                </div>
              ))}
            </>
          )}
          {adminTab === 'expos' && (
            <>
              <div style={{fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:18, marginBottom:16}}>Expos</div>
              {expos.map(e => (
                <div key={e.id} style={{...s.card, marginBottom:10, display:'flex', alignItems:'center', gap:12}}>
                  <div style={{flex:1}}>
                    <div style={{fontFamily:"'Syne',sans-serif", fontWeight:700}}>{e.name}</div>
                    <div style={{fontSize:12, color:'#5a6494'}}>{e.location}</div>
                  </div>
                  {e.is_active && <span style={{fontSize:11, padding:'3px 10px', borderRadius:20, background:'rgba(74,222,128,0.15)', color:'#4ade80', border:'1px solid rgba(74,222,128,0.3)'}}>Activa</span>}
                </div>
              ))}
              <div style={{...s.card, marginTop:8}}>
                <div style={{fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:14, marginBottom:12}}>Nueva Expo</div>
                <input style={{...s.input, marginBottom:10}} value={newExpoName} onChange={e => setNewExpoName(e.target.value)} placeholder="Nombre de la expo" />
                <input style={{...s.input, marginBottom:14}} value={newExpoLocation} onChange={e => setNewExpoLocation(e.target.value)} placeholder="Ciudad / País" />
                <button onClick={createExpo} style={{...s.btn, ...s.btnPrimary}}>+ Crear y activar</button>
              </div>
            </>
          )}
        </div>
        <div style={s.bottomnav}>
          <button onClick={() => setScreen('home')} style={s.navbtn}>🏠<span>Home</span></button>
          <button onClick={() => setScreen('new-lead')} style={s.navbtn}>➕<span>Nuevo</span></button>
          <button onClick={() => setScreen('leads')} style={s.navbtn}>📋<span>Leads</span></button>
          <button onClick={() => setScreen('admin')} style={{...s.navbtn, color:'#8ba3ff'}}>⚡<span>Admin</span></button>
          <button onClick={logout} style={s.navbtn}>🚪<span>Salir</span></button>
        </div>
      </div>
    )
  }

  return null
}
