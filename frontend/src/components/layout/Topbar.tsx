import React from "react";
import { Bell, User, ChevronsDown } from "lucide-react";
import { motion } from "framer-motion";

export default function Topbar() {
  return (
    <header className="flex items-center justify-between h-16 bg-gray-800 border-b border-gray-700 px-4 md:px-6">
      {/* Left side – optional breadcrumbs or title */}
      <div className="flex items-center space-x-2">
        <h2 className="text-lg font-medium text-gray-200">Panel de Control</h2>
      </div>

      {/* Right side – user actions */}
      <motion.div
        className="flex items-center space-x-4"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {/* Selector de sucursal */}
        <select className="bg-gray-700 text-gray-100 rounded-md py-1 px-2 focus:outline-none focus:ring-2 focus:ring-primary">
          <option value="central">Central</option>
          <option value="sucursal-1">Sucursal 1</option>
          <option value="sucursal-2">Sucursal 2</option>
        </select>

        {/* Notificaciones */}
        <button className="relative p-2 rounded-full hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-primary">
          <Bell size={20} className="text-gray-300" />
          <span className="absolute -top-1 -right-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-xs text-white">
            3
          </span>
        </button>

        {/* Avatar del usuario */}
        <button className="flex items-center space-x-2 p-1 rounded-full hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-primary">
          <User size={20} className="text-gray-300" />
          <span className="hidden md:inline-block text-sm text-gray-200">Juan Pérez</span>
          <ChevronsDown size={16} className="text-gray-400" />
        </button>
      </motion.div>
    </header>
  );
}
