"use client";

import { useState, useEffect } from "react";
import { X, Calendar, AlertCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

export function NmmsNoticePopup() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Open the popup when the app opens
    setIsOpen(true);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-up"
      role="dialog"
      aria-modal="true"
      aria-labelledby="nmms-popup-title"
      onClick={() => setIsOpen(false)}
    >
      <div
        className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden transform transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Accent top banner */}
        <div className="h-2 w-full bg-gradient-to-r from-[hsl(213,56%,24%)] via-[hsl(40,80%,50%)] to-[hsl(213,56%,24%)]" />

        {/* Close button */}
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          aria-label="Close notice"
          className="absolute top-4 right-4 p-1.5 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6 sm:p-7 text-center">
          {/* Icon indicator */}
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-700 shadow-inner">
            <Calendar className="w-7 h-7 text-amber-600" />
          </div>

          {/* Badge */}
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200 mb-3">
            <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
            Important Notice
          </div>

          {/* Title */}
          <h2
            id="nmms-popup-title"
            className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight mb-3"
          >
            NMMS Application Alert
          </h2>

          {/* Highlighted Notice Box with the exact text */}
          <div className="my-4 p-4 rounded-xl bg-[hsl(213,45%,97%)] border-2 border-[hsl(213,56%,24%)]/20 shadow-xs">
            <p className="text-lg sm:text-xl font-extrabold text-[hsl(213,56%,24%)] tracking-tight">
              NMMS apply last date: 25/11/2026
            </p>
            <div className="mt-2 flex items-center justify-center gap-1 text-xs font-semibold text-gray-600">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              <span>Ensure student registrations are submitted before the deadline</span>
            </div>
          </div>

          <p className="text-xs text-gray-500 mb-6">
            Department of School Education • Madurai District
          </p>

          {/* Action button */}
          <Button
            type="button"
            onClick={() => setIsOpen(false)}
            className="w-full h-11 text-sm font-bold shadow-md hover:shadow-lg transition-all"
          >
            OK, Understood
          </Button>
        </div>
      </div>
    </div>
  );
}

