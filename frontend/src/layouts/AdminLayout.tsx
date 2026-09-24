import React, { useCallback, useEffect, useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, Users, FileText, Settings, LogOut, Bell, ChevronDown, CircleDollarSign, Truck, PackagePlus, AlertTriangle, Boxes, Tags, Hammer, CheckCircle2, RefreshCw } from "lucide-react";
import { clearSession, getCurrentUser } from "../services/auth";
import { approveSaleVoidRequest, fetchPendingSaleVoidRequests } from "../services/sales";
import { Sale } from "../types";
import { getErrorMessage } from "../utils/errors";
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
  const [showNotifications, setShowNotifications] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [notifications, setNotifications] = useState<Sale[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState<string | null>(null);
  const user = getCurrentUser();

  const loadNotifications = useCallback(async () => {
    setLoadingNotifications(true);
    try {
      setNotifications(await fetchPendingSaleVoidRequests());
      setNotificationMessage(null);
    } catch (error: unknown) {
      setNotificationMessage(getErrorMessage(error, "No se pudieron cargar las notificaciones."));
    } finally {
      setLoadingNotifications(false);
    }
  }, []);

  useEffect(() => {
    void loadNotifications();
    const interval = window.setInterval(() => void loadNotifications(), 45000);
    const refreshOnFocus = () => void loadNotifications();
    window.addEventListener("focus", refreshOnFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshOnFocus);
    };
  }, [loadNotifications]);

  const openNotification = (sale: Sale) => {
    const fecha = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/La_Paz",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(sale.createdAt));
    const params = new URLSearchParams({ fecha, venta: sale.id });
    if (sale.sucursalId) params.set("sucursal", sale.sucursalId);
    setShowNotifications(false);
    navigate(`/admin/historial?${params.toString()}`);
  };

  const approveNotification = async (sale: Sale) => {
    const request = sale.solicitudAnulacion;
    if (!request || !window.confirm(`Aceptar la anulacion solicitada por ${request.solicitante?.nombre || "el vendedor"}?`)) return;

    setLoadingNotifications(true);
    try {
      await approveSaleVoidRequest(request.id);
      setNotifications((current) => current.filter((item) => item.id !== sale.id));
      setNotificationMessage("Venta anulada correctamente.");
    } catch (error: unknown) {
      setNotificationMessage(getErrorMessage(error));
    } finally {
      setLoadingNotifications(false);
    }
  };

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
            <div className="relative">
              <button
                type="button"
                aria-label="Notificaciones"
                title="Solicitudes de anulacion"
                onClick={() => {
                  setShowNotifications((current) => !current);
                  setShowDropdown(false);
                  void loadNotifications();
                }}
                className="relative flex h-9 w-9 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-white/[0.04] hover:text-white"
              >
                <Bell size={18} />
                {notifications.length > 0 && (
                  <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">
                    {notifications.length > 9 ? "9+" : notifications.length}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 z-50 mt-2 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-md border border-gray-700 bg-[#181a1e] shadow-xl">
                  <div className="flex items-center justify-between border-b border-gray-700 px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-white">Solicitudes de anulacion</p>
                      <p className="text-xs text-gray-400">{notifications.length} pendientes</p>
                    </div>
                    <button type="button" onClick={() => void loadNotifications()} title="Actualizar" className="flex h-8 w-8 items-center justify-center text-gray-400 hover:text-white">
                      <RefreshCw size={16} className={loadingNotifications ? "animate-spin" : ""} />
                    </button>
                  </div>

                  {notificationMessage && <p className="border-b border-gray-700 px-4 py-2 text-xs text-amber-200">{notificationMessage}</p>}

                  <div className="max-h-96 overflow-y-auto">
                    {!loadingNotifications && notifications.length === 0 && (
                      <p className="px-4 py-8 text-center text-sm text-gray-400">No hay solicitudes pendientes.</p>
                    )}
                    {notifications.map((sale) => (
                      <div key={sale.id} className="border-b border-gray-800 p-3 last:border-0">
                        <button type="button" onClick={() => openNotification(sale)} className="w-full text-left">
                          <p className="text-sm font-semibold text-white">{sale.solicitudAnulacion?.solicitante?.nombre || sale.usuario?.nombre || "Vendedor"}</p>
                          <p className="mt-1 text-xs text-gray-300">{sale.solicitudAnulacion?.motivo}</p>
                          <p className="mt-1 text-xs text-gray-500">Venta Bs {sale.total.toFixed(2)} - {sale.sucursal?.nombre || "Sucursal"}</p>
                        </button>
                        <div className="mt-3 flex gap-2">
                          <button type="button" onClick={() => openNotification(sale)} className="flex-1 rounded-md border border-gray-600 px-3 py-2 text-xs font-semibold text-gray-200 hover:bg-white/[0.04]">
                            Ver venta
                          </button>
                          <button type="button" onClick={() => void approveNotification(sale)} disabled={loadingNotifications} className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-500 disabled:opacity-60">
                            <CheckCircle2 size={14} /> Aceptar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
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
                  <p className="text-xs text-gray-400">{user?.role === "ADMIN" ? "Administrador" : "Vendedor"}</p>
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
