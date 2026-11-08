import { useEffect, useRef } from "react";

export default function Modal({ title, open, onClose, children, className = "" }) {
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    const handleKey = (event) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", handleKey);
    document.body.classList.add("modal-open");
    dialogRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.classList.remove("modal-open");
      previous?.focus();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onCloseRef.current();
    }}>
      <div ref={dialogRef} className={`card modal-dialog ${className}`} role="dialog" aria-modal="true" aria-labelledby="modal-title" tabIndex="-1">
        <div className="modal-header">
          <h3 id="modal-title">{title}</h3>
          <button className="modal-close" type="button" aria-label={`Close ${title}`} onClick={() => onCloseRef.current()}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}
