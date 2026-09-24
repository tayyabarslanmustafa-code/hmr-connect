import { useEffect, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  ClipboardCheck,
  FileText,
  Home,
  LogOut,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Stethoscope,
  Users,
  WalletCards,
} from 'lucide-react'
import { supabase } from './supabase'

const emptyDashboard = {
  workflow: {
    total_cases: 0,
    new_referrals: 0,
    interviews: 0,
    reports_in_progress: 0,
    follow_ups_due: 0,
  },
  claims: {
    ready_to_claim: 0,
    submitted: 0,
    action_required: 0,
    expected_receivables: 0,
  },
  initial_hmrs_this_month: 0,
  monthly_initial_hmr_limit: 30,
  recent_cases: [],
}

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [context, setContext] = useState(null)
  const [activeOrg, setActiveOrg] = useState(null)
  const [dashboard, setDashboard] = useState(emptyDashboard)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null)
      setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session) loadContext()
    else {
      setContext(null)
      setActiveOrg(null)
      setDashboard(emptyDashboard)
    }
  }, [session])

  useEffect(() => {
    if (activeOrg?.organization_id) loadDashboard(activeOrg.organization_id)
  }, [activeOrg?.organization_id])

  async function loadContext() {
    setLoading(true)
    const { data, error } = await supabase.rpc('get_my_hmr_context')
    if (error) setMessage(error.message)
    else {
      setContext(data)
      if (data?.organizations?.length) setActiveOrg(data.organizations[0])
    }
    setLoading(false)
  }

  async function loadDashboard(orgId) {
    setLoading(true)
    const { data, error } = await supabase.rpc('get_pharmacist_dashboard', { target_org: orgId })
    if (error) setMessage(error.message)
    else setDashboard(data ?? emptyDashboard)
    setLoading(false)
  }

  if (loading && !session) return <FullLoader />
  if (!session) return <AuthScreen setMessage={setMessage} message={message} />

  if (!context?.organizations?.length) {
    return <OrganizationSetup onCreated={loadContext} message={message} setMessage={setMessage} />
  }

  return (
    <div className="app-shell">
      <Sidebar onSignOut={() => supabase.auth.signOut()} />
      <main className="main-content">
        <Header context={context} activeOrg={activeOrg} setActiveOrg={setActiveOrg} />
        <section className="content-wrap">
          <div className="hero-row">
            <div>
              <span className="eyebrow">HMR CONNECT</span>
              <h1>Pharmacist Dashboard</h1>
              <p>One continuous HMR episode from referral to report, PPA claim and follow-up.</p>
            </div>
            <button className="primary-btn" onClick={() => setMessage('Referral creation UI is the next screen in Phase 2.')}>
              <Plus size={18}/> New HMR
            </button>
          </div>

          {message && <div className="notice">{message}</div>}

          <KpiGrid dashboard={dashboard} />

          <div className="split-grid">
            <WorkflowPanel dashboard={dashboard} />
            <ClaimPanel dashboard={dashboard} />
          </div>

          <RecentCases cases={dashboard.recent_cases ?? []} onRefresh={() => loadDashboard(activeOrg.organization_id)} />
        </section>
      </main>
    </div>
  )
}

function FullLoader() {
  return <div className="loader-page"><div className="spinner"/><p>Loading HMR Connect…</p></div>
}

