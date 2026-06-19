import React, { useState, useRef } from 'react'
import { Icon, czk, linePath, useViewport } from './helpers.jsx'
import Render from './Render.jsx'
import {
  insurersData, brandsData, fleetsData, vehiclesData, claimsData,
  statusMeta, claimStatusMeta, fleetName, statusChip,
} from './data.js'

const ic = (name, size = 18, sw = 1.8) => <Icon name={name} size={size} sw={sw} />

const ROOT_STYLE =
  "--star:#C8102E;--star-soft:#FDECEE;--star-ink:#9B0E25;--blue:#2058C9;--blue-soft:#EAF0FC;" +
  "--blue-ink:#1A47A3;--green:#16A34A;--green-soft:#E7F6ED;--amber:#C2780C;--amber-soft:#FBF1DF;" +
  "--ink:#18181B;--ink2:#5B5B63;--ink3:#8E8E96;--border:#ECECEE;--border2:#E3E3E6;--canvas:#FAFAFA;" +
  "--card:#FFFFFF;--r:14px;display:flex;height:100vh;width:100%;overflow:hidden;color:var(--ink);" +
  "font-family:'Hanken Grotesk',system-ui,sans-serif"

const MONTHS = ['Čvc', 'Srp', 'Zář', 'Říj', 'Lis', 'Pro', 'Led', 'Úno', 'Bře', 'Dub', 'Kvě', 'Čvn']
const INS_COLORS = { Kooperativa: '#2058C9', Allianz: '#16A34A', 'ČPP': '#C2780C', Generali: '#8B5CF6', UNIQA: '#0EA5A5', 'ČSOB': '#9B0E25' }
const DEFAULT_BONUS = [{ threshold: 30, rate: 15 }, { threshold: 40, rate: 10 }, { threshold: 50, rate: 5 }]
const INSURER_CODE = { Kooperativa: '7720', Allianz: '4055', 'ČPP': '0019', Generali: '5544', UNIQA: '2401', 'ČSOB': '8830', 'ČSOB Poj.': '8830' }
const RISK_META = { POV: { bg: 'var(--blue-soft)', c: 'var(--blue-ink)' }, HAV: { bg: 'var(--star-soft)', c: 'var(--star-ink)' }, Skla: { bg: '#E3F4F5', c: '#0E7C86' } }
// Sjednatelná rizika — podíl na pojistném a pravidlo sjednání na vozidlo (deterministicky)
const RISKS = [
  { key: 'pr', label: 'Povinné ručení', icon: 'shield', frac: 0.34, bg: 'var(--star-soft)', color: 'var(--star)', has: () => true },
  { key: 'hav', label: 'Havarijní pojištění', icon: 'car', frac: 0.42, bg: 'var(--star-soft)', color: 'var(--star)', has: (v) => v.status !== 'nocasco' },
  { key: 'skla', label: 'Pojištění skel', icon: 'glass', frac: 0.06, bg: 'var(--blue-soft)', color: 'var(--blue)', has: () => true },
  { key: 'asist', label: 'Asistenční služby', icon: 'wrench', frac: 0.03, bg: 'var(--amber-soft)', color: 'var(--amber)', has: () => true },
  { key: 'gap', label: 'GAP – pojištění finanční ztráty', icon: 'refresh', frac: 0.05, bg: 'var(--green-soft)', color: 'var(--green)', has: (v, i) => v.status !== 'nocasco' && i % 4 !== 3 },
  { key: 'zver', label: 'Střet se zvěří', icon: 'alert', frac: 0.02, bg: 'var(--green-soft)', color: 'var(--green)', has: (v, i) => i % 5 !== 0 },
  { key: 'vandal', label: 'Vandalismus', icon: 'alert', frac: 0.02, bg: '#F1F1F3', color: 'var(--ink2)', has: (v, i) => i % 3 !== 2 },
  { key: 'uraz', label: 'Úrazové pojištění osob', icon: 'user1', frac: 0.02, bg: 'var(--blue-soft)', color: 'var(--blue)', has: (v, i) => i % 2 === 0 },
  { key: 'zivel', label: 'Živelní pojištění', icon: 'alert', frac: 0.015, bg: 'var(--amber-soft)', color: 'var(--amber)', has: (v, i) => i % 3 !== 0 },
  { key: 'zavazadla', label: 'Zavazadla', icon: 'archive', frac: 0.01, bg: '#F1F1F3', color: 'var(--ink2)', has: (v, i) => i % 4 === 0 },
  { key: 'nahradni', label: 'Náhradní vozidlo', icon: 'swap', frac: 0.015, bg: 'var(--blue-soft)', color: 'var(--blue)', has: (v, i) => i % 3 === 1 },
  { key: 'pravni', label: 'Právní ochrana', icon: 'doc2', frac: 0.02, bg: '#F1F1F3', color: 'var(--ink2)', has: () => true },
]
const fleetInsurerPolicy = (insurer, fleetId) => {
  const base = INSURER_CODE[insurer] || '6000'
  const seed = (parseInt((fleetId || 'f1').replace(/\D/g, '') || '1', 10) * 137 + insurer.length * 29 + (insurer.charCodeAt(0) || 65)) % 1000000
  const s = String(seed).padStart(6, '0')
  return `${base} ${s.slice(0, 3)} ${s.slice(3)}`
}
const lrColorFor = (lr) => (lr <= 30 ? 'var(--green)' : lr <= 45 ? 'var(--amber)' : 'var(--star)')

