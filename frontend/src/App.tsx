import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login";
import ClientePortal from "./pages/ClientePortal";
import AdminLayout from "./layouts/AdminLayout";
import SellerLayout from "./layouts/SellerLayout";

import Dashboard from "./components/dashboard/Dashboard";
import Inventario from "./pages/Inventario";
import Ventas from "./pages/Ventas";
import HistorialVentas from "./pages/HistorialVentas";
import Clientes from "./pages/Clientes";
import Proveedores from "./pages/Proveedores";
import Compras from "./pages/Compras";
import Reportes from "./pages/Reportes";
import Alertas from "./pages/Alertas";

import AdminProductos from "./pages/admin/Productos";
import Usuarios from "./pages/Usuarios";
import { getCurrentUser } from "./services/auth";

const ProtectedAdminRoute = ({ children }: { children: React.ReactNode }) => {
  const user = getCurrentUser();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "ADMIN") return <Navigate to="/seller" replace />;
  return <>{children}</>;
};

const ProtectedSellerRoute = ({ children }: { children: React.ReactNode }) => {
  const user = getCurrentUser();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "SELLER" && user.role !== "ADMIN") return <Navigate to="/login" replace />;
  return <>{children}</>;
};

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/cliente" element={<ClientePortal />} />
        
        {/* Admin Routes */}
        <Route path="/admin" element={<ProtectedAdminRoute><AdminLayout /></ProtectedAdminRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="productos" element={<AdminProductos />} />
          <Route path="clientes" element={<Clientes />} />
          <Route path="proveedores" element={<Proveedores />} />
          <Route path="compras" element={<Compras />} />
          <Route path="inventario" element={<Inventario />} />
          <Route path="alertas" element={<Alertas />} />
          <Route path="reportes" element={<Reportes />} />
          <Route path="usuarios" element={<Usuarios />} />
          <Route path="ganancias" element={<div className="p-6"><h1 className="text-2xl text-white">Ganancias</h1></div>} />
          <Route path="configuracion" element={<div className="p-6"><h1 className="text-2xl text-white">Configuración</h1></div>} />
        </Route>

        {/* Seller Routes */}
        <Route path="/seller" element={<ProtectedSellerRoute><SellerLayout /></ProtectedSellerRoute>}>
          <Route index element={<Navigate to="ventas" replace />} />
          <Route path="ventas" element={<Ventas />} />
          <Route path="historial" element={<HistorialVentas />} />
          <Route path="inventario" element={<Inventario />} />
          <Route path="clientes" element={<Clientes />} />
          <Route path="cotizaciones" element={<div className="p-6"><h1 className="text-2xl text-white">Cotizaciones</h1></div>} />
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