function AuthScreen({ setMessage, message }) {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setMessage('')
    const result = mode === 'signin'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { data: { full_name: email.split('@')[0] } } })
    if (result.error) setMessage(result.error.message)
    else if (mode === 'signup') setMessage('Account created. Check your email if confirmation is enabled, then sign in.')
    setBusy(false)
  }

  return (
    <div className="auth-page">
      <div className="auth-brand">
        <div className="brand-mark">HC</div>
        <h1>HMR Connect</h1>
        <p>Making Home Medication Reviews more convenient.</p>
        <div className="auth-features">
          <div><ShieldCheck/> Secure clinical workspace</div>
          <div><Stethoscope/> Pharmacist-led HMR workflow</div>
          <div><WalletCards/> PPA claim-ready architecture</div>
        </div>
      </div>
      <form className="auth-card" onSubmit={submit}>
        <h2>{mode === 'signin' ? 'Welcome back' : 'Create your account'}</h2>
        <p>{mode === 'signin' ? 'Sign in to your HMR workspace.' : 'Start your HMR Connect workspace.'}</p>
        <label>Email</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="pharmacist@example.com"/>
        <label>Password</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} placeholder="Minimum 8 characters"/>
        {message && <div className="form-message">{message}</div>}
        <button className="primary-btn full" disabled={busy}>{busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}</button>
        <button type="button" className="link-btn" onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
          {mode === 'signin' ? 'Need an account? Create one' : 'Already have an account? Sign in'}
        </button>
        <small>Development environment only — do not enter real patient information yet.</small>
      </form>
    </div>
  )
}

function OrganizationSetup({ onCreated, message, setMessage }) {
  const [name, setName] = useState('HMR Connect')
  const [slug, setSlug] = useState('hmr-connect')
  const [busy, setBusy] = useState(false)

  async function create(e) {
    e.preventDefault()
    setBusy(true)
    setMessage('')
    const { error } = await supabase.rpc('create_my_organization', { org_name: name, org_slug: slug })
    if (error) setMessage(error.message)
    else await onCreated()
    setBusy(false)
  }

  return (
    <div className="setup-page">
      <form className="setup-card" onSubmit={create}>
        <div className="brand-mark">HC</div>
        <span className="eyebrow">FIRST-TIME SETUP</span>
        <h1>Create your HMR organization</h1>
        <p>This organization becomes the secure workspace for pharmacists, doctors, patients and HMR episodes.</p>
        <label>Organization name</label>
        <input value={name} onChange={e => setName(e.target.value)} required />
        <label>Workspace slug</label>
        <input value={slug} onChange={e => setSlug(e.target.value)} required />
        {message && <div className="form-message">{message}</div>}
        <button className="primary-btn full" disabled={busy}>{busy ? 'Creating…' : 'Create workspace'}</button>
        <small>Use synthetic/test patient data only during development.</small>
      </form>
    </div>
  )
}

function Sidebar({ onSignOut }) {
  return (
    <aside className="sidebar">
      <div className="logo-block"><div className="brand-mark small">HC</div><div><strong>HMR Connect</strong><span>Clinical workspace</span></div></div>
      <nav>
        <a className="active"><Home/> Dashboard</a>
        <a><FileText/> Referrals</a>
        <a><Users/> Patients</a>
        <a><Activity/> Interviews</a>
        <a><ClipboardCheck/> Reports</a>
        <a><WalletCards/> PPA Claim Centre</a>
      </nav>
      <div className="sidebar-bottom">
        <div className="secure-card"><ShieldCheck/><div><strong>Secure development mode</strong><span>No real patient data</span></div></div>
        <button className="logout-btn" onClick={onSignOut}><LogOut/> Sign out</button>
      </div>
    </aside>
  )
}

function Header({ context, activeOrg, setActiveOrg }) {
  return (
    <header className="topbar">
      <div className="search-box"><Search size={17}/><input placeholder="Search patients, HMRs, claims…" disabled/></div>
      <div className="topbar-right">
        <select value={activeOrg?.organization_id || ''} onChange={e => setActiveOrg(context.organizations.find(o => o.organization_id === e.target.value))}>
          {context.organizations.map(org => <option key={org.organization_id} value={org.organization_id}>{org.organization_name}</option>)}
        </select>
        <div className="user-chip"><div className="avatar">{(context.profile?.full_name || context.profile?.email || 'U').slice(0,1).toUpperCase()}</div><div><strong>{context.profile?.full_name || 'HMR User'}</strong><span>{activeOrg?.role}</span></div></div>
      </div>
    </header>
  )
}

