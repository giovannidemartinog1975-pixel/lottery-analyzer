import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import SuperEnalotto from './pages/AppSuperEnalotto'
import EuroJackpot from './pages/AppEuroJackpot'
import EuroMillions from './pages/AppEuroMillions'
import Archivio from './pages/AppArchivio'

function NavItem({ to, label, color }: { to: string; label: string; color: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `px-4 py-2 rounded-lg text-sm font-medium transition-all ${
          isActive
            ? `${color} text-white`
            : 'text-slate-400 hover:text-white hover:bg-slate-700'
        }`
      }
    >
      {label}
    </NavLink>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-900">
        <nav className="bg-slate-800 border-b border-slate-700 px-4 py-3">
          <div className="max-w-7xl mx-auto flex items-center gap-2 flex-wrap">
            <span className="text-white font-bold text-lg mr-4">🎯 Lottery Analyzer</span>
            <NavItem to="/" label="SuperEnalotto" color="bg-blue-600" />
            <NavItem to="/eurojackpot" label="EuroJackpot" color="bg-emerald-600" />
            <NavItem to="/euromillions" label="EuroMillions" color="bg-purple-600" />
            <NavItem to="/archivio" label="Archivio" color="bg-slate-600" />
          </div>
        </nav>
        <main>
          <Routes>
            <Route path="/" element={<SuperEnalotto />} />
            <Route path="/eurojackpot" element={<EuroJackpot />} />
            <Route path="/euromillions" element={<EuroMillions />} />
            <Route path="/archivio" element={<Archivio />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
