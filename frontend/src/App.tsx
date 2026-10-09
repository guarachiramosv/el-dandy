import React, { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import { getCurrentUser } from "./services/auth";

const AdminLayout = lazy(() => import("./layouts/AdminLayout"));
const SellerLayout = lazy(() => import("./layouts/SellerLayout"));
const Login = lazy(() => import("./pages/Login"));
const ClientePortal = lazy(() => import("./pages/ClientePortal"));
const Dashboard = lazy(() => import("./components/dashboard/Dashboard"));
const Inventario = lazy(() => import("./pages/Inventario"));
const Ventas = lazy(() => import("./pages/Ventas"));
const HistorialVentas = lazy(() => import("./pages/HistorialVentas"));
const Clientes = lazy(() => import("./pages/Clientes"));
const Proveedores = lazy(() => import("./pages/Proveedores"));
const Compras = lazy(() => import("./pages/Compras"));
const Reportes = lazy(() => import("./pages/Reportes"));
const Alertas = lazy(() => import("./pages/Alertas"));
const Remachado = lazy(() => import("./pages/Remachado"));
const AdminProductos = lazy(() => import("./pages/admin/Productos"));
const AdminCategorias = lazy(() => import("./pages/admin/Categorias"));
const Usuarios = lazy(() => import("./pages/Usuarios"));
const Ganancias = lazy(() => import("./pages/Ganancias"));
const Finanzas = lazy(() => import("./pages/Finanzas"));

const routeFallback = <div className="p-6 text-gray-400">Cargando...</div>;

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
      <Suspense fallback={routeFallback}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/cliente" element={<ClientePortal />} />
        
        {/* Admin Routes */}
        <Route path="/admin" element={<ProtectedAdminRoute><AdminLayout /></ProtectedAdminRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="productos" element={<AdminProductos />} />
          <Route path="categorias" element={<AdminCategorias />} />
          <Route path="clientes" element={<Clientes />} />
          <Route path="proveedores" element={<Proveedores />} />
          <Route path="compras" element={<Compras />} />
          <Route path="inventario" element={<Inventario />} />
          <Route path="remachado" element={<Remachado />} />
          <Route path="alertas" element={<Alertas />} />
          <Route path="historial" element={<HistorialVentas />} />
          <Route path="reportes" element={<Reportes />} />
          <Route path="usuarios" element={<Usuarios />} />
          <Route path="ganancias" element={<Ganancias />} />
          <Route path="finanzas" element={<Finanzas />} />
          <Route path="configuracion" element={<div className="p-6"><h1 className="text-2xl text-white">Configuración</h1></div>} />
        </Route>

        {/* Seller Routes */}
        <Route path="/seller" element={<ProtectedSellerRoute><SellerLayout /></ProtectedSellerRoute>}>
          <Route index element={<Navigate to="ventas" replace />} />
          <Route path="ventas" element={<Ventas />} />
          <Route path="historial" element={<HistorialVentas />} />
          <Route path="inventario" element={<Inventario />} />
          <Route path="remachado" element={<Remachado />} />
          <Route path="clientes" element={<Clientes />} />
          <Route path="cotizaciones" element={<div className="p-6"><h1 className="text-2xl text-white">Cotizaciones</h1></div>} />
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
