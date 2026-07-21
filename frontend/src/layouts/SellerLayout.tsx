import React, { useEffect, useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { AlertTriangle, ShoppingCart, Users, Package, FileSignature, LogOut, Bell, ChevronDown, History, Hammer } from "lucide-react";
import { clearSession, getCurrentUser } from "../services/auth";
import { fetchPendingCashClosings } from "../services/sales";
import { PendingCashClosing } from "../types";
import ChangePasswordModal from "../components/ChangePasswordModal";
import BrandLogo from "../components/BrandLogo";
import ConfirmLogoutModal from "../components/ConfirmLogoutModal";

const money = (value: number) =>
  `Bs ${value.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function SellerLayout() {
  const navigate = useNavigate();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [pendingClosings, setPendingClosings] = useState<PendingCashClosing[]>([]);
  const user = getCurrentUser();

  useEffect(() => {
    if (user?.role !== "SELLER") return;
    let mounted = true;
    fetchPendingCashClosings()
      .then((items) => {
        if (mounted) setPendingClosings(items);
      })
      .catch(() => {
        if (mounted) setPendingClosings([]);
      });
    return () => {
      mounted = false;
    };
  }, [user?.role]);

  const handleLogout = () => {
    setShowDropdown(false);
    setShowLogoutConfirm(true);
  };

  const confirmLogout = () => {
    clearSession();
    navigate("/login");
  };

  return (
    <div className="flex h-screen bg-grafito-800 text-gray-200 overflow-hidden font-sans">
      {/* Sidebar Vendedor */}
      <motion.aside 
        initial={{ x: -250 }}
        animate={{ x: 0 }}
        className="w-64 bg-grafito-900 border-r border-gray-800 flex flex-col shadow-2xl relative z-20"
      >
        <div className="h-16 flex items-center px-6 border-b border-gray-800 bg-grafito-900">
          <BrandLogo imageClassName="h-11 w-auto" />
        </div>

        <div className="px-6 py-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Punto de Venta</p>
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          <NavLink to="/seller/ventas" className={({isActive}) => `flex items-center px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-primary/10 text-primary font-medium' : 'text-gray-400 hover:bg-grafito-800 hover:text-white'}`}>
            <ShoppingCart size={20} className="mr-3" /> Punto de Venta
          </NavLink>
          <NavLink to="/seller/historial" className={({isActive}) => `flex items-center px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-primary/10 text-primary font-medium' : 'text-gray-400 hover:bg-grafito-800 hover:text-white'}`}>
            <History size={20} className="mr-3" /> Historial
          </NavLink>
          <NavLink to="/seller/inventario" className={({isActive}) => `flex items-center px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-primary/10 text-primary font-medium' : 'text-gray-400 hover:bg-grafito-800 hover:text-white'}`}>
            <Package size={20} className="mr-3" /> Inventario
          </NavLink>
          <NavLink to="/seller/remachado" className={({isActive}) => `flex items-center px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-primary/10 text-primary font-medium' : 'text-gray-400 hover:bg-grafito-800 hover:text-white'}`}>
            <Hammer size={20} className="mr-3" /> Remachado
          </NavLink>
          <NavLink to="/seller/clientes" className={({isActive}) => `flex items-center px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-primary/10 text-primary font-medium' : 'text-gray-400 hover:bg-grafito-800 hover:text-white'}`}>
            <Users size={20} className="mr-3" /> Clientes
          </NavLink>
          <NavLink to="/seller/cotizaciones" className={({isActive}) => `flex items-center px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-primary/10 text-primary font-medium' : 'text-gray-400 hover:bg-grafito-800 hover:text-white'}`}>
            <FileSignature size={20} className="mr-3" /> Cotizaciones
          </NavLink>
        </nav>

        <div className="p-4 border-t border-gray-800">
          <button onClick={handleLogout} className="w-full flex items-center px-4 py-3 text-gray-400 hover:bg-grafito-800 hover:text-white rounded-lg transition-colors">
            <LogOut size={20} className="mr-3 text-accent" /> Cerrar Sesión
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative z-10 overflow-hidden">
        {/* Topbar */}
        <header className="h-16 bg-grafito-900/80 backdrop-blur-md border-b border-gray-800 flex items-center justify-between px-8 shadow-sm">
          <h1 className="text-lg font-semibold text-white">Ventas y Facturación</h1>
          <div className="flex items-center gap-6">
            <button className="relative text-gray-400 hover:text-white transition-colors">
              <Bell size={20} />
            </button>
            <div className="relative border-l border-gray-700 pl-6">
              <div 
                className="flex items-center gap-3 cursor-pointer group"
                onClick={() => setShowDropdown(!showDropdown)}
              >
                <div className="w-8 h-8 bg-grafito-700 border border-gray-600 rounded-full flex items-center justify-center font-bold text-white shadow-sm">
                  {user?.nombre.substring(0, 2).toUpperCase() || "VE"}
                </div>
                <div className="hidden sm:block">
                  <p className="text-sm font-medium text-white">{user?.nombre || "Vendedor"}</p>
                  <p className="text-xs text-gray-400">Vendedor</p>
                </div>
                <ChevronDown size={16} className={`text-gray-400 transition-transform ${showDropdown ? "rotate-180" : ""}`} />
              </div>
              
              {showDropdown && (
                <div className="absolute right-0 mt-2 w-48 rounded-lg border border-gray-700 bg-grafito-800 py-1 shadow-xl z-50">
                  <button 
                    onClick={() => {
                      setShowDropdown(false);
                      setShowPasswordModal(true);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-grafito-700 hover:text-white"
                  >
                    Cambiar contraseña
                  </button>
                  <button 
                    onClick={handleLogout}
                    className="w-full flex items-center px-4 py-2 text-left text-sm text-red-400 hover:bg-grafito-700 hover:text-red-300"
                  >
                    <LogOut size={16} className="mr-2" /> Cerrar Sesión
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-grafito-800 p-6">
          {pendingClosings.length > 0 && (
            <div className="mb-5 rounded-xl border border-red-500/40 bg-red-500/10 p-4 shadow-lg">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex gap-3">
                  <AlertTriangle className="mt-0.5 shrink-0 text-red-300" size={24} />
                  <div>
                    <p className="font-black uppercase tracking-wide text-red-100">Caja pendiente de cierre</p>
                    <p className="mt-1 text-sm text-red-100/90">
                      Tienes una caja sin cerrar del {pendingClosings[0].fecha}.
                      {pendingClosings.length > 1 ? ` Hay ${pendingClosings.length} dias pendientes.` : ""}
                    </p>
                    <p className="mt-1 text-xs text-red-200/80">
                      Ventas: {pendingClosings[0].cantidadVentas} - Total vendido: {money(pendingClosings[0].totalVentas)} - Gastos: {money(pendingClosings[0].totalGastos)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate(`/seller/historial?fecha=${pendingClosings[0].fecha}`)}
                  className="btn-primary whitespace-nowrap"
                >
                  Cerrar caja pendiente
                </button>
              </div>
            </div>
          )}
          <Outlet />
        </main>
        
        {showPasswordModal && (
          <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />
        )}
        {showLogoutConfirm && (
          <ConfirmLogoutModal onCancel={() => setShowLogoutConfirm(false)} onConfirm={confirmLogout} />
        )}
      </div>
    </div>
  );
}
