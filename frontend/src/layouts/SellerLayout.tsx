import React, { useEffect, useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { AlertTriangle, ShoppingCart, Users, Package, FileSignature, LogOut, Bell, ChevronDown, History, Hammer } from "lucide-react";
import { clearSession, getCurrentUser } from "../services/auth";
import { fetchPendingCashClosings } from "../services/sales";
import { PendingCashClosing } from "../types";
import ChangePasswordModal from "../components/ChangePasswordModal";
import BrandLogo from "../components/BrandLogo";
import ConfirmLogoutModal from "../components/ConfirmLogoutModal";

const money = (value: number) =>
  `Bs ${value.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex h-9 items-center border-l-2 px-3 text-sm transition-colors ${
    isActive
      ? "border-primary bg-primary/10 font-semibold text-orange-300"
      : "border-transparent text-gray-400 hover:bg-white/[0.04] hover:text-gray-100"
  }`;

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
    <div className="flex h-screen overflow-hidden bg-[#0b0c0e] font-sans text-gray-200">
      {/* Sidebar Vendedor */}
      <aside className="relative z-20 flex w-56 shrink-0 flex-col border-r border-gray-800 bg-[#0f1012]">
        <div className="flex h-14 items-center border-b border-gray-800 px-4">
          <BrandLogo imageClassName="h-9 w-auto" />
        </div>

        <div className="px-4 pb-2 pt-4">
          <p className="text-[11px] font-semibold uppercase text-gray-500">Punto de Venta</p>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2">
          <NavLink to="/seller/ventas" className={navLinkClass}>
            <ShoppingCart size={17} className="mr-3" /> Punto de Venta
          </NavLink>
          <NavLink to="/seller/historial" className={navLinkClass}>
            <History size={17} className="mr-3" /> Historial
          </NavLink>
          <NavLink to="/seller/inventario" className={navLinkClass}>
            <Package size={17} className="mr-3" /> Inventario
          </NavLink>
          <NavLink to="/seller/remachado" className={navLinkClass}>
            <Hammer size={17} className="mr-3" /> Remachado
          </NavLink>
          <NavLink to="/seller/clientes" className={navLinkClass}>
            <Users size={17} className="mr-3" /> Clientes
          </NavLink>
          <NavLink to="/seller/cotizaciones" className={navLinkClass}>
            <FileSignature size={17} className="mr-3" /> Cotizaciones
          </NavLink>
        </nav>

        <div className="border-t border-gray-800 p-2">
          <button onClick={handleLogout} className="flex h-10 w-full items-center px-3 text-sm text-gray-400 transition-colors hover:bg-white/[0.04] hover:text-white">
            <LogOut size={17} className="mr-3 text-gray-500" /> Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative z-10 overflow-hidden">
        {/* Topbar */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-gray-800 bg-[#111315] px-5">
          <h1 className="text-sm font-semibold text-gray-100">Ventas y Facturación</h1>
          <div className="flex items-center gap-4">
            <button aria-label="Notificaciones" title="Notificaciones" className="flex h-8 w-8 items-center justify-center text-gray-400 transition-colors hover:text-white">
              <Bell size={18} />
            </button>
            <div className="relative border-l border-gray-800 pl-4">
              <div 
                className="flex items-center gap-3 cursor-pointer group"
                onClick={() => setShowDropdown(!showDropdown)}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-700 bg-[#1b1d21] text-xs font-bold text-white">
                  {user?.nombre.substring(0, 2).toUpperCase() || "VE"}
                </div>
                <div className="hidden sm:block">
                  <p className="text-sm font-medium text-white">{user?.nombre || "Vendedor"}</p>
                  <p className="text-xs text-gray-400">Vendedor</p>
                </div>
                <ChevronDown size={16} className={`text-gray-400 transition-transform ${showDropdown ? "rotate-180" : ""}`} />
              </div>
              
              {showDropdown && (
                <div className="absolute right-0 z-50 mt-2 w-48 rounded-md border border-gray-700 bg-[#181a1e] py-1 shadow-xl">
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
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-[#0b0c0e] p-4 lg:p-5">
          {pendingClosings.length > 0 && (
            <div className="mb-4 rounded-md border border-red-500/40 bg-red-500/10 p-3">
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
