// src/components/ui/dialog.jsx
import * as React from "react";

const Dialog = ({ open, children }) => {
  if (!open) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        {children}
      </div>
    </div>
  );
};

const DialogContent = ({ children }) => {
  return <div className="space-y-4">{children}</div>;
};

const DialogHeader = ({ children }) => {
  return <div className="mb-4">{children}</div>;
};

const DialogTitle = ({ children }) => {
  return <h2 className="text-xl font-bold">{children}</h2>;
};

export { Dialog, DialogContent, DialogHeader, DialogTitle };