"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, TrendingUp, TrendingDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface FloatingActionButtonProps {
  onAddIncome?: () => void;
  onAddExpense?: () => void;
}

export function FloatingActionButton({
  onAddIncome,
  onAddExpense,
}: FloatingActionButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  const toggleOpen = () => setIsOpen(!isOpen);

  return (
    <>
      {/* Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px]"
          />
        )}
      </AnimatePresence>

      {/* FAB Container */}
      <div className="fixed bottom-20 right-4 z-50 flex flex-col items-end gap-3">
        {/* Sub actions */}
        <AnimatePresence>
          {isOpen && (
            <>
              {/* Add Income */}
              <motion.button
                initial={{ opacity: 0, scale: 0.5, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.5, y: 20 }}
                transition={{ delay: 0.05 }}
                onClick={() => {
                  setIsOpen(false);
                  onAddIncome?.();
                }}
                className="flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-3 text-sm font-semibold text-white shadow-lg active:scale-95 transition-transform"
              >
                <TrendingUp className="h-4 w-4" />
                <span>ລາຍຮັບ</span>
              </motion.button>

              {/* Add Expense */}
              <motion.button
                initial={{ opacity: 0, scale: 0.5, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.5, y: 20 }}
                transition={{ delay: 0 }}
                onClick={() => {
                  setIsOpen(false);
                  onAddExpense?.();
                }}
                className="flex items-center gap-2 rounded-full bg-red-500 px-4 py-3 text-sm font-semibold text-white shadow-lg active:scale-95 transition-transform"
              >
                <TrendingDown className="h-4 w-4" />
                <span>ລາຍຈ່າຍ</span>
              </motion.button>
            </>
          )}
        </AnimatePresence>

        {/* Main FAB */}
        <motion.button
          onClick={toggleOpen}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={cn(
            "flex h-14 w-14 items-center justify-center rounded-full shadow-xl transition-all duration-200",
            isOpen
              ? "bg-muted text-foreground"
              : "gradient-primary text-white"
          )}
        >
          <motion.div
            animate={{ rotate: isOpen ? 45 : 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            {isOpen ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
          </motion.div>
        </motion.button>
      </div>
    </>
  );
}
