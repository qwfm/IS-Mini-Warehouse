import { Routes, Route, Link } from "react-router-dom";
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
import UserSync from "./components/UserSync";


function Shell({ children }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-10 border-b bg-white/90 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <Link to="/" className="text-lg font-semibold">Mini Warehouse</Link>
          <nav className="flex gap-4 text-sm">
            <Link className="hover:text-sky-700" to="/categories">Categories</Link>
            <Link className="hover:text-sky-700" to="/materials">Materials</Link>
            <Link className="hover:text-sky-700" to="/warehouses">Warehouses</Link>
            <Link className="hover:text-sky-700" to="/clients">Clients</Link>
            <Link className="hover:text-sky-700" to="/suppliers">Suppliers</Link>
            <Link className="hover:text-sky-700" to="/receipts">Receipts</Link>
            <Link className="hover:text-sky-700" to="/issues">Issues</Link>
            <Link className="hover:text-sky-700" to="/stock">Stock</Link>
            <Link className="hover:text-sky-700" to="/stock-ledger">Stock Ledger</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}

function Home() {
  const { isAuthenticated, loginWithRedirect, logout, user } = useAuth0();
  return (
    <div className="card">
      <h1 className="text-xl font-semibold mb-2">Mini Warehouse UI</h1>
      <div className="toolbar">
        {!isAuthenticated ? (
          <button className="btn btn-primary" onClick={() => loginWithRedirect()}>Log in</button>
        ) : (
          <>
            <span className="text-sm text-slate-700">Hi, {user?.email}</span>
            <button
              className="btn"
              onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
            >
              Log out
            </button>
          </>
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
        <Route path="/categories"  element={<ProtectedRoute><CategoriesPage/></ProtectedRoute>} />
        <Route path="/materials"   element={<ProtectedRoute><MaterialsPage/></ProtectedRoute>} />
        <Route path="/receipts"    element={<ProtectedRoute><ReceiptsPage/></ProtectedRoute>} />
        <Route path="/issues"      element={<ProtectedRoute><IssuesPage/></ProtectedRoute>} />
        <Route path="/warehouses"  element={<ProtectedRoute><WarehousesPage/></ProtectedRoute>} />
        <Route path="/suppliers"   element={<ProtectedRoute><SuppliersPage/></ProtectedRoute>} />
        <Route path="/clients"     element={<ProtectedRoute><ClientsPage/></ProtectedRoute>} />
        <Route path="/stock"       element={<ProtectedRoute><StockPage/></ProtectedRoute>} />
        <Route path="/stock-ledger"       element={<ProtectedRoute><LedgerPage/></ProtectedRoute>} />
      </Routes>
    </Shell>
  );
}
