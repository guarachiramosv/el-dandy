import React from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Boxes,
  ShoppingCart,
  Users,
  Truck,
  BarChart2,
  Bell,
  Settings,
  AlertCircle,
} from "lucide-react";

const menuItems = [
  { name: "Dashboard", to: "/", icon: <LayoutDashboard size={20} /> },
  { name: "Inventario", to: "/inventario", icon: <Boxes size={20} /> },
  { name: "Ventas", to: "/ventas", icon: <ShoppingCart size={20} /> },
  { name: "Clientes", to: "/clientes", icon: <Users size={20} /> },
  { name: "Proveedores", to: "/proveedores", icon: <Truck size={20} /> },
  { name: "Remachado", to: "/remachado", icon: <AlertCircle size={20} /> },
  { name: "Reportes", to: "/reportes", icon: <BarChart2 size={20} /> },
  { name: "Alertas", to: "/alertas", icon: <Bell size={20} /> },
  { name: "Configuración", to: "/configuracion", icon: <Settings size={20} /> },
];

export default function Sidebar() {
  return (
    <nav className="hidden md:flex flex-col w-64 bg-gray-800 text-gray-100">
      <div className="flex items-center justify-center h-16 border-b border-gray-700">
        <h1 className="text-xl font-semibold">El Dandy</h1>
      </div>
      <ul className="flex-1 overflow-y-auto py-4 space-y-1">
        {menuItems.map((item) => (
          <li key={item.name}>
            <NavLink
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2 rounded-md transition-colors 
                 ${isActive ? "bg-gray-700" : "hover:bg-gray-700"}`
              }
            >
              {item.icon}
              <span className="text-sm font-medium">{item.name}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
