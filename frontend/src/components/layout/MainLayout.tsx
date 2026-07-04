import React, { ReactNode } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { motion } from "framer-motion";

interface MainLayoutProps {
  children?: ReactNode;
}

/**
 * Main layout for the ERP "El Dandy".
 * - Fixed sidebar on the left.
 * - Topbar at the top of the content area.
 * - Content rendered via <Outlet/> (React Router) or children.
 * - Uses Framer Motion for fade‑in animation on mount.
 */
export default function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="flex h-screen bg-gray-900 text-gray-100">
      {/* Sidebar – stays fixed */}
      <Sidebar />

      {/* Main content area */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <Topbar />
        <motion.main
          className="flex-1 overflow-y-auto p-6"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {children ?? <Outlet />}
        </motion.main>
      </div>
    </div>
  );
}
