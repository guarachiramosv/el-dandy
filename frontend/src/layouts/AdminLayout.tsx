import React, { useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, Users, FileText, Settings, LogOut, Bell, ChevronDown, CircleDollarSign, Truck, PackagePlus, AlertTriangle, Boxes, Tags, Hammer } from "lucide-react";
import { clearSession, getCurrentUser } from "../services/auth";
import ChangePasswordModal from "../components/ChangePasswordModal";
import BrandLogo from "../components/BrandLogo";
import ConfirmLogoutModal from "../components/ConfirmLogoutModal";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex h-9 items-center border-l-2 px-3 text-sm transition-colors ${
    isActive
      ? "border-primary bg-primary/10 font-semibold text-orange-300"
      : "border-transparent text-gray-400 hover:bg-white/[0.04] hover:text-gray-100"
  }`;

export default function AdminLayout() {
  const navigate = useNavigate();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const user = getCurrentUser();

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
      {/* Sidebar Admin */}
      <aside className="relative z-20 flex w-56 shrink-0 flex-col border-r border-gray-800 bg-[#0f1012]">
        <div className="flex h-14 items-center border-b border-gray-800 px-4">
          <BrandLogo imageClassName="h-9 w-auto" />
        </div>

        <div className="px-4 pb-2 pt-4">
          <p className="text-[11px] font-semibold uppercase text-gray-500">Administración</p>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2">
          <NavLink to="/admin" end className={navLinkClass}>
            <LayoutDashboard size={17} className="mr-3" /> Dashboard
          </NavLink>
          <NavLink to="/admin/productos" className={navLinkClass}>
            <Truck size={17} className="mr-3" /> Productos
          </NavLink>
          <NavLink to="/admin/categorias" className={navLinkClass}>
            <Tags size={17} className="mr-3" /> Categorias
          </NavLink>
          <NavLink to="/admin/inventario" className={navLinkClass}>
            <Boxes size={17} className="mr-3" /> Inventario
          </NavLink>
          <NavLink to="/admin/remachado" className={navLinkClass}>
            <Hammer size={17} className="mr-3" /> Remachado
          </NavLink>
          <NavLink to="/admin/clientes" className={navLinkClass}>
            <Users size={17} className="mr-3" /> Clientes
          </NavLink>
          <NavLink to="/admin/proveedores" className={navLinkClass}>
            <Truck size={17} className="mr-3" /> Proveedores
          </NavLink>
          <NavLink to="/admin/compras" className={navLinkClass}>
            <PackagePlus size={17} className="mr-3" /> Compras
          </NavLink>
          <NavLink to="/admin/alertas" className={navLinkClass}>
            <AlertTriangle size={17} className="mr-3" /> Alertas
          </NavLink>
          <NavLink to="/admin/reportes" className={navLinkClass}>
            <FileText size={17} className="mr-3" /> Reportes
          </NavLink>
          <NavLink to="/admin/usuarios" className={navLinkClass}>
            <Users size={17} className="mr-3" /> Usuarios
          </NavLink>
          <NavLink to="/admin/ganancias" className={navLinkClass}>
            <CircleDollarSign size={17} className="mr-3" /> Ganancias
          </NavLink>
          <NavLink to="/admin/configuracion" className={navLinkClass}>
            <Settings size={17} className="mr-3" /> Configuración
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
          <h1 className="text-sm font-semibold text-gray-100">Panel de Administración</h1>
          <div className="flex items-center gap-4">
            <button aria-label="Notificaciones" title="Notificaciones" className="relative flex h-8 w-8 items-center justify-center text-gray-400 transition-colors hover:text-white">
              <Bell size={18} />
              <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-primary"></span>
            </button>
            <div className="relative border-l border-gray-800 pl-4">
              <div 
                className="flex items-center gap-3 cursor-pointer group"
                onClick={() => setShowDropdown(!showDropdown)}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-xs font-bold text-white">
                  {user?.nombre.substring(0, 2).toUpperCase() || "AD"}
                </div>
                <div className="hidden sm:block">
                  <p className="text-sm font-medium text-white">{user?.nombre || "Admin Principal"}</p>
                  <p className="text-xs text-gray-400">Administrador</p>
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