export default function FleetPortal() {
  const [state, setStateRaw] = useState({
    route: 'dashboard',
    fleetId: 'f1', vehicleId: 'v1',
    fleetTab: 'overview', vehicleTab: 'overview', fleetsView: 'grid',
    search: false, notif: false, ai: false, companyMenu: false, sidebar: false,
    claimWizard: false, claimStep: 1, claimData: {},
    rowMenu: null, toast: null,
    unsub: null, unsubDone: false, unsubReason: 'Prodej vozidla', unsubDate: '1. 7. 2026',
    np: false, npData: { name: '', manager: '', insurer: 'Kooperativa', policy: '', start: '1. 7. 2026', vehicles: '' },
    newFleets: [],
    docCat: null, docOpen: {}, docPreview: null,
    av: false, avStep: 1, avMethod: 'spz', avInput: '', avLoaded: false, avLoading: false, avFleet: 'f1',
    avCover: { pr: true, hav: true, skla: true, uraz: false, zavazadla: false, zver: true, nahradni: false, strojni: false, gap: false, zivel: false, asist: true, prac: false },
    avHavRozsah: 'allrisk', avHavSpoluucast: '5% / 5 000 Kč', avPrLimit: '100 / 100 mil. Kč', avUziti: 'Běžné užití',
    vf: { fleet: 'all', brand: 'all', fuel: 'all', insurer: 'all', status: 'all', q: '' },
    selected: {},
    pref: { renewal: true, claim: true, docs: true, email: true, sms: false },
    cwType: 'Havárie', cwVehicle: 'v1',
    searchQuery: '',
    aiInput: '',
    aiMessages: [
      { role: 'ai', text: 'Dobrý den, Martine. Jsem váš fleet asistent. Můžu vyhledávat vozidla, hlídat obnovy nebo nahlásit škodu — stačí napsat.' },
    ],
  })
  const ttRef = useRef(null)
  const vp = useViewport()
  const setState = (patch) => setStateRaw((s) => ({ ...s, ...(typeof patch === 'function' ? patch(s) : patch) }))
  const allFleets = [...fleetsData, ...state.newFleets]

  // ---------- ACTIONS ----------
  const navigate = (route, patch) => setState({ route, ...(patch || {}), search: false, notif: false, companyMenu: false, sidebar: false })
  const openFleet = (id) => navigate('fleet-detail', { fleetId: id, fleetTab: 'overview' })
  const openVehicle = (id) => navigate('vehicle-detail', { vehicleId: id, vehicleTab: 'overview' })
  const toggleNotif = () => setState((s) => ({ notif: !s.notif, companyMenu: false }))
  const toggleAI = () => setState((s) => ({ ai: !s.ai }))
  const openSearch = () => setState({ search: true })
  const closeSearch = () => setState({ search: false })
  const stop = (e) => e.stopPropagation()
  const showToast = (msg) => { if (ttRef.current) clearTimeout(ttRef.current); setState({ toast: msg }); ttRef.current = setTimeout(() => setState({ toast: null }), 3800) }
  const openUnsub = (v) => setState({ rowMenu: null, unsubDone: false, unsubReason: 'Prodej vozidla', unsubDate: '1. 7. 2026', unsub: { plate: v.plate, brand: v.brand, model: v.model, vin: v.vin, fleetName: fleetName(v.fleet), insurer: v.insurer, premiumF: czk(v.premium), renewal: v.renewal } })
  const buildClaimRow = (c) => {
    const cm = claimStatusMeta[c.status]
    const v = vehiclesData.find((x) => x.id === c.vId) || {}
    const rm = RISK_META[c.risk] || { bg: '#F1F1F3', c: 'var(--ink2)' }
    return {
      id: c.id, type: c.type, risk: c.risk, reportedBy: c.reportedBy, date: c.date, insurer: c.insurer,
      plate: v.plate || '—', vin: v.vin || '—', brand: v.brand || '', model: v.model || '',
      estimateF: czk(c.estimate), paid: c.payout > 0, payoutF: c.payout > 0 ? czk(c.payout) : '—',
      statusLabel: cm.label, bg: cm.bg, color: cm.c,
      chipStyle: `display:inline-flex;align-items:center;font-size:11.5px;font-weight:600;color:${cm.c};background:${cm.bg};padding:3px 9px;border-radius:20px;white-space:nowrap`,
      riskStyle: `display:inline-flex;align-items:center;font-size:11px;font-weight:700;color:${rm.c};background:${rm.bg};padding:3px 8px;border-radius:6px;white-space:nowrap`,
      onClick: () => openVehicle(c.vId),
    }
  }
  const setVf = (k, v) => setState((s) => ({ vf: { ...s.vf, [k]: v } }))
  const toggleSel = (id) => setState((s) => { const n = { ...s.selected }; if (n[id]) delete n[id]; else n[id] = true; return { selected: n } })

  const aiReply = (q) => {
    const l = q.toLowerCase()
    if (l.includes('obnov') || l.includes('renew')) return '34 vozidel má obnovu do 30 dnů. Nejbližší: Škoda Scala (2SC 7790) — 20. 6. Chcete je zobrazit ve filtru?'
    if (l.includes('nejvíc') || l.includes('nejdráž') || l.includes('cost')) return 'Nejnákladnější park je Praha – Centrála s ročním pojistným 4,28 mil. Kč (84 vozidel). Druhý je Dlouhodobý pronájem (3,05 mil. Kč).'
    if (l.includes('gap')) return 'Našel jsem 41 vozidel bez plného krytí. 12 z nich nemá GAP — převážně v parku Brno. Mám připravit hromadnou nabídku?'
    if (l.includes('škod') || l.includes('damage') || l.includes('nehod')) return 'Spustil jsem průvodce nahlášením škody. Vyberte vozidlo a popište událost — zbytek doplním z dat parku.'
    if (l.includes('claim') || l.includes('událost')) return 'Aktuálně je 9 otevřených událostí. Nejvyšší odhad: Audi A6 — odcizení kol, 58 000 Kč (Generali, v likvidaci).'
    if (l.includes('úspor') || l.includes('saving')) return 'Oproti loňsku šetříte 1,84 mil. Kč (−11 %). Konsolidací havarijního u Kooperativy lze ušetřit dalších ~320 000 Kč ročně.'
    return 'Rozumím. Pracuji s daty 312 vozidel napříč 6 parky. Zkuste např. „Najdi vozidla bez GAP" nebo „Který park stojí nejvíc?".'
  }
  const sendAi = (t) => {
    const q = (typeof t === 'string' ? t : state.aiInput).trim()
    if (!q) return
    const reply = aiReply(q)
    setState((s) => ({ aiInput: '', aiMessages: [...s.aiMessages, { role: 'user', text: q }, { role: 'ai', text: reply }] }))
  }

  // ---------- VIEW MODELS ----------
  const newFleetVM = () => {
    const d = state.npData
    const setField = (k, v) => setState((s) => ({ npData: { ...s.npData, [k]: v } }))
    const create = () => {
      const id = 'fn' + (state.newFleets.length + 1)
      const nf = {
        id,
        name: d.name.trim() || 'Nový vozový park',
        manager: d.manager.trim() || '—',
        vehicles: parseInt(d.vehicles, 10) || 0,
        premium: 0, claims: 0, risk: 100,
        insurers: [d.insurer], renewals: 0,
        policy: d.policy.trim() || '—', policyStart: d.start,
      }
      setState((s) => ({ newFleets: [...s.newFleets, nf], np: false }))
      navigate('fleet-detail', { fleetId: id, fleetTab: 'overview' })
      showToast(`Vozový park „${nf.name}" byl vytvořen · flotilová smlouva ${nf.policy}.`)
    }
    return {
      np: state.np,
      openNewFleet: () => setState({ np: true, npData: { name: '', manager: '', insurer: 'Kooperativa', policy: '', start: '1. 7. 2026', vehicles: '' } }),
      nf: {
        close: () => setState({ np: false }), stop: (e) => e.stopPropagation(), create,
        canCreate: d.name.trim().length > 0,
        broker: 'Robert Harlas, IS Group, spol. s r.o.',
        insurerOpts: ['Kooperativa', 'Allianz', 'ČPP', 'Generali', 'UNIQA', 'ČSOB Poj.'],
        name: d.name, manager: d.manager, insurer: d.insurer, policy: d.policy, start: d.start, vehicles: d.vehicles,
        onName: (e) => setField('name', e.target.value),
        onManager: (e) => setField('manager', e.target.value),
        onInsurer: (e) => setField('insurer', e.target.value),
        onPolicy: (e) => setField('policy', e.target.value),
        onStart: (e) => setField('start', e.target.value),
        onVehicles: (e) => setField('vehicles', e.target.value),
      },
    }
  }

  const shellVM = () => {
    const r = state.route
    const navItems = [
      ['dashboard', 'Přehled', 'dashboard', null],
      ['fleets', 'Vozové parky', 'fleets', null],
      ['vehicles', 'Vozidla', 'car', '312'],
      ['insurance', 'Pojištění', 'shield', null],
      ['claims', 'Škody', 'alert', '9'],
      ['documents', 'Dokumenty', 'file', null],
      ['bonifikace', 'Bonifikace', 'percent', null],
      ['contacts', 'Kontakty', 'users', null],
      ['analytics', 'Analytika', 'chart', null],
      ['settings', 'Nastavení', 'settings', null],
    ]
    const activeRoute = r === 'fleet-detail' ? 'fleets' : r === 'vehicle-detail' ? 'vehicles' : r === 'bonifikace-detail' ? 'bonifikace' : r === 'documents-detail' ? 'documents' : r
    const nav = navItems.map(([id, label, icon, badge]) => {
      const on = activeRoute === id
      return {
        id, label, icon: ic(icon, 18), iconColor: on ? 'var(--blue)' : '#8E8E96',
        onClick: () => navigate(id),
        style: `display:flex;align-items:center;gap:11px;padding:9px 11px;margin:2px 0;border-radius:10px;font-size:13.5px;font-weight:${on ? '600' : '500'};cursor:pointer;color:${on ? 'var(--blue-ink)' : '#3F3F46'};background:${on ? 'var(--blue-soft)' : 'transparent'}`,
        badge, badgeStyle: `font-size:11px;font-weight:700;color:${on ? 'var(--blue)' : '#8E8E96'};background:${on ? '#fff' : '#F1F1F3'};padding:1px 7px;border-radius:20px`,
      }
    })
    const titles = {
      dashboard: ['Přehled', 'Souhrn vozového parku Louda Auto'],
      fleets: ['Vozové parky', '6 parků · 312 vozidel'],
      vehicles: ['Vozidla', '312 vozidel celkem'],
      insurance: ['Pojištění', 'Smlouvy a krytí napříč parky'],
      claims: ['Škody', '9 otevřených · 47 uzavřených letos'],
      documents: ['Dokumenty', 'Centrální úložiště dokumentů'],
      'documents-detail': ['Pojistné smlouvy', 'Flotilové smlouvy a jejich dokumenty'],
      bonifikace: ['Bonifikace', 'Vrácení části pojistného dle škodního průběhu'],
      contacts: ['Kontakty', 'Manažeři, řidiči, partneři'],
      analytics: ['Analytika', 'Náklady, trendy a úspory'],
      settings: ['Nastavení', 'Profil a předvolby portálu'],
    }
    let title, sub
    if (r === 'fleet-detail') { const f = allFleets.find((x) => x.id === state.fleetId); title = f.name; sub = `Fleet manager · ${f.manager} · ${f.vehicles} vozidel` }
    else if (r === 'vehicle-detail') { const v = vehiclesData.find((x) => x.id === state.vehicleId); title = `${v.brand} ${v.model}`; sub = `${v.plate} · ${fleetName(v.fleet)}` }
    else if (r === 'bonifikace-detail') { const f = allFleets.find((x) => x.id === state.fleetId) || allFleets[0]; title = `Bonifikace · ${f.insurers[0]}`; sub = `Flotilová smlouva č. ${f.policy || '—'}` }
    else if (r === 'documents-detail') { const tm = { zk: ['Zelené karty', 'Zelená karta ke každému vozidlu'], orv: ['Technické průkazy', 'Osvědčení o registraci vozidla (ORV)'] }; const t = tm[state.docCat] || ['Pojistné smlouvy', 'Flotilové smlouvy a jejich dokumenty']; title = t[0]; sub = t[1] }
    else { const t = titles[r] || ['', '']; title = t[0]; sub = t[1] }

    const aiMessages = state.aiMessages.map((m) => ({
      text: m.text,
      wrap: `display:flex;justify-content:${m.role === 'user' ? 'flex-end' : 'flex-start'}`,
      bubble: m.role === 'user'
        ? 'max-width:80%;background:var(--blue);color:#fff;padding:9px 13px;border-radius:14px 14px 4px 14px;font-size:13px;line-height:1.5'
        : 'max-width:84%;background:#fff;border:1px solid var(--border);padding:9px 13px;border-radius:14px 14px 14px 4px;font-size:13px;line-height:1.5;color:#27272A',
    }))
    const aiChips = [
      { text: 'Obnovy tento měsíc', onClick: () => sendAi('Ukaž vozidla s obnovou tento měsíc') },
      { text: 'Který park stojí nejvíc?', onClick: () => sendAi('Který park stojí nejvíc?') },
      { text: 'Vozidla bez GAP', onClick: () => sendAi('Najdi vozidla bez GAP') },
      { text: 'Nahlásit škodu', onClick: () => sendAi('Chci nahlásit škodu') },
    ]
    const notifs = [
      { icon: ic('refresh', 16), bg: 'var(--amber-soft)', color: 'var(--amber)', title: '34 vozidel čeká na obnovu', sub: 'Nejbližší Škoda Scala (2SC 7790) · 20. 6.', time: 'před 1 h', unread: true },
      { icon: ic('alert', 16), bg: 'var(--star-soft)', color: 'var(--star)', title: 'Nová pojistná událost', sub: 'BMW 320d (2BM 5567) · parkovací škoda', time: 'před 5 h', unread: true },
      { icon: ic('file', 16), bg: 'var(--blue-soft)', color: 'var(--blue)', title: 'Chybí zelená karta', sub: 'Hyundai Tucson (6HY 3320)', time: 'včera', unread: true },
      { icon: ic('shield', 16), bg: 'var(--green-soft)', color: 'var(--green)', title: 'Smlouva obnovena', sub: 'VW Transporter · povinné ručení ČSOB', time: 'včera', unread: false },
    ]
    const q = state.searchQuery.toLowerCase()
    let res = []
    vehiclesData.forEach((v) => res.push({ kind: 'Vozidlo', title: `${v.brand} ${v.model}`, sub: `${v.plate} · ${v.driver}`, icon: ic('car', 16), bg: '#F1F1F3', color: '#5B5B63', onClick: () => openVehicle(v.id), q: `${v.brand} ${v.model} ${v.plate} ${v.driver}`.toLowerCase() }))
    allFleets.forEach((f) => res.push({ kind: 'Park', title: f.name, sub: `${f.vehicles} vozidel · ${f.manager}`, icon: ic('fleets', 16), bg: 'var(--blue-soft)', color: 'var(--blue)', onClick: () => openFleet(f.id), q: `${f.name} ${f.manager}`.toLowerCase() }))
    claimsData.forEach((c) => res.push({ kind: 'Událost', title: c.id, sub: `${c.vehicle} · ${c.type}`, icon: ic('alert', 16), bg: 'var(--star-soft)', color: 'var(--star)', onClick: () => navigate('claims'), q: `${c.id} ${c.vehicle} ${c.type}`.toLowerCase() }))
    if (q) res = res.filter((x) => x.q.includes(q))
    res = res.slice(0, 7)

    return {
      vp, sidebarOpen: state.sidebar, toggleSidebar: () => setState((s) => ({ sidebar: !s.sidebar })), closeSidebar: () => setState({ sidebar: false }),
      nav, pageTitle: title, pageSubtitle: sub, route: r,
      isDashboard: r === 'dashboard', isFleets: r === 'fleets', isFleetDetail: r === 'fleet-detail',
      isVehicles: r === 'vehicles', isVehicleDetail: r === 'vehicle-detail',
      isInsurance: r === 'insurance', isClaims: r === 'claims', isDocuments: r === 'documents', isAnalytics: r === 'analytics', isContacts: r === 'contacts', isSettings: r === 'settings',
      isDocumentsDetail: r === 'documents-detail',
      openDocCat: (cat) => navigate('documents-detail', { docCat: cat, docOpen: {} }), goDocuments: () => navigate('documents'),
      docPreview: state.docPreview, closeDocPreview: () => setState({ docPreview: null }),
      isBonifikace: r === 'bonifikace', isBonifikaceDetail: r === 'bonifikace-detail',
      openBonus: (id) => navigate('bonifikace-detail', { fleetId: id }), goBonifikace: () => navigate('bonifikace'),
      claimWizard: state.claimWizard, closeClaimWizard: () => setState({ claimWizard: false }),
      toast: state.toast, rowMenuOpen: state.rowMenu !== null, closeRowMenu: () => setState({ rowMenu: null }),
      unsub: state.unsub, unsubDone: state.unsubDone, unsubReason: state.unsubReason, unsubDate: state.unsubDate,
      closeUnsub: () => setState({ unsub: null }),
      setUnsubReason: (e) => setState({ unsubReason: e.target.value }),
      setUnsubDate: (e) => setState({ unsubDate: e.target.value }),
      submitUnsub: () => setState({ unsubDone: true }),
      unsubReasons: ['Prodej vozidla', 'Vyřazení z provozu', 'Totální škoda', 'Ukončení leasingu / úvěru', 'Převod na jiného provozovatele', 'Jiný důvod'],
      unsubApprover: { name: 'Ing. Tomáš Bartoš', role: 'Vedoucí správy vozového parku · Louda Auto a.s.', initials: 'TB' },
      goFleets: () => navigate('fleets'),
      openClaimWizard: () => setState({ claimWizard: true, claimStep: 1, claimData: {} }),
      av: state.av, openAddVehicle: () => setState({ av: true, avStep: 1, avMethod: 'spz', avInput: '', avLoaded: false, avFleet: state.fleetId }),
      ...newFleetVM(),
      companyMenu: state.companyMenu, notif: state.notif, ai: state.ai, search: state.search,
      searchQuery: state.searchQuery, searchResults: res,
      aiMessages, aiChips, aiInput: state.aiInput, notifs,
      toggleNotif, toggleAI, openSearch, closeSearch,
      onSearchInput: (e) => setState({ searchQuery: e.target.value }),
      onAiInput: (e) => setState({ aiInput: e.target.value }),
      onAiKey: (e) => { if (e.key === 'Enter') sendAi() },
      sendAi: () => sendAi(), stop, goVehicles: () => navigate('vehicles'),
    }
  }

  const dashboardVM = () => {
    if (state.route !== 'dashboard') return {}
    const khero = [
      { icon: ic('fleets', 20), iconBg: 'var(--blue-soft)', iconColor: 'var(--blue)', value: '6', label: 'Vozové parky', sub: 'aktivních parků', delta: '+1 letos', deltaStyle: 'font-size:11.5px;font-weight:700;color:var(--blue);background:var(--blue-soft);padding:3px 8px;border-radius:20px' },
      { icon: ic('car', 20), iconBg: '#F1F1F3', iconColor: '#3F3F46', value: '312', label: 'Vozidla celkem', sub: 'pojištěných vozidel', delta: '+18 / Q', deltaStyle: 'font-size:11.5px;font-weight:700;color:var(--green);background:var(--green-soft);padding:3px 8px;border-radius:20px' },
      { icon: ic('shield', 20), iconBg: 'var(--star-soft)', iconColor: 'var(--star)', value: '14,91 mil.', label: 'Roční pojistné', sub: 'předepsané ročně (Kč)', delta: '−11 % r/r', deltaStyle: 'font-size:11.5px;font-weight:700;color:var(--green);background:var(--green-soft);padding:3px 8px;border-radius:20px' },
      { icon: ic('alert', 20), iconBg: 'var(--amber-soft)', iconColor: 'var(--amber)', value: '23', label: 'Aktivní události', sub: '9 otevřených', delta: '+3 / měsíc', deltaStyle: 'font-size:11.5px;font-weight:700;color:var(--star);background:var(--star-soft);padding:3px 8px;border-radius:20px' },
    ]
    const kstat = [
      { label: 'Měsíční pojistné', value: '1,24 mil.', accent: 'var(--ink)' },
      { label: 'Obnovy do 30 dnů', value: '34', accent: 'var(--amber)' },
      { label: 'Rizikové skóre parku', value: '68/100', accent: 'var(--ink)' },
      { label: 'Úspora vs. loni', value: '1,84 mil.', accent: 'var(--green)' },
      { label: 'Ø pojistné / vozidlo', value: '47 788', accent: 'var(--ink)' },
      { label: 'Vozidla bez krytí', value: '41', accent: 'var(--star)' },
    ]
    const pv = [1.05, 1.07, 1.09, 1.10, 1.13, 1.15, 1.18, 1.17, 1.20, 1.22, 1.21, 1.24]
    const pp = linePath(pv, 600, 180, 16)
    const cb = [3, 2, 4, 1, 3, 2, 5, 3, 4, 2, 3, 2]; const cbMax = Math.max(...cb)
    const claimBars = cb.map((v, i) => ({ h: Math.round(v / cbMax * 100) + '%', color: i >= 10 ? 'var(--star)' : '#E3B7BE', label: MONTHS[i][0] }))
    let acc = 0; const segs = insurersData.map((i) => { const a = acc; acc += i.pct / 100 * 360; return `${i.color} ${a}deg ${acc}deg` })
    const insurerDonut = `conic-gradient(${segs.join(',')})`
    const brands = brandsData.map((b) => ({ ...b, w: Math.round(b.pct / 40 * 100) + '%' }))
    const attention = vehiclesData.filter((v) => v.status !== 'active').slice(0, 5).map((v) => {
      const m = statusMeta[v.status]
      return { title: `${v.brand} ${v.model}`, sub: `${v.plate} · ${fleetName(v.fleet)} · ${v.driver}`, chip: m.label, chipStyle: statusChip(v.status), onClick: () => openVehicle(v.id) }
    })
    const activity = [
      { actor: 'Škoda Octavia (5SK 8841)', action: 'přidána do parku Praha – Centrála', time: 'před 2 h', color: 'var(--blue)' },
      { actor: 'BMW 320d (2BM 5567)', action: 'nahlášena pojistná událost – parkovací škoda', time: 'před 5 h', color: 'var(--star)' },
      { actor: 'VW Transporter (4VW 8800)', action: 'obnoveno povinné ručení (ČSOB)', time: 'včera', color: 'var(--green)' },
      { actor: 'Audi A6 (8EX 7733)', action: 'změněn řidič na Jan Kučera', time: 'včera', color: '#A1A1AA' },
      { actor: 'Tesla Model 3 (1EV 9087)', action: 'nahrána zelená karta', time: 'před 2 dny', color: 'var(--blue)' },
      { actor: 'Škoda Fabia (3FA 1180)', action: 'vyřazena z parku Brno', time: 'před 2 dny', color: '#A1A1AA' },
      { actor: 'Hyundai Tucson (6HY 3320)', action: 'přidáno havarijní pojištění (Generali)', time: 'před 3 dny', color: 'var(--amber)' },
    ]
    return { khero, kstat, premiumLine: pp.line, premiumArea: pp.area, months: MONTHS, claimBars, insurerDonut, insurers: insurersData, brands, attention, activity }
  }

  const fleetsVM = () => {
    if (state.route !== 'fleets') return {}
    const riskColor = (r) => r >= 75 ? 'var(--green)' : r >= 62 ? 'var(--amber)' : 'var(--star)'
    const fleetCards = allFleets.map((f) => ({
      name: f.name, manager: f.manager, vehicles: f.vehicles, policy: f.policy || '—',
      premium: (f.premium / 1000000).toFixed(2).replace('.', ',') + ' mil.',
      claims: f.claims, risk: f.risk, riskColor: riskColor(f.risk),
      renewals: f.renewals, renewalsShow: f.renewals > 0, insurers: f.insurers,
      onClick: () => openFleet(f.id),
    }))
    return { fleetCards, fleetsView: state.fleetsView, setFleetsView: (v) => setState({ fleetsView: v }) }
  }

  const fleetDetailVM = () => {
    if (state.route !== 'fleet-detail') return {}
    const f = allFleets.find((x) => x.id === state.fleetId) || allFleets[0]
    const tab = state.fleetTab
    const riskColor = (r) => r >= 75 ? 'var(--green)' : r >= 62 ? 'var(--amber)' : 'var(--star)'
    const stats = [
      { label: 'Vozidla', value: String(f.vehicles), color: 'var(--ink)' },
      { label: 'Roční pojistné', value: (f.premium / 1000000).toFixed(2).replace('.', ',') + ' mil.', color: 'var(--ink)' },
      { label: 'Ø / vozidlo', value: Math.round(f.premium / (f.vehicles || 1)).toLocaleString('cs-CZ'), color: 'var(--ink)' },
      { label: 'Škodní průběh', value: (f.lossRatio ?? Math.round(f.claims / (f.vehicles || 1) * 100 * 4)) + ' %', color: lrColorFor(f.lossRatio ?? 50) },
      { label: 'Rizikové skóre', value: f.risk + '/100', color: riskColor(f.risk) },
    ]
    const tabsDef = [['overview', 'Přehled'], ['vehicles', 'Vozidla'], ['insurers', 'Pojistitelé'], ['insurance', 'Pojištění'], ['claims', 'Škody'], ['documents', 'Dokumenty'], ['analytics', 'Analytika'], ['timeline', 'Timeline']]
    const fleetTabs = tabsDef.map(([id, label]) => { const on = tab === id; return { label, onClick: () => setState({ fleetTab: id }), style: `padding:10px 14px;font-size:13.5px;font-weight:600;cursor:pointer;color:${on ? 'var(--blue-ink)' : 'var(--ink3)'};border-bottom:2px solid ${on ? 'var(--blue)' : 'transparent'};margin-bottom:-1px` } })
    const summary = [
      { label: 'Předepsané pojistné', value: (f.premium / 1000000).toFixed(2).replace('.', ',') + ' mil.', sub: 'ročně', color: 'var(--ink)' },
      { label: 'Pojistné události', value: String(f.claims), sub: 'za 12 měsíců', color: 'var(--ink)' },
      { label: 'Ø pojistné / vozidlo', value: Math.round(f.premium / (f.vehicles || 1)).toLocaleString('cs-CZ'), sub: 'Kč ročně', color: 'var(--ink)' },
      { label: 'Obnovy do 30 dnů', value: String(f.renewals), sub: 'smluv', color: 'var(--amber)' },
    ]
    const base = f.premium / 12 / 1000
    const lv = [0.9, 0.93, 0.95, 0.97, 1.0, 1.02, 1.04, 1.03, 1.06, 1.08, 1.07, 1.1].map((x) => x * base)
    const lp = linePath(lv, 600, 170, 16)
    const ins = f.insurers
    const insPcts = ins.length === 1 ? [100] : ins.length === 2 ? [62, 38] : [50, 30, 20]
    let acc = 0; const segs = ins.map((n, i) => { const a = acc; acc += insPcts[i] / 100 * 360; return `${INS_COLORS[n] || '#A1A1AA'} ${a}deg ${acc}deg` })
    const donut = `conic-gradient(${segs.join(',')})`
    const insurerLegend = ins.map((n, i) => ({ name: n, pct: insPcts[i], color: INS_COLORS[n] || '#A1A1AA' }))
    const fuel = [{ name: 'Diesel', pct: 54, color: '#3F3F46' }, { name: 'Benzín', pct: 24, color: '#C2780C' }, { name: 'Elektro', pct: 14, color: '#16A34A' }, { name: 'Hybrid', pct: 8, color: '#2058C9' }].map((x) => ({ ...x, w: x.pct + '%' }))
    const evPct = 22
    const evDonut = `conic-gradient(var(--green) 0deg ${evPct / 100 * 360}deg, #EDEDF0 ${evPct / 100 * 360}deg 360deg)`
    const cb = [2, 1, 3, 0, 2, 1, 3, 2]; const cbm = Math.max(...cb, 1)
    const claimBars = cb.map((v, i) => ({ h: Math.round(v / cbm * 100) + '%', color: i >= 6 ? 'var(--star)' : '#E3B7BE' }))
    const open = state.rowMenu
    const fleetVehicles = vehiclesData.filter((v) => v.fleet === f.id && v.status !== 'ended').map((v) => {
      const mo = open === v.id
      return {
        id: v.id, plate: v.plate, brand: v.brand, model: v.model, driver: v.driver, year: v.year, fuel: v.fuel, insurer: v.insurer,
        vin: v.vin, prihlaska: v.prihlaska,
        premiumF: czk(v.premium), statusLabel: statusMeta[v.status].label, chipStyle: statusChip(v.status),
        onClick: () => openVehicle(v.id),
        menuOpen: mo, stop: (e) => e.stopPropagation(),
        rowStyle: `position:relative;z-index:${mo ? 30 : 'auto'};background:${mo ? '#FAFAFA' : 'transparent'};display:flex;align-items:center;gap:14px;padding:12px 18px;border-bottom:1px solid var(--border)`,
        kebabStyle: `width:30px;height:30px;flex-shrink:0;border-radius:8px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:${mo ? 'var(--blue)' : 'var(--ink3)'};background:${mo ? 'var(--blue-soft)' : 'transparent'}`,
        toggleMenu: (e) => { e.stopPropagation(); setState((s) => ({ rowMenu: s.rowMenu === v.id ? null : v.id })) },
        changeCover: (e) => { e.stopPropagation(); setState({ rowMenu: null }); openVehicle(v.id); setState({ vehicleTab: 'insurance' }) },
        reportClaim: (e) => { e.stopPropagation(); setState({ rowMenu: null, claimWizard: true, claimStep: 1, claimData: { vehicleId: v.id } }) },
        unsubscribe: (e) => { e.stopPropagation(); openUnsub(v) },
      }
    })
    const fleetEnded = vehiclesData.filter((v) => v.fleet === f.id && v.status === 'ended').map((v) => ({
      id: v.id, plate: v.plate, brand: v.brand, model: v.model, driver: v.driver, year: v.year, fuel: v.fuel,
      fleetName: fleetName(v.fleet), insurer: v.insurer, premiumF: czk(v.premium), endedDate: v.endedDate, endReason: v.endReason,
      statusLabel: statusMeta[v.status].label, chipStyle: statusChip(v.status), onClick: () => openVehicle(v.id),
    }))

    const pv = vehiclesData.filter((v) => v.fleet === f.id && v.status !== 'ended')
    const grp = {}
    pv.forEach((v) => { if (!grp[v.insurer]) grp[v.insurer] = { count: 0, premium: 0 }; grp[v.insurer].count++; grp[v.insurer].premium += v.premium })
    let parkInsurers = Object.entries(grp).map(([name, x]) => ({ name, policy: fleetInsurerPolicy(name, f.id), count: x.count, premium: x.premium, premiumF: czk(x.premium) })).sort((a, b) => b.premium - a.premium)
    if (parkInsurers.length === 0) parkInsurers = (f.insurers || []).map((name) => ({ name, policy: fleetInsurerPolicy(name, f.id), count: 0, premium: 0, premiumF: czk(0) }))
    const insurersTotalF = czk(parkInsurers.reduce((a, b) => a + b.premium, 0))

    const riskRows = RISKS.map((r) => {
      let count = 0, premium = 0
      pv.forEach((v, i) => { if (r.has(v, i)) { count++; premium += Math.round(v.premium * r.frac) } })
      return { label: r.label, icon: ic(r.icon, 18), bg: r.bg, color: r.color, count, coverage: pv.length ? Math.round(count / pv.length * 100) : 0, premium, premiumF: czk(premium) }
    }).filter((r) => r.count > 0)
    const riskTotalF = czk(riskRows.reduce((a, b) => a + b.premium, 0))

    const otherMap = {
      insurance: ['Pojištění parku', 'Souhrn všech smluv a krytí v tomto parku — přejděte do modulu Pojištění pro detailní práci se smlouvami.', ic('shield', 24)],
      claims: ['Události parku', 'Všech ' + f.claims + ' událostí parku najdete v modulu Pojistné události s filtrem na tento park.', ic('alert', 24)],
      documents: ['Dokumenty parku', 'Smlouvy, zelené karty a faktury vázané na tento park.', ic('file', 24)],
      analytics: ['Analytika parku', 'Detailní TCO, frekvence škod a meziroční srovnání.', ic('chart', 24)],
      timeline: ['Timeline parku', 'Chronologie všech klíčových událostí parku.', ic('clock', 24)],
    }
    const o = otherMap[tab] || ['', '', null]
    return {
      fd: {
        name: f.name, manager: f.manager, policy: f.policy || '—', policyStart: f.policyStart || '—', stats, summary, line: lp.line, area: lp.area, donut, insurerLegend, fuel, evPct, evDonut, claimBars, claims: f.claims,
        vehicles: fleetVehicles, vehicleCount: fleetVehicles.length, goVehiclesTab: () => setState({ fleetTab: 'vehicles' }),
        endedVehicles: fleetEnded, endedCount: fleetEnded.length,
        parkInsurers, insurersTotalF, insurersCount: parkInsurers.length,
        riskRows, riskTotalF, riskCount: riskRows.length, activeCount: pv.length,
        parkClaims: claimsData.filter((c) => { const cv = vehiclesData.find((x) => x.id === c.vId); return cv && cv.fleet === f.id }).map(buildClaimRow),
        isOverview: tab === 'overview', isVehicles: tab === 'vehicles', isInsurers: tab === 'insurers', isInsurance: tab === 'insurance', isClaims: tab === 'claims', isOther: !['overview', 'vehicles', 'insurers', 'insurance', 'claims'].includes(tab),
        otherTitle: o[0], otherDesc: o[1], otherIcon: o[2],
      },
      fleetTabs,
    }
  }

  const vehiclesVM = () => {
    if (state.route !== 'vehicles') return {}
    const vf = state.vf
    const opt = (all, arr) => [{ v: 'all', l: all }, ...arr.map((x) => ({ v: x, l: x }))]
    const vFilters = [
      { value: vf.fleet, onChange: (e) => setVf('fleet', e.target.value), options: [{ v: 'all', l: 'Všechny parky' }, ...fleetsData.map((f) => ({ v: f.id, l: f.name }))] },
      { value: vf.brand, onChange: (e) => setVf('brand', e.target.value), options: opt('Všechny značky', [...new Set(vehiclesData.map((v) => v.brand))]) },
      { value: vf.fuel, onChange: (e) => setVf('fuel', e.target.value), options: opt('Palivo', [...new Set(vehiclesData.map((v) => v.fuel))]) },
      { value: vf.insurer, onChange: (e) => setVf('insurer', e.target.value), options: opt('Pojišťovna', [...new Set(vehiclesData.map((v) => v.insurer))]) },
      { value: vf.status, onChange: (e) => setVf('status', e.target.value), options: [{ v: 'all', l: 'Stav' }, { v: 'active', l: 'Aktivní' }, { v: 'soon', l: 'Brzy obnova' }, { v: 'overdue', l: 'Po splatnosti' }, { v: 'nocasco', l: 'Bez havarijního' }] },
    ]
    const q = vf.q.toLowerCase()
    const matchBase = (v) => {
      if (vf.fleet !== 'all' && v.fleet !== vf.fleet) return false
      if (vf.brand !== 'all' && v.brand !== vf.brand) return false
      if (vf.fuel !== 'all' && v.fuel !== vf.fuel) return false
      if (vf.insurer !== 'all' && v.insurer !== vf.insurer) return false
      if (q && !`${v.plate} ${v.brand} ${v.model} ${v.driver}`.toLowerCase().includes(q)) return false
      return true
    }
    const rows = vehiclesData.filter((v) => v.status !== 'ended' && matchBase(v) && (vf.status === 'all' || v.status === vf.status))
    const endedRows = vehiclesData.filter((v) => v.status === 'ended' && matchBase(v)).map((v) => ({
      id: v.id, plate: v.plate, brand: v.brand, model: v.model, driver: v.driver, year: v.year, fuel: v.fuel,
      fleetName: fleetName(v.fleet), insurer: v.insurer, premiumF: czk(v.premium), endedDate: v.endedDate, endReason: v.endReason,
      statusLabel: statusMeta[v.status].label, chipStyle: statusChip(v.status), onClick: () => openVehicle(v.id),
    }))
    const sel = state.selected
    const open = state.rowMenu
    const vehicleRows = rows.map((v) => {
      const on = !!sel[v.id]
      const mo = open === v.id
      return {
        id: v.id, plate: v.plate, brand: v.brand, model: v.model, driver: v.driver, year: v.year, fuel: v.fuel,
        vin: v.vin, prihlaska: v.prihlaska,
        fleetName: fleetName(v.fleet), insurer: v.insurer, premiumF: czk(v.premium), renewal: v.renewal,
        statusLabel: statusMeta[v.status].label, chipStyle: statusChip(v.status),
        onClick: () => openVehicle(v.id),
        toggle: (e) => { e.stopPropagation(); toggleSel(v.id) },
        checkStyle: `width:18px;height:18px;border-radius:5px;border:1.5px solid ${on ? 'var(--blue)' : '#CFCFD4'};background:${on ? 'var(--blue)' : '#fff'};display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;color:#fff`,
        checkIcon: on ? ic('check', 12, 2.5) : null,
        menuOpen: mo, stop: (e) => e.stopPropagation(),
        rowStyle: `position:relative;z-index:${mo ? 30 : 'auto'};background:${mo ? '#FAFAFA' : 'transparent'};display:flex;align-items:center;gap:14px;padding:12px 18px;border-bottom:1px solid var(--border)`,
        kebabStyle: `width:30px;height:30px;flex-shrink:0;border-radius:8px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:${mo ? 'var(--blue)' : 'var(--ink3)'};background:${mo ? 'var(--blue-soft)' : 'transparent'};border:1px solid ${mo ? 'var(--blue-soft)' : 'transparent'}`,
        toggleMenu: (e) => { e.stopPropagation(); setState((s) => ({ rowMenu: s.rowMenu === v.id ? null : v.id })) },
        changeCover: (e) => { e.stopPropagation(); setState({ rowMenu: null }); openVehicle(v.id); setState({ vehicleTab: 'insurance' }) },
        reportClaim: (e) => { e.stopPropagation(); setState({ rowMenu: null, claimWizard: true, claimStep: 1, claimData: { vehicleId: v.id } }) },
        unsubscribe: (e) => { e.stopPropagation(); openUnsub(v) },
      }
    })
    return { vFilters, vfQuery: vf.q, onVfQuery: (e) => setVf('q', e.target.value), vehicleRows, endedRows, endedCount: endedRows.length, vSelCount: Object.keys(sel).length, clearSel: () => setState({ selected: {} }) }
  }

  const vehicleDetailVM = () => {
    if (state.route !== 'vehicle-detail') return {}
    const v = vehiclesData.find((x) => x.id === state.vehicleId)
    const tab = state.vehicleTab
    const m = statusMeta[v.status]
    const facts = [
      { k: 'Rok výroby', v: String(v.year) }, { k: 'Palivo', v: v.fuel }, { k: 'Nájezd', v: v.mileage },
      { k: 'Pojišťovna', v: v.insurer }, { k: 'Aktuální hodnota', v: v.value },
    ]
    const actions = [
      { label: 'Změnit park', icon: ic('transfer', 20), color: 'var(--blue)' },
      { label: 'Přiřadit řidiče', icon: ic('user1', 20), color: 'var(--blue)' },
      { label: 'Vyměnit vůz', icon: ic('swap', 20), color: 'var(--ink2)' },
      { label: 'Archivovat', icon: ic('archive', 20), color: 'var(--ink2)' },
      { label: 'Odebrat', icon: ic('trash', 20), color: 'var(--star)' },
    ]
    const specs = [
      { k: 'Značka', v: v.brand }, { k: 'Model', v: v.model }, { k: 'VIN', v: v.vin }, { k: 'Číslo přihlášky', v: v.prihlaska },
      { k: 'Rok výroby', v: String(v.year) }, { k: 'Palivo', v: v.fuel }, { k: 'Nájezd', v: v.mileage }, { k: 'Účetní hodnota', v: v.value },
    ]
    const assign = [
      { k: 'Odpovědný řidič', v: v.driver, icon: ic('user1', 18), bg: 'var(--blue-soft)', color: 'var(--blue)' },
      { k: 'Vozový park', v: fleetName(v.fleet), icon: ic('fleets', 18), bg: '#F1F1F3', color: 'var(--ink2)' },
      { k: 'Lokalita', v: fleetName(v.fleet).split(' – ')[0], icon: ic('mapPin', 18), bg: 'var(--green-soft)', color: 'var(--green)' },
      { k: 'Fleet manager', v: fleetsData.find((f) => f.id === v.fleet).manager, icon: ic('users', 18), bg: 'var(--amber-soft)', color: 'var(--amber)' },
    ]
    const pchip = (s) => statusChip(s)
    const products = [
      { name: 'Povinné ručení', icon: ic('shield', 20), bg: 'var(--star-soft)', color: 'var(--star)', insurer: v.insurer, policy: 'PR-' + v.plate.replace(/\s/g, ''), premiumF: czk(Math.round(v.premium * 0.34)), coverage: '200 / 200 mil. Kč', renewal: v.renewal, deductible: '—', status: 'active' },
      { name: 'Havarijní pojištění', icon: ic('car', 20), bg: 'var(--star-soft)', color: 'var(--star)', insurer: v.insurer, policy: 'HAV-' + v.plate.replace(/\s/g, ''), premiumF: czk(Math.round(v.premium * 0.46)), coverage: 'All-risk', renewal: v.renewal, deductible: '5 % / min. 5 000', status: v.status === 'nocasco' ? 'nocasco' : 'active' },
      { name: 'Pojištění skel', icon: ic('glass', 20), bg: 'var(--blue-soft)', color: 'var(--blue)', insurer: v.insurer, policy: 'SKL-' + v.plate.replace(/\s/g, ''), premiumF: czk(Math.round(v.premium * 0.07)), coverage: 'do 30 000 Kč', renewal: v.renewal, deductible: '1 000 Kč', status: 'active' },
      { name: 'GAP pojištění', icon: ic('refresh', 20), bg: 'var(--green-soft)', color: 'var(--green)', insurer: v.insurer, policy: 'GAP-' + v.plate.replace(/\s/g, ''), premiumF: czk(Math.round(v.premium * 0.08)), coverage: 'pořizovací cena 5 let', renewal: v.renewal, deductible: '—', status: v.id === 'v9' || v.id === 'v16' ? 'nocasco' : 'active' },
      { name: 'Asistenční služby', icon: ic('wrench', 20), bg: 'var(--amber-soft)', color: 'var(--amber)', insurer: 'Global Assistance', policy: 'AS-' + v.plate.replace(/\s/g, ''), premiumF: czk(Math.round(v.premium * 0.03)), coverage: 'ČR + Evropa', renewal: v.renewal, deductible: '—', status: 'active' },
      { name: 'Právní ochrana', icon: ic('doc2', 20), bg: '#F1F1F3', color: 'var(--ink2)', insurer: 'D.A.S.', policy: 'PO-' + v.plate.replace(/\s/g, ''), premiumF: czk(Math.round(v.premium * 0.02)), coverage: 'do 1 mil. Kč', renewal: v.renewal, deductible: '—', status: 'active' },
    ].map((p) => ({ ...p, statusLabel: statusMeta[p.status].label, chipStyle: pchip(p.status) }))
    const claims = claimsData.filter((c) => c.vId === v.id).map((c) => {
      const cm = claimStatusMeta[c.status]
      return { ...c, statusLabel: cm.label, chipStyle: `display:inline-flex;align-items:center;font-size:11.5px;font-weight:600;color:${cm.c};background:${cm.bg};padding:3px 9px;border-radius:20px`, dot: cm.c, estimateF: czk(c.estimate), progressW: c.progress + '%' }
    })
    const timeline = [
      { date: v.renewal, title: 'Obnova povinného ručení', desc: v.insurer + ' · automatické prodloužení', icon: ic('refresh', 16), bg: 'var(--amber-soft)', color: 'var(--amber)' },
      { date: '12. 3. 2026', title: 'Pravidelný servis', desc: 'Výměna oleje a filtrů · ' + v.mileage, icon: ic('wrench', 16), bg: '#F1F1F3', color: 'var(--ink2)' },
      { date: '5. 2. 2026', title: 'STK + emise', desc: 'Platná do 5. 2. 2028', icon: ic('check2', 16), bg: 'var(--green-soft)', color: 'var(--green)' },
      { date: '18. 11. 2025', title: 'Změna řidiče', desc: 'Nový řidič ' + v.driver, icon: ic('user1', 16), bg: 'var(--blue-soft)', color: 'var(--blue)' },
      { date: '3. 4. ' + v.year, title: 'Vozidlo přidáno', desc: 'Zařazeno do parku ' + fleetName(v.fleet), icon: ic('plus', 16), bg: 'var(--blue-soft)', color: 'var(--blue)' },
    ]
    const tabsDef = [['overview', 'Přehled'], ['insurance', 'Pojištění'], ['claims', 'Škody'], ['documents', 'Dokumenty'], ['timeline', 'Timeline'], ['costs', 'Náklady'], ['notes', 'Poznámky']]
    const vehicleTabs = tabsDef.map(([id, label]) => { const on = tab === id; return { label, onClick: () => setState({ vehicleTab: id }), style: `padding:10px 14px;font-size:13.5px;font-weight:600;cursor:pointer;color:${on ? 'var(--blue-ink)' : 'var(--ink3)'};border-bottom:2px solid ${on ? 'var(--blue)' : 'transparent'};margin-bottom:-1px` } })
    const otherMap = {
      documents: ['Dokumenty vozidla', 'Velký a malý technický průkaz, zelená karta, smlouvy a faktury k tomuto vozidlu.', ic('file', 24)],
      costs: ['Náklady & TCO', 'Celkové náklady vlastnictví: pojistné, servis, palivo a amortizace v čase.', ic('chart', 24)],
      notes: ['Poznámky', 'Interní poznámky fleet manažera k vozidlu.', ic('doc2', 24)],
    }
    const o = otherMap[tab] || ['', '', null]
    return {
      vehicleTabs,
      vd: {
        brand: v.brand, model: v.model, plate: v.plate, driver: v.driver, fleetName: fleetName(v.fleet),
        statusLabel: m.label, chipStyle: statusChip(v.status), facts, actions, specs, assign, products, claims, timeline,
        premiumF: czk(v.premium), productCount: products.filter((p) => p.status !== 'nocasco').length, renewal: v.renewal,
        isOverview: tab === 'overview', isInsurance: tab === 'insurance', isClaims: tab === 'claims', isTimeline: tab === 'timeline',
        isOther: ['documents', 'costs', 'notes'].includes(tab), otherTitle: o[0], otherDesc: o[1], otherIcon: o[2],
      },
    }
  }

  const insuranceVM = () => {
    if (state.route !== 'insurance') return {}
    const insStats = [
      { label: 'Předepsané pojistné', value: '14,91 mil.', sub: 'Kč ročně', color: 'var(--ink)' },
      { label: 'Aktivních smluv', value: '1 174', sub: 'napříč 6 parky', color: 'var(--ink)' },
      { label: 'Obnovy do 30 dnů', value: '34', sub: 'vyžadují akci', color: 'var(--amber)' },
      { label: 'Možná úspora', value: '320 tis.', sub: 'konsolidací krytí', color: 'var(--green)' },
    ]
    const gb = state.selected.insGroup || 'fleet'
    const insGroupTabs = [['fleet', 'Podle parku'], ['insurer', 'Podle pojišťovny'], ['product', 'Podle produktu']].map(([id, label]) => { const on = gb === id; return { label, onClick: () => setState((s) => ({ selected: { ...s.selected, insGroup: id } })), style: `padding:7px 14px;border-radius:8px;font-size:12.5px;font-weight:600;cursor:pointer;color:${on ? 'var(--ink)' : 'var(--ink3)'};background:${on ? '#fff' : 'transparent'};box-shadow:${on ? '0 1px 3px rgba(0,0,0,.08)' : 'none'}` } })
    const prods = [
      { product: 'Povinné ručení', scope: 'Flotilová smlouva', policy: 'PR-FLEET-01', insurer: 'Kooperativa', premiumF: '4,2 mil.', renewal: '1. 1. 2027', status: 'active' },
      { product: 'Havarijní pojištění', scope: 'All-risk flotila', policy: 'HAV-FLEET-01', insurer: 'Kooperativa', premiumF: '5,8 mil.', renewal: '1. 1. 2027', status: 'active' },
      { product: 'GAP + Asistence', scope: '248 vozidel', policy: 'GAP-FLEET-02', insurer: 'Allianz', premiumF: '1,1 mil.', renewal: '14. 9. 2026', status: 'soon' },
      { product: 'Pojištění skel', scope: 'Celá flotila', policy: 'SKL-FLEET-01', insurer: 'Generali', premiumF: '640 tis.', renewal: '30. 9. 2026', status: 'active' },
    ]
    const pIcon = (n) => n.includes('Povinné') ? ic('shield', 16) : n.includes('Havarijní') ? ic('car', 16) : n.includes('skel') ? ic('glass', 16) : ic('refresh', 16)
    const groupsByFleet = fleetsData.slice(0, 3).map((f, i) => ({
      name: f.name, color: ['#2058C9', '#16A34A', '#C2780C'][i], count: Math.round(f.vehicles * 3.7), premium: (f.premium / 1000000).toFixed(2).replace('.', ',') + ' mil. Kč',
      rows: prods.map((p) => ({ ...p, bg: 'var(--star-soft)', color: 'var(--star)', icon: pIcon(p.product), statusLabel: statusMeta[p.status].label, chipStyle: statusChip(p.status) })).slice(0, 3),
    }))
    return { insStats, insGroupTabs, insGroups: groupsByFleet }
  }

  const claimsVM = () => {
    if (state.route !== 'claims') return {}
    const claimStats = [
      { label: 'Otevřené události', value: '9', color: 'var(--star)' },
      { label: 'Uzavřené (rok)', value: '47', color: 'var(--ink)' },
      { label: 'Ø doba likvidace', value: '18 dní', color: 'var(--ink)' },
      { label: 'Náklady (rok)', value: '1,24 mil.', color: 'var(--ink)' },
    ]
    const cf = [['Praha – Centrála', 12, '#2058C9'], ['Dlouhodobý pronájem', 15, '#3A7BE0'], ['Brno – Pobočka', 9, '#16A34A'], ['Ml. Boleslav', 7, '#C2780C'], ['Servisní vozy', 4, '#8B5CF6'], ['Management', 1, '#A1A1AA']]
    const cfMax = Math.max(...cf.map((x) => x[1]))
    const claimsByFleet = cf.map(([name, count, color]) => ({ name, count, color, w: Math.round(count / cfMax * 100) + '%' }))
    const ct = [5, 4, 6, 3, 5, 4, 7, 4, 6, 3, 4, 2]; const ctMax = Math.max(...ct)
    const claimTrend = ct.map((v, i) => ({ h: Math.round(v / ctMax * 100) + '%', color: i >= 10 ? 'var(--star)' : '#E3B7BE', label: MONTHS[i][0] }))
    const claimRows = claimsData.map(buildClaimRow)
    return { claimStats, claimsByFleet, claimTrend, claimRows }
  }

  const documentsVM = () => {
    if (state.route !== 'documents') return {}
    const F = (name, count, icon, bg, color, onClick) => ({ name, count, icon: ic(icon, 18), bg, color, onClick, nav: !!onClick })
    const docFolders = [
      F('Pojistné smlouvy', 1174, 'shield', 'var(--star-soft)', 'var(--star)', () => navigate('documents-detail', { docCat: 'smlouvy', docOpen: {} })),
      F('Zelené karty', 312, 'doc2', 'var(--green-soft)', 'var(--green)', () => navigate('documents-detail', { docCat: 'zk', docOpen: {} })),
      F('Technické průkazy', 312, 'file', 'var(--blue-soft)', 'var(--blue)', () => navigate('documents-detail', { docCat: 'orv', docOpen: {} })),
      F('Faktury', 486, 'banknote', 'var(--amber-soft)', 'var(--amber)'),
      F('Servisní záznamy', 724, 'wrench', '#F1F1F3', 'var(--ink2)'),
      F('STK & emise', 298, 'check2', 'var(--green-soft)', 'var(--green)'),
      F('Fotodokumentace', 1840, 'camera', 'var(--blue-soft)', 'var(--blue)'),
      F('Likvidace škod', 53, 'alert', 'var(--star-soft)', 'var(--star)'),
    ]
    const Dr = (name, scope, type, date, size, icon, bg, color) => ({ name, scope, type, date, size, icon: ic(icon, 17), bg, color, preview: ic('search', 16), download: ic('arrow', 16) })
    const docRows = [
      Dr('Pojistná smlouva HAV-5SK8841.pdf', 'Škoda Octavia · 5SK 8841', 'Smlouva', '16. 6. 2026', '248 kB', 'shield', 'var(--star-soft)', 'var(--star)'),
      Dr('Zelená karta 1EV9087.pdf', 'Tesla Model 3 · 1EV 9087', 'Zelená karta', '15. 6. 2026', '94 kB', 'doc2', 'var(--green-soft)', 'var(--green)'),
      Dr('Faktura oprava CLM-0142.pdf', 'AutoCentrum Praha', 'Faktura', '12. 6. 2026', '156 kB', 'banknote', 'var(--amber-soft)', 'var(--amber)'),
      Dr('Protokol škody 2BM5567.pdf', 'BMW 320d · parkovací škoda', 'Likvidace', '10. 6. 2026', '1,2 MB', 'alert', 'var(--star-soft)', 'var(--star)'),
      Dr('STK protokol 9ME2201.pdf', 'Mercedes E220d · 9ME 2201', 'STK', '8. 6. 2026', '88 kB', 'check2', 'var(--green-soft)', 'var(--green)'),
      Dr('Servisní list 4VW8800.pdf', 'VW Transporter · 4VW 8800', 'Servis', '5. 6. 2026', '132 kB', 'wrench', '#F1F1F3', 'var(--ink2)'),
    ]
    return { docFolders, docRows }
  }

  const documentsDetailVM = () => {
    if (state.route !== 'documents-detail') return {}
    const goBack = () => navigate('documents')

    if (state.docCat === 'zk' || state.docCat === 'orv') {
      const isZk = state.docCat === 'zk'
      const vehicles = vehiclesData.map((v) => {
        const plateNo = v.plate.replace(/\s/g, '')
        const docName = isZk ? `Zelená karta ${plateNo}.pdf` : `ORV ${plateNo}.pdf`
        const payload = isZk
          ? { kind: 'zk', name: docName, type: 'Zelená karta', size: '94 kB', insurer: v.insurer, plate: v.plate, vin: v.vin, brand: v.brand, model: v.model, validFrom: '1. 1. 2026', validTo: '31. 12. 2026' }
          : { kind: 'orv', name: docName, type: 'Osvědčení o registraci vozidla', size: '118 kB', plate: v.plate, vin: v.vin, brand: v.brand, model: v.model, year: v.year, fuel: v.fuel }
        return {
          id: v.id, plate: v.plate, vin: v.vin, brand: v.brand, model: v.model, driver: v.driver, year: v.year, insurer: v.insurer,
          preview: ic('search', 16), download: ic('arrow', 16),
          openPreview: () => setState({ docPreview: payload }),
        }
      })
      const dd = isZk
        ? { cat: 'zk', vehicles, count: vehicles.length, goBack, banner: 'Zelená karta (mezinárodní karta automobilového pojištění) ke každému vozidlu — náhled a stažení.', docColLabel: 'Zelená karta', badgeLabel: 'ZK platná', iconBg: 'var(--green-soft)', iconColor: 'var(--green)', bannerBg: 'var(--green-soft)', bannerColor: '#15803D' }
        : { cat: 'orv', vehicles, count: vehicles.length, goBack, banner: 'Osvědčení o registraci vozidla (technický průkaz, část I) ke každému vozidlu — náhled a stažení.', docColLabel: 'Technický průkaz', badgeLabel: 'ORV část I', iconBg: 'var(--blue-soft)', iconColor: 'var(--blue)', bannerBg: 'var(--blue-soft)', bannerColor: 'var(--blue-ink)' }
      return { dd }
    }

    const open = state.docOpen
    const contracts = allFleets.map((f) => {
      const isOpen = !!open[f.id]
      const start = f.policyStart || '—'
      const docs = [
        { name: `Pojistná smlouva ${f.policy}.pdf`, type: 'Smlouva', date: start, size: '328 kB', icon: ic('shield', 17), bg: 'var(--star-soft)', color: 'var(--star)' },
        { name: `IPID – ${f.insurers[0]}.pdf`, type: 'IPID', date: start, size: '92 kB', icon: ic('file', 17), bg: 'var(--blue-soft)', color: 'var(--blue)' },
        { name: 'Všeobecné pojistné podmínky.pdf', type: 'VPP', date: start, size: '1,4 MB', icon: ic('doc2', 17), bg: '#F1F1F3', color: 'var(--ink2)' },
        { name: 'Záznam z jednání.pdf', type: 'Záznam', date: start, size: '214 kB', icon: ic('doc2', 17), bg: 'var(--amber-soft)', color: 'var(--amber)' },
        { name: 'Dodatek č. 1 – aktualizace vozidel.pdf', type: 'Dodatek', date: start, size: '146 kB', icon: ic('file', 17), bg: 'var(--green-soft)', color: 'var(--green)' },
      ].map((d) => ({
        ...d, preview: ic('search', 16), download: ic('arrow', 16),
        openPreview: () => setState({ docPreview: { name: d.name, type: d.type, date: d.date, size: d.size, insurer: f.insurers[0], policy: f.policy || '—', fleetName: f.name } }),
      }))
      return {
        id: f.id, insurer: f.insurers[0], policy: f.policy || '—', fleetName: f.name, start,
        docCount: docs.length, docs, isOpen,
        toggle: () => setState((s) => ({ docOpen: { ...s.docOpen, [f.id]: !s.docOpen[f.id] } })),
        chevStyle: `display:flex;color:var(--ink3);transition:transform .15s;transform:rotate(${isOpen ? '180deg' : '0deg'})`,
        headStyle: `display:flex;align-items:center;gap:14px;padding:15px 18px;cursor:pointer;background:${isOpen ? '#FBFBFC' : '#fff'}`,
      }
    })
    return { dd: { cat: 'smlouvy', contracts, count: contracts.length, goBack } }
  }

  const analyticsVM = () => {
    if (state.route !== 'analytics') return {}
    const anStats = [
      { label: 'TCO flotily (rok)', value: '31,4 mil.', delta: '▼ 6 % r/r', dColor: 'var(--green)' },
      { label: 'Náklady na škody', value: '1,24 mil.', delta: '▼ 14 % r/r', dColor: 'var(--green)' },
      { label: 'Frekvence škod', value: '7,4 %', delta: '▼ 1,2 pb', dColor: 'var(--green)' },
      { label: 'Ø oprava', value: '43 200 Kč', delta: '▲ 4 % r/r', dColor: 'var(--star)' },
    ]
    const ins = [1.05, 1.07, 1.09, 1.10, 1.13, 1.15, 1.18, 1.17, 1.20, 1.22, 1.21, 1.24]
    const rep = [0.12, 0.08, 0.15, 0.05, 0.11, 0.07, 0.18, 0.09, 0.14, 0.06, 0.10, 0.05]
    const mx = Math.max(...ins.map((v, i) => v + rep[i]))
    const anBars = ins.map((v, i) => ({ label: MONTHS[i], h1: Math.round(v / mx * 100) + '%', h2: Math.round(rep[i] / mx * 100) + '%' }))
    const anYears = [{ year: '2024', value: '34,8 mil.', w: '100%', color: '#A1A1AA' }, { year: '2025', value: '33,2 mil.', w: '95%', color: '#3A7BE0' }, { year: '2026', value: '31,4 mil.', w: '90%', color: 'var(--green)' }]
    const anMini = [
      { title: 'Úspora vs. trh', value: '12,4 %', sub: 'pod průměrem segmentu', w: '78%', color: 'var(--green)' },
      { title: 'Bonus / malus', value: '+8 stupňů', sub: 'průměr flotily', w: '82%', color: 'var(--blue)' },
      { title: 'Elektrifikace', value: '22 %', sub: 'cíl 35 % do 2028', w: '62%', color: 'var(--green)' },
    ]
    return { anStats, anBars, anYears, anMini }
  }

  const contactsVM = () => {
    if (state.route !== 'contacts') return {}
    const init = (n) => n.split(' ').map((x) => x[0]).slice(0, 2).join('')
    const P = (name, role, phone, email, bg, color) => ({ name, role, phone, email, initials: init(name), bg, color, phoneIcon: ic('phone', 14), mailIcon: ic('file', 14) })
    const contactGroups = [
      { name: 'Fleet manažeři', people: fleetsData.map((f, i) => P(f.manager, f.name, '+420 ' + (602 + i) + ' 1' + (20 + i) + ' ' + (300 + i * 7), f.manager.toLowerCase().replace(/[^a-z]/g, '.') + '@loudaauto.cz', 'var(--blue-soft)', 'var(--blue)')) },
      { name: 'Makléři & poradci', people: [P('Robert Harlas', 'Odpovědný makléř · IS Group, spol. s r.o.', '+420 777 123 456', 'robert.harlas@isgroup.cz', 'var(--star-soft)', 'var(--star)'), P('Petra Veselá', 'Account manager · STAR', '+420 605 998 112', 'petra.vesela@star.cz', 'var(--star-soft)', 'var(--star)')] },
      { name: 'Servisy & opravny', people: [P('AutoCentrum Praha', 'Autorizovaný servis', '+420 244 010 200', 'servis@acpraha.cz', 'var(--green-soft)', 'var(--green)'), P('AutoSklo Express', 'Opravy skel', '+420 800 100 200', 'info@autosklo.cz', 'var(--green-soft)', 'var(--green)'), P('Servis MB Brno', 'Karosárna', '+420 545 221 330', 'brno@servismb.cz', 'var(--green-soft)', 'var(--green)')] },
      { name: 'Likvidátoři & asistence', people: [P('Pavel Říha', 'Likvidátor · Kooperativa', '+420 957 105 105', 'p.riha@koop.cz', 'var(--amber-soft)', 'var(--amber)'), P('Global Assistance', 'Asistenční linka 24/7', '1220', 'dispecink@1220.cz', 'var(--amber-soft)', 'var(--amber)'), P('Nouzová linka', 'Havárie & odtah', '+420 800 124 124', 'sos@loudaauto.cz', 'var(--star-soft)', 'var(--star)')] },
    ]
    return { contactGroups }
  }

  const settingsVM = () => {
    if (state.route !== 'settings') return {}
    const p = state.pref
    const tg = (k) => setState((s) => ({ pref: { ...s.pref, [k]: !s.pref[k] } }))
    const row = (k, title, sub) => { const on = p[k]; return { title, sub, toggle: () => tg(k), trackStyle: `width:42px;height:24px;border-radius:20px;background:${on ? 'var(--blue)' : '#D4D4D8'};padding:2px;cursor:pointer;transition:background .15s;display:flex`, knobStyle: `width:20px;height:20px;border-radius:50%;background:#fff;transition:transform .15s;transform:translateX(${on ? '18px' : '0'})` } }
    const settingRows = [
      row('renewal', 'Obnovy smluv', 'Upozornění 30 dní před obnovou'),
      row('claim', 'Pojistné události', 'Změny stavu likvidace'),
      row('docs', 'Chybějící dokumenty', 'Zelená karta, STK, technický průkaz'),
      row('email', 'E-mailové souhrny', 'Týdenní report stavu flotily'),
      row('sms', 'SMS notifikace', 'Kritické události a havárie'),
    ]
    return { settingRows }
  }

  const bonifikaceVM = () => {
    if (state.route !== 'bonifikace') return {}
    const bonifList = allFleets.map((f) => {
      const bonus = f.bonus || DEFAULT_BONUS
      const lr = f.lossRatio ?? 0
      const tier = bonus.find((x) => lr <= x.threshold)
      const rate = tier ? tier.rate : 0
      return {
        id: f.id,
        insurer: f.insurers[0], policy: f.policy || '—',
        lossRatio: lr, lrColor: lrColorFor(lr),
        rateLabel: tier ? tier.rate + ' %' : '—', rateActive: !!tier,
        rebateF: tier ? czk(Math.round(f.premium * rate / 100)) : '—',
        onClick: () => navigate('bonifikace-detail', { fleetId: f.id }),
      }
    })
    return { bonifList }
  }

  const bonifikaceDetailVM = () => {
    if (state.route !== 'bonifikace-detail') return {}
    const f = allFleets.find((x) => x.id === state.fleetId) || allFleets[0]
    const bonus = f.bonus || DEFAULT_BONUS
    const lr = f.lossRatio ?? 0
    const activeTier = bonus.find((x) => lr <= x.threshold)
    const base = f.premium
    const tiers = bonus.map((t, i) => {
      const active = activeTier && t.threshold === activeTier.threshold
      return {
        label: `Škodní průběh do ${t.threshold} %`,
        desc: `Pojišťovna vrací ${t.rate} % z pojistného`,
        rate: t.rate + ' %', active,
        badge: active ? 'Aktuální pásmo' : '',
        rowStyle: `display:flex;align-items:center;gap:14px;padding:15px 18px;${i < bonus.length - 1 ? 'border-bottom:1px solid var(--border);' : ''}background:${active ? 'var(--green-soft)' : '#fff'}`,
        rateStyle: `font-size:20px;font-weight:800;letter-spacing:-.5px;color:${active ? 'var(--green)' : 'var(--ink2)'}`,
        dotStyle: `width:10px;height:10px;border-radius:50%;flex-shrink:0;background:${active ? 'var(--green)' : '#D4D4D8'}`,
      }
    })
    const activeRate = activeTier ? activeTier.rate : 0
    const rebate = Math.round(base * activeRate / 100)
    return {
      bd: {
        name: f.name, insurer: f.insurers[0], policy: f.policy || '—', policyStart: f.policyStart || '—',
        lossRatio: lr, lrColor: lrColorFor(lr), tiers,
        premiumF: czk(base), rebateF: czk(rebate), hasActive: !!activeTier, activeRate,
        note: activeTier
          ? `Při aktuálním škodním průběhu ${lr} % spadá smlouva do pásma „do ${activeTier.threshold} %" — pojišťovna vrací ${activeTier.rate} % z pojistného, tj. odhadem ${czk(rebate)} ročně.`
          : `Při aktuálním škodním průběhu ${lr} % nárok na bonifikaci nevzniká (přesahuje nejvyšší pásmo ${bonus[bonus.length - 1].threshold} %).`,
        goBack: () => navigate('bonifikace'),
      },
    }
  }

  const addVehicleVM = () => {
    if (!state.av) return {}
    const step = state.avStep; const done = step > 3
    const f = allFleets.find((x) => x.id === state.avFleet) || allFleets[0]
    const labels = ['Zadání vozidla', 'Údaje o vozidle', 'Pojistné krytí']
    const steps = [1, 2, 3].map((i) => ({ color: i <= step ? 'var(--blue)' : '#E8E8EB' }))
    const m = state.avMethod
    const methodDefs = [
      ['spz', 'plate', 'SPZ', 'Zadejte státní poznávací značku'],
      ['doklad', 'upload', 'Technický průkaz', 'Nahrajte fotografii obou stran technického průkazu'],
      ['vin', 'hash', 'VIN', 'Zadejte 17znakový VIN kód vozidla'],
    ]
    const methods = methodDefs.map(([id, icn, title, desc]) => {
      const on = m === id
      return {
        title, desc,
        icon: id === 'spz' ? ic('car', 22) : id === 'doklad' ? ic('upload', 22) : ic('hash', 22),
        iconStyle: `width:46px;height:46px;border-radius:12px;display:flex;align-items:center;justify-content:center;background:${on ? 'var(--blue)' : 'var(--blue-soft)'};color:${on ? '#fff' : 'var(--blue)'}`,
        onClick: () => setState({ avMethod: id, avLoaded: false }),
        style: `border:1.5px solid ${on ? 'var(--blue)' : 'var(--border2)'};background:${on ? 'var(--blue-soft)' : '#fff'};border-radius:14px;padding:18px 16px;cursor:pointer;transition:.12s`,
      }
    })
    const loaded = { brand: 'Škoda', model: 'Octavia Combi 2.0 TDI', plate: m === 'vin' ? '—' : (state.avInput || '5SK 8841').toUpperCase(), vin: 'TMBJJ7NE5P0123456' }
    const fieldVals = [
      ['Značka', 'Škoda', 1], ['Model', 'Octavia Combi', 1], ['Rok výroby', '2023', 1],
      ['Palivo', 'Diesel', 1], ['Objem / výkon', '1 968 cm³ / 110 kW', 1], ['Převodovka', 'Automat DSG', 1],
      ['SPZ', loaded.plate, 0], ['VIN', loaded.vin, 1], ['Hodnota vozidla', '640 000 Kč', 0],
    ]
    const fields = fieldVals.map(([label, value, locked]) => ({ label, value, bg: locked ? '#F7F8FA' : '#fff' }))
    const coverDefs = [
      ['pr', 'Povinné ručení', 'Zákonné pojištění odpovědnosti', [['Limit', state.avPrLimit]]],
      ['hav', 'Havarijní pojištění', 'All-risk krytí vozidla', [['Rozsah', 'All-risk'], ['Spoluúčast', state.avHavSpoluucast]]],
      ['skla', 'Pojištění skel', null, [['Limit', '30 000 Kč']]],
      ['uraz', 'Úrazové pojištění', 'Řidič a posádka', [['Násobek', '3×']]],
      ['zver', 'Střet se zvěří', null, [['Limit', '100 000 Kč']]],
      ['nahradni', 'Náhradní vozidlo', null, [['Limit', '15 dní']]],
      ['zavazadla', 'Zavazadla', null, [['Limit', '20 000 Kč']]],
      ['gap', 'GAP', 'Doplnění hodnoty při totální škodě', null],
      ['zivel', 'Živelní pojištění', null, null],
      ['asist', 'Nadstandardní asistence', 'Odtah, vyproštění, náhradní doprava', null],
      ['strojni', 'Strojní pojištění', null, [['Limit', 'Zadat']]],
      ['prac', 'Činnost pracovního stroje', null, null],
    ]
    const cov = state.avCover
    const covers = coverDefs.map(([id, label, note, params], i) => {
      const on = !!cov[id]
      return {
        label, note,
        toggle: () => setState((s) => ({ avCover: { ...s.avCover, [id]: !s.avCover[id] } })),
        boxStyle: `width:20px;height:20px;border-radius:6px;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#fff;border:1.5px solid ${on ? 'var(--blue)' : '#CFCFD4'};background:${on ? 'var(--blue)' : '#fff'}`,
        checkIcon: on ? ic('check', 13, 2.5) : null,
        titleColor: on ? 'var(--ink)' : 'var(--ink2)',
        hasParams: on && !!params, params: params ? params.map(([label, value]) => ({ label, value })) : [],
        rowStyle: `display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px 14px;padding:13px 16px;${i < coverDefs.length - 1 ? 'border-bottom:1px solid var(--border);' : ''}background:${on ? '#FAFBFD' : '#fff'}`,
      }
    })
    const coverCount = Object.values(cov).filter(Boolean).length
    const base = 4200
    const est = Object.entries(cov).reduce((a, [k, v]) => { if (!v) return a; const add = { pr: 9800, hav: 14600, skla: 2400, uraz: 1900, zver: 1200, nahradni: 1600, zavazadla: 900, gap: 3200, zivel: 1400, asist: 1100, strojni: 2600, prac: 800 }; return a + (add[k] || 0) }, 0)
    const estimate = (est + base).toLocaleString('cs-CZ') + ' Kč'
    const last = step === 3
    return {
      av: true,
      avUziti: state.avUziti,
      avInput: state.avInput,
      avm: {
        close: () => setState({ av: false }), stop: (e) => e.stopPropagation(),
        fleetName: f.name, fleetId: state.avFleet,
        fleetOptions: allFleets.map((x) => ({ v: x.id, l: x.name })),
        onFleetChange: (e) => setState({ avFleet: e.target.value }),
        stepLabel: done ? 'Hotovo' : `Krok ${step} ze 3 · ${labels[step - 1]}`, steps,
        s1: step === 1, s2: step === 2, s3: step === 3, isDone: done,
        methods, isUpload: m === 'doklad', isField: m !== 'doklad',
        fieldBadge: m === 'vin' ? 'VIN' : 'CZ', fieldPlaceholder: m === 'vin' ? 'Zadejte VIN' : 'Zadejte SPZ',
        onInput: (e) => setState({ avInput: e.target.value }),
        load: () => setState({ avLoaded: true, avStep: 2 }), loadLabel: 'Načíst z registru',
        uploadIcon: ic('upload', 22), infoIcon: ic('info', 16), checkBadge: ic('check', 16, 2.5),
        bigCar: ic('car', 26), bigCheck: ic('check', 30, 2.5),
        loaded, fields, covers, coverCount, estimate,
        back: () => (step === 1 || done) ? setState({ av: false }) : setState((s) => ({ avStep: s.avStep - 1 })),
        backStyle: `font-size:13px;font-weight:600;color:var(--ink3);cursor:pointer;${(step === 1 || done) ? 'visibility:hidden' : ''}`,
        next: () => { if (done) { setState({ av: false }); showToast(`${loaded.brand} ${loaded.model} přidáno do parku ${f.name}.`); return } setState((s) => ({ avStep: s.avStep + 1 })) },
        nextLabel: done ? 'Zavřít' : (last ? 'Přidat vozidlo' : 'Pokračovat'),
        nextStyle: `height:40px;padding:0 22px;border-radius:10px;font-size:13.5px;font-weight:600;cursor:pointer;display:flex;align-items:center;color:#fff;background:${(last || done) ? 'var(--green)' : 'var(--blue)'}`,
      },
    }
  }

  const wizardVM = () => {
    if (!state.claimWizard) return {}
    const step = state.claimStep; const done = step > 6
    const labels = ['Popis události', 'Fotodokumentace', 'Policejní zpráva', 'Místo události', 'Vozidlo a řidič', 'Shrnutí']
    const steps = [1, 2, 3, 4, 5, 6].map((i) => ({ color: i <= Math.min(step, 6) ? 'var(--star)' : '#ECECEE' }))
    const types = ['Havárie', 'Parkovací škoda', 'Sklo', 'Krupobití', 'Odcizení', 'Střet se zvěří'].map((t) => { const on = state.cwType === t; return { label: t, onClick: () => setState({ cwType: t }), style: `padding:11px 10px;border-radius:10px;text-align:center;font-size:12.5px;font-weight:600;cursor:pointer;border:1.5px solid ${on ? 'var(--star)' : 'var(--border2)'};background:${on ? 'var(--star-soft)' : '#fff'};color:${on ? 'var(--star-ink)' : 'var(--ink2)'}` } })
    const vehiclePick = vehiclesData.slice(0, 4).map((v) => { const on = state.cwVehicle === v.id; return { plate: v.plate, name: v.brand + ' ' + v.model, driver: v.driver, onClick: () => setState({ cwVehicle: v.id }), style: `display:flex;align-items:center;gap:12px;padding:11px 13px;border-radius:11px;cursor:pointer;border:1.5px solid ${on ? 'var(--blue)' : 'var(--border2)'};background:${on ? 'var(--blue-soft)' : '#fff'}`, radio: `width:18px;height:18px;border-radius:50%;border:5px solid ${on ? 'var(--blue)' : '#D4D4D8'};flex-shrink:0;${on ? 'box-shadow:inset 0 0 0 2px #fff' : ''}` } })
    const v = vehiclesData.find((x) => x.id === state.cwVehicle)
    const summary = [
      { k: 'Typ události', v: state.cwType },
      { k: 'Vozidlo', v: v.plate + ' · ' + v.brand + ' ' + v.model },
      { k: 'Řidič', v: v.driver },
      { k: 'Pojišťovna', v: v.insurer },
      { k: 'Místo', v: 'Praha 4, Jižní spojka' },
    ]
    const last = step >= 6
    return {
      cw: {
        steps, stepLabel: done ? 'Hotovo' : ('Krok ' + step + ' z 6 · ' + labels[step - 1]),
        isDone: done, s1: step === 1, s2: step === 2, s3: step === 3, s4: step === 4, s5: step === 5, s6: step === 6,
        types, vehiclePick, summary,
        camera: ic('camera', 22), fileIcon: ic('file', 18), check: ic('check', 12, 2.5), pin: ic('mapPin', 40),
        carSm: ic('car', 16), sparkle: ic('sparkle', 16), bigCheck: ic('check', 30, 2.5), photos: [ic('camera', 20), ic('camera', 20), ic('camera', 20), ic('plus', 20)],
        back: () => done ? setState({ claimWizard: false }) : setState((s) => ({ claimStep: Math.max(1, s.claimStep - 1) })),
        backStyle: `font-size:13px;font-weight:600;color:var(--ink3);cursor:pointer;${(step === 1 || done) ? 'visibility:hidden' : ''}`,
        next: () => done ? setState({ claimWizard: false }) : setState((s) => ({ claimStep: s.claimStep + 1 })),
        nextLabel: done ? 'Zavřít' : (last ? 'Odeslat událost' : 'Pokračovat'),
        nextStyle: `height:40px;padding:0 20px;border-radius:10px;font-size:13.5px;font-weight:600;cursor:pointer;display:flex;align-items:center;color:#fff;background:${(last || done) ? 'var(--star)' : 'var(--blue)'}`,
      },
    }
  }

  const vm = {
    ...shellVM(), ...dashboardVM(), ...fleetsVM(), ...fleetDetailVM(), ...vehiclesVM(), ...vehicleDetailVM(),
    ...insuranceVM(), ...claimsVM(), ...documentsVM(), ...documentsDetailVM(), ...analyticsVM(), ...contactsVM(), ...settingsVM(), ...bonifikaceVM(), ...bonifikaceDetailVM(), ...wizardVM(), ...addVehicleVM(),
  }

  return <Render vm={vm} />
}
