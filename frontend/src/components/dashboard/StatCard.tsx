import React from "react";
import { motion } from "framer-motion";

export interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  change?: string;
  changePositive?: boolean;
}

export default function StatCard({
  title,
  value,
  icon,
  change,
  changePositive,
}: StatCardProps) {
  return (
    <motion.div
      className="flex items-center p-4 bg-gray-800/60 rounded-xl shadow-xl backdrop-blur-sm"
      whileHover={{ y: -4, boxShadow: "0 15px 25px rgba(0,0,0,0.4)" }}
    >
      <div className="p-2 bg-primary/10 rounded-md mr-4">{icon}</div>
      <div className="flex-1">
        <p className="text-sm text-gray-400">{title}</p>
        <p className="text-2xl font-semibold text-gray-100">{value}</p>
        {change && (
          <p
            className={`text-xs ${
              changePositive ? "text-green-400" : "text-red-400"
            }`}
          >
            {change}
          </p>
        )}
      </div>
    </motion.div>
  );
}
