
"use client";

export default function GlobalLoadingSpinner() {
  return (
    <div 
      id="loadingIndicator" 
      className="fixed inset-0 flex items-center justify-center bg-background/80 z-[9999]"
    >
      <div className="spinner"></div>
    </div>
  );
}
