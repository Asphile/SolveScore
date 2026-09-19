import axios from "axios";

const baseURL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export const api = axios.create({ baseURL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("solvescore_token");
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("solvescore_token");
      localStorage.removeItem("solvescore_user");
      if (!window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export async function downloadResourceFile(resourceId: string, filename: string): Promise<void> {
  const response = await api.get(`/api/resources/${resourceId}/file`, { responseType: "blob" });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener";
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
}

export interface ResourceBlob {
  objectUrl: string;
  mimeType: string;
}

/** Fetches a resource's bytes and hands back an in-memory object URL for inline
 * viewing (video/PDF/image). Caller owns the URL and must revoke it when done
 * (e.g. on modal close/unmount) to avoid leaking memory. */
export async function fetchResourceBlob(resourceId: string): Promise<ResourceBlob> {
  const response = await api.get(`/api/resources/${resourceId}/file`, { responseType: "blob" });
  const mimeType: string = response.data.type || response.headers["content-type"] || "application/octet-stream";
  return { objectUrl: window.URL.createObjectURL(response.data), mimeType };
}

/** Fetches a resource's raw bytes for client-side rendering (e.g. PDF.js),
 * bypassing the browser's native PDF handling entirely -- avoids both the
 * inconsistent iframe-embedded-PDF rendering across browsers and any
 * "always download PDFs" browser setting hijacking an in-page preview. */
export async function fetchResourceArrayBuffer(resourceId: string): Promise<ArrayBuffer> {
  const response = await api.get(`/api/resources/${resourceId}/file`, { responseType: "arraybuffer" });
  return response.data;
}

export function apiErrorMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg;
  }
  return fallback;
}
