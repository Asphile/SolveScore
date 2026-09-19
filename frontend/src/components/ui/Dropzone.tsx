import { useState, type DragEvent } from "react";
import { UploadCloud } from "lucide-react";

interface DropzoneProps {
  accept: string;
  hint: string;
  uploading: boolean;
  disabled?: boolean;
  onFile: (file: File) => void;
}

export function Dropzone({ accept, hint, uploading, disabled, onFile }: DropzoneProps) {
  const [dragActive, setDragActive] = useState(false);

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(false);
    if (disabled || uploading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) onFile(file);
  }

  return (
    <div
      className={`dropzone ${dragActive ? "drag-active" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragActive(true);
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={handleDrop}
    >
      <span className="dropzone-icon">
        <UploadCloud size={22} />
      </span>
      <p style={{ margin: "0 0 4px", fontWeight: 600, fontSize: "0.92rem" }}>
        {uploading ? "Uploading..." : "Drop your file here"}
      </p>
      <p className="text-caption" style={{ margin: 0 }}>{uploading ? "Please wait" : `or click to browse — ${hint}`}</p>
      <input
        type="file"
        accept={accept}
        disabled={disabled || uploading}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
