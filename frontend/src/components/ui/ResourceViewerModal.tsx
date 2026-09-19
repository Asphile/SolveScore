import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { AlertCircle, Download, FileWarning, Loader2, X } from "lucide-react";
import { downloadResourceFile, fetchResourceArrayBuffer, fetchResourceBlob } from "../../api/client";
import type { ResourceItem } from "../../types";

// pdfjs-dist is a large dependency (~1.2MB incl. worker) -- load it only when
// someone actually opens a PDF, not on every page that might show this modal.
const PdfCanvasViewer = lazy(() => import("./PdfCanvasViewer").then((m) => ({ default: m.PdfCanvasViewer })));

type Kind = "video" | "pdf" | "image" | "unsupported";

function previewKind(resource: ResourceItem): Kind {
  const ext = resource.file_type.toLowerCase();
  if (["mp4", "mov", "webm"].includes(ext)) return "video";
  if (ext === "pdf") return "pdf";
  if (["jpg", "jpeg", "png"].includes(ext)) return "image";
  return "unsupported";
}

export function ResourceViewerModal({ resource, onClose }: { resource: ResourceItem | null; onClose: () => void }) {
  // video/image use an object URL; pdf is rendered client-side from raw bytes
  // (see PdfCanvasViewer) so it never touches the browser's native PDF
  // handling -- that's what was silently triggering a download instead of an
  // in-page preview (e.g. Edge's "Always download PDF files" setting).
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [pdfData, setPdfData] = useState<ArrayBuffer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Only revoked once superseded by a newer one or on close/unmount -- never
  // in an effect's own cleanup, since React StrictMode's dev-mode
  // double-invoke of effects would otherwise revoke a URL out from under the
  // element that's still loading it (surfaces as net::ERR_FILE_NOT_FOUND).
  const activeObjectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!resource) return;
    const kind = previewKind(resource);
    if (kind === "unsupported") return;

    let cancelled = false;
    setObjectUrl(null);
    setPdfData(null);
    setError(null);
    setLoading(true);

    if (kind === "pdf") {
      fetchResourceArrayBuffer(resource.id)
        .then((data) => {
          if (!cancelled) setPdfData(data);
        })
        .catch(() => {
          if (!cancelled) setError("Could not load this file. It may have been removed or you may not have access.");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    } else {
      fetchResourceBlob(resource.id)
        .then(({ objectUrl: url }) => {
          if (cancelled) {
            window.URL.revokeObjectURL(url);
            return;
          }
          if (activeObjectUrlRef.current) window.URL.revokeObjectURL(activeObjectUrlRef.current);
          activeObjectUrlRef.current = url;
          setObjectUrl(url);
        })
        .catch(() => {
          if (!cancelled) setError("Could not load this file. It may have been removed or you may not have access.");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }

    return () => {
      cancelled = true;
    };
  }, [resource]);

  // Revoke the object URL when the modal closes or unmounts -- never inside
  // the fetch effect's own cleanup (see note above).
  useEffect(() => {
    if (resource) return;
    if (activeObjectUrlRef.current) {
      window.URL.revokeObjectURL(activeObjectUrlRef.current);
      activeObjectUrlRef.current = null;
    }
  }, [resource]);

  useEffect(() => {
    return () => {
      if (activeObjectUrlRef.current) window.URL.revokeObjectURL(activeObjectUrlRef.current);
    };
  }, []);

  if (!resource) return null;

  const kind = previewKind(resource);

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        className="modal-panel modal-lg"
        style={{ maxWidth: kind === "unsupported" ? 460 : "min(1000px, 92vw)", padding: 0, overflow: "hidden" }}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-between" style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: "0.9rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {resource.original_filename}
            </div>
            <div className="text-caption">{resource.resource_type}</div>
          </div>
          <div className="flex gap-1">
            <button
              className="icon-btn"
              aria-label="Download"
              onClick={() => downloadResourceFile(resource.id, resource.original_filename)}
            >
              <Download size={16} />
            </button>
            <button className="icon-btn" aria-label="Close" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </div>

        <div style={{ background: "var(--bg-subtle)", minHeight: kind === "unsupported" ? "auto" : "70vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {kind !== "unsupported" && loading && (
            <div className="flex-col" style={{ alignItems: "center", gap: 10, padding: 60, color: "var(--text-muted)" }}>
              <Loader2 size={26} className="spin" />
              <span className="text-caption">Loading preview...</span>
            </div>
          )}

          {kind !== "unsupported" && !loading && error && (
            <div className="state-panel">
              <span className="state-icon error-tone">
                <AlertCircle size={24} />
              </span>
              <p>{error}</p>
            </div>
          )}

          {!loading && !error && objectUrl && kind === "video" && (
            <video controls style={{ width: "100%", maxHeight: "78vh", display: "block", background: "black" }} src={objectUrl} />
          )}

          {!loading && !error && pdfData && kind === "pdf" && (
            <Suspense
              fallback={
                <div className="flex-col" style={{ alignItems: "center", gap: 10, padding: 60, color: "var(--text-muted)" }}>
                  <Loader2 size={26} className="spin" />
                  <span className="text-caption">Loading PDF viewer...</span>
                </div>
              }
            >
              <PdfCanvasViewer data={pdfData} />
            </Suspense>
          )}

          {!loading && !error && objectUrl && kind === "image" && (
            <img src={objectUrl} alt={resource.original_filename} style={{ maxWidth: "100%", maxHeight: "78vh", objectFit: "contain" }} />
          )}

          {kind === "unsupported" && (
            <div className="state-panel" style={{ padding: 40 }}>
              <span className="state-icon">
                <FileWarning size={24} />
              </span>
              <h3>Preview not available</h3>
              <p>
                {resource.file_type.toUpperCase()} files can't be previewed in the browser. Download it to view the full
                content.
              </p>
              <button className="btn btn-primary btn-sm" onClick={() => downloadResourceFile(resource.id, resource.original_filename)}>
                <Download size={14} /> Download
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