function KpiGrid({ dashboard }) {
  const cards = [
    ['New Referrals', dashboard.workflow?.new_referrals ?? 0, FileText, 'Awaiting validation'],
    ['Interviews', dashboard.workflow?.interviews ?? 0, Activity, 'To book / in progress'],
    ['Reports', dashboard.workflow?.reports_in_progress ?? 0, ClipboardCheck, 'Clinical review / draft'],
    ['Follow-ups Due', dashboard.workflow?.follow_ups_due ?? 0, RefreshCw, 'Clinically indicated'],
    ['Ready to Claim', dashboard.claims?.ready_to_claim ?? 0, WalletCards, 'PPA Claim Centre'],
    ['Action Required', dashboard.claims?.action_required ?? 0, AlertTriangle, 'Claims needing attention'],
  ]
  return <div className="kpi-grid">{cards.map(([label,value,Icon,sub]) => <div className="kpi-card" key={label}><div className="kpi-icon"><Icon/></div><div><span>{label}</span><strong>{value}</strong><small>{sub}</small></div></div>)}</div>
}

function WorkflowPanel({ dashboard }) {
  const w = dashboard.workflow ?? {}
  const rows = [
    ['Total accessible HMR episodes', w.total_cases ?? 0],
    ['New referrals', w.new_referrals ?? 0],
    ['Interview workflow', w.interviews ?? 0],
    ['Reports in progress', w.reports_in_progress ?? 0],
    ['Follow-ups due', w.follow_ups_due ?? 0],
  ]
  return <div className="panel"><div className="panel-head"><div><span className="eyebrow">CLINICAL WORKFLOW</span><h3>HMR Episode Pipeline</h3></div></div><div className="metric-list">{rows.map(([label,value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div></div>
}

function ClaimPanel({ dashboard }) {
  const used = dashboard.initial_hmrs_this_month ?? 0
  const limit = dashboard.monthly_initial_hmr_limit ?? 30
  const pct = Math.min(100, Math.round((used / limit) * 100))
  const amount = Number(dashboard.claims?.expected_receivables ?? 0).toLocaleString('en-AU', { style:'currency', currency:'AUD' })
  return <div className="panel"><div className="panel-head"><div><span className="eyebrow">PPA CLAIM CENTRE</span><h3>Claims & Monthly Usage</h3></div></div><div className="claim-amount"><span>Expected receivables</span><strong>{amount}</strong></div><div className="progress-label"><span>Initial HMRs this month</span><strong>{used} / {limit}</strong></div><div className="progress"><div style={{width:`${pct}%`}}/></div><div className="claim-mini"><div><strong>{dashboard.claims?.submitted ?? 0}</strong><span>Submitted</span></div><div><strong>{dashboard.claims?.ready_to_claim ?? 0}</strong><span>Ready</span></div><div><strong>{dashboard.claims?.action_required ?? 0}</strong><span>Action</span></div></div></div>
}

function RecentCases({ cases, onRefresh }) {
  return <div className="panel table-panel"><div className="panel-head"><div><span className="eyebrow">RECENT ACTIVITY</span><h3>Recent HMR Episodes</h3></div><button className="icon-btn" onClick={onRefresh}><RefreshCw size={16}/></button></div>{cases.length === 0 ? <div className="empty-state"><FileText/><h4>No test HMR episodes yet</h4><p>Once we build the referral screen, new synthetic cases will appear here automatically.</p></div> : <div className="table-wrap"><table><thead><tr><th>Patient</th><th>Date of birth</th><th>Status</th><th>Updated</th></tr></thead><tbody>{cases.map(c => <tr key={c.episode_id}><td>{c.first_name} {c.last_name}</td><td>{c.date_of_birth || '—'}</td><td><span className="status-pill">{String(c.status).replaceAll('_',' ')}</span></td><td>{new Date(c.updated_at).toLocaleString('en-AU')}</td></tr>)}</tbody></table></div>}</div>
}

export default App
