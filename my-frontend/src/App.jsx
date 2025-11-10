import { Routes, Route, Link, useLocation } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import ProtectedRoute from "./components/ProtectedRoute";
import CategoriesPage from "./pages/CategoriesPage";
import MaterialsPage from "./pages/MaterialsPage";
import WarehousesPage from "./pages/WarehousesPage";
import SuppliersPage from "./pages/SuppliersPage";
import ClientsPage from "./pages/ClientsPage";
import ReceiptsPage from "./pages/ReceiptsPage";
import IssuesPage from "./pages/IssuesPage";
import StockPage from "./pages/StockPage";
import LedgerPage from "./pages/LedgerPage";
import DashboardPage from "./pages/DashboardPage";

function NavLink({ to, children }) {
  const location = useLocation();
  const isActive = location.pathname === to;
  
  return (
    <Link
      to={to}
      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
        isActive
          ? "bg-sky-100 text-sky-700"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      }`}
    >
      {children}
    </Link>
  );
}

function Shell({ children }) {
  const { isAuthenticated, logout, user } = useAuth0();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-8">
              <Link to="/" className="text-xl font-bold text-sky-600">
                📦 Mini Warehouse
              </Link>
              
              {isAuthenticated && (
                <nav className="hidden md:flex items-center gap-1">
                  <NavLink to="/categories">Categories</NavLink>
                  <NavLink to="/materials">Materials</NavLink>
                  <NavLink to="/warehouses">Warehouses</NavLink>
                  <NavLink to="/suppliers">Suppliers</NavLink>
                  <NavLink to="/clients">Clients</NavLink>
                  <NavLink to="/receipts">Receipts</NavLink>
                  <NavLink to="/issues">Issues</NavLink>
                  <NavLink to="/stock">Stock</NavLink>
                  <NavLink to="/stock-ledger">Ledger</NavLink>
                  <NavLink to="/dashboard">Analysis Dashboard</NavLink>
                </nav>
              )}
            </div>

            {isAuthenticated && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-600 hidden sm:block">
                  {user?.email}
                </span>
                <button
                  onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
                  className="btn btn-sm"
                >
                  Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
      
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}

function Home() {
  const { isAuthenticated, loginWithRedirect, user } = useAuth0();
  
  return (
    <div className="max-w-2xl mx-auto text-center py-12">
      <div className="card space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Welcome to Mini Warehouse
          </h1>
          <p className="text-slate-600">
            Your complete warehouse management solution
          </p>
        </div>

        {!isAuthenticated ? (
          <div className="space-y-4">
            <p className="text-slate-600">
              Please log in to access the system
            </p>
            <button 
              onClick={() => loginWithRedirect()} 
              className="btn-primary"
            >
              Log in
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-sky-50 border border-sky-200 rounded-lg">
              <p className="text-sky-900">
                Welcome back, <strong>{user?.email}</strong>!
              </p>
            </div>
            <p className="text-slate-600">
              Use the navigation above to manage your warehouse
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Home/>} />
        <Route path="/categories" element={<ProtectedRoute><CategoriesPage/></ProtectedRoute>} />
        <Route path="/materials" element={<ProtectedRoute><MaterialsPage/></ProtectedRoute>} />
        <Route path="/receipts" element={<ProtectedRoute><ReceiptsPage/></ProtectedRoute>} />
        <Route path="/issues" element={<ProtectedRoute><IssuesPage/></ProtectedRoute>} />
        <Route path="/warehouses" element={<ProtectedRoute><WarehousesPage/></ProtectedRoute>} />
        <Route path="/suppliers" element={<ProtectedRoute><SuppliersPage/></ProtectedRoute>} />
        <Route path="/clients" element={<ProtectedRoute><ClientsPage/></ProtectedRoute>} />
        <Route path="/stock" element={<ProtectedRoute><StockPage/></ProtectedRoute>} />
        <Route path="/stock-ledger" element={<ProtectedRoute><LedgerPage/></ProtectedRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><DashboardPage/></ProtectedRoute>} />
      </Routes>
    </Shell>
  );
}