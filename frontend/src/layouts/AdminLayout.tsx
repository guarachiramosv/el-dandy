import React, { useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { LayoutDashboard, Users, FileText, Settings, LogOut, Bell, ChevronDown, CircleDollarSign, Truck, PackagePlus, AlertTriangle, Boxes } from "lucide-react";
import { getCurrentUser } from "../services/auth";
import ChangePasswordModal from "../components/ChangePasswordModal";
import BrandLogo from "../components/BrandLogo";

export default function AdminLayout() {
  const navigate = useNavigate();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const user = getCurrentUser();

  const handleLogout = () => {
    navigate("/login");
  };

  return (
    <div className="flex h-screen bg-grafito-800 text-gray-200 overflow-hidden font-sans">
      {/* Sidebar Admin */}
      <motion.aside 
        initial={{ x: -250 }}
        animate={{ x: 0 }}
        className="w-64 bg-grafito-900 border-r border-gray-800 flex flex-col shadow-2xl relative z-20"
      >
        <div className="h-16 flex items-center px-6 border-b border-gray-800 bg-grafito-900">
          <BrandLogo imageClassName="h-11 w-auto" />
        </div>

        <div className="px-6 py-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Administración</p>
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          <NavLink to="/admin" end className={({isActive}) => `flex items-center px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-primary/10 text-primary font-medium' : 'text-gray-400 hover:bg-grafito-800 hover:text-white'}`}>
            <LayoutDashboard size={20} className="mr-3" /> Dashboard
          </NavLink>
          <NavLink to="/admin/productos" className={({isActive}) => `flex items-center px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-primary/10 text-primary font-medium' : 'text-gray-400 hover:bg-grafito-800 hover:text-white'}`}>
            <Truck size={20} className="mr-3" /> Productos
          </NavLink>
          <NavLink to="/admin/inventario" className={({isActive}) => `flex items-center px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-primary/10 text-primary font-medium' : 'text-gray-400 hover:bg-grafito-800 hover:text-white'}`}>
            <Boxes size={20} className="mr-3" /> Inventario
          </NavLink>
          <NavLink to="/admin/clientes" className={({isActive}) => `flex items-center px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-primary/10 text-primary font-medium' : 'text-gray-400 hover:bg-grafito-800 hover:text-white'}`}>
            <Users size={20} className="mr-3" /> Clientes
          </NavLink>
          <NavLink to="/admin/proveedores" className={({isActive}) => `flex items-center px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-primary/10 text-primary font-medium' : 'text-gray-400 hover:bg-grafito-800 hover:text-white'}`}>
            <Truck size={20} className="mr-3" /> Proveedores
          </NavLink>
          <NavLink to="/admin/compras" className={({isActive}) => `flex items-center px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-primary/10 text-primary font-medium' : 'text-gray-400 hover:bg-grafito-800 hover:text-white'}`}>
            <PackagePlus size={20} className="mr-3" /> Compras
          </NavLink>
          <NavLink to="/admin/alertas" className={({isActive}) => `flex items-center px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-primary/10 text-primary font-medium' : 'text-gray-400 hover:bg-grafito-800 hover:text-white'}`}>
            <AlertTriangle size={20} className="mr-3" /> Alertas
          </NavLink>
          <NavLink to="/admin/reportes" className={({isActive}) => `flex items-center px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-primary/10 text-primary font-medium' : 'text-gray-400 hover:bg-grafito-800 hover:text-white'}`}>
            <FileText size={20} className="mr-3" /> Reportes
          </NavLink>
          <NavLink to="/admin/usuarios" className={({isActive}) => `flex items-center px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-primary/10 text-primary font-medium' : 'text-gray-400 hover:bg-grafito-800 hover:text-white'}`}>
            <Users size={20} className="mr-3" /> Usuarios
          </NavLink>
          <NavLink to="/admin/ganancias" className={({isActive}) => `flex items-center px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-primary/10 text-primary font-medium' : 'text-gray-400 hover:bg-grafito-800 hover:text-white'}`}>
            <CircleDollarSign size={20} className="mr-3" /> Ganancias
          </NavLink>
          <NavLink to="/admin/configuracion" className={({isActive}) => `flex items-center px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-primary/10 text-primary font-medium' : 'text-gray-400 hover:bg-grafito-800 hover:text-white'}`}>
            <Settings size={20} className="mr-3" /> Configuración
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
          <h1 className="text-lg font-semibold text-white">Panel de Administración</h1>
          <div className="flex items-center gap-6">
            <button className="relative text-gray-400 hover:text-white transition-colors">
              <Bell size={20} />
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-accent rounded-full animate-pulse"></span>
            </button>
            <div className="relative border-l border-gray-700 pl-6">
              <div 
                className="flex items-center gap-3 cursor-pointer group"
                onClick={() => setShowDropdown(!showDropdown)}
              >
                <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center font-bold text-white shadow-lg">
                  {user?.nombre.substring(0, 2).toUpperCase() || "AD"}
                </div>
                <div className="hidden sm:block">
                  <p className="text-sm font-medium text-white">{user?.nombre || "Admin Principal"}</p>
                  <p className="text-xs text-gray-400">Administrador</p>
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
          <Outlet />
        </main>
        
        {showPasswordModal && (
          <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />
        )}
      </div>
    </div>
  );
}
