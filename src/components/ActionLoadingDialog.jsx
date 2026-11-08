import { LoaderCircle } from "lucide-react";

export default function ActionLoadingDialog({
  open,
  title = "Please wait",
  description = "Processing your request...",
  danger = false,
}) {
  if (!open) return null;

  return (
    <div className="action-loading-backdrop" role="status" aria-live="polite" aria-modal="true">
      <div className={`action-loading-dialog ${danger ? "danger" : ""}`}>
        <span className="action-loading-icon">
          <LoaderCircle size={28} />
        </span>
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
      </div>
    </div>
  );
}
