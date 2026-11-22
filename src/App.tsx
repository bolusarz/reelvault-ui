import { type DragEvent, useRef, useState } from "react";

const UPLOAD_URL = "http://localhost:8000/upload";

type Status = "idle" | "uploading" | "done" | "error";

const CHUNK_SIZE = 1 * 1024 * 1024;

function sendChunk(
  body: FormData,
  onProgress: (loaded: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", UPLOAD_URL);
    xhr.upload.onprogress = (e) => onProgress(e.loaded);
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Upload failed (${xhr.status})`));
    xhr.onerror = () => reject(new Error("Could not reach the upload server."));
    xhr.send(body);
  });
}

async function uploadFile(
  file: File,
  onProgress: (pct: number) => void,
): Promise<void> {
  const totalChunks = Math.max(1, Math.ceil(file.size / CHUNK_SIZE));

  // Chain the chunks so they upload strictly one after another.
  await Array.from({ length: totalChunks }).reduce<Promise<void>>(
    (previous, _, index) =>
      previous.then(() => {
        const start = index * CHUNK_SIZE;
        const body = new FormData();
        body.append("fileName", file.name);
        body.append("totalChunks", String(totalChunks));
        body.append("chunkNumber", String(index + 1));
        body.append("chunk", file.slice(start, start + CHUNK_SIZE), file.name);
        return sendChunk(body, (loaded) =>
          onProgress(
            Math.min(100, Math.round(((start + loaded) / file.size) * 100)),
          ),
        );
      }),
    Promise.resolve(),
  );
  onProgress(100);
}

function formatSize(bytes: number) {
  const mb = bytes / (1024 * 1024);
  return mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(1)} MB`;
}

export default function App() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState(0);

  const pick = async (f: File | undefined) => {
    if (!f) return;
    if (!f.type.startsWith("video/")) {
      setError("Please choose a video file.");
      return;
    }
    setError(null);
    setFile(f);
    setProgress(0);
    setStatus("uploading");
    try {
      await uploadFile(f, setProgress);
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Upload failed.");
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    void pick(e.dataTransfer.files[0]);
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-neutral-950 p-6 text-neutral-100">
      <header className="text-center">
        <h1 className="text-4xl font-bold tracking-tight">ReelVault</h1>
        <p className="mt-2 text-neutral-400">Upload a video to get started.</p>
      </header>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`flex w-full max-w-xl cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-8 py-16 transition-colors ${
          dragging
            ? "border-violet-400 bg-violet-500/10"
            : "border-neutral-700 hover:border-neutral-500"
        }`}
      >
        <svg
          aria-hidden="true"
          className="size-12 text-neutral-400"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          viewBox="0 0 24 24"
        >
          <path
            d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M7.5 7.5 12 3m0 0 4.5 4.5M12 3v13.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="text-lg font-medium">
          Drag & drop a video here, or click to browse
        </span>
        <span className="text-sm text-neutral-500">
          MP4, MOV, WebM and more
        </span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => void pick(e.target.files?.[0])}
      />

      {status === "uploading" && (
        <p className="text-neutral-300">Uploading… {progress}%</p>
      )}
      {status === "done" && <p className="text-green-400">Upload complete.</p>}
      {error && <p className="text-red-400">{error}</p>}
      {file && (
        <p className="text-neutral-300">
          Selected: <span className="font-medium">{file.name}</span> (
          {formatSize(file.size)})
        </p>
      )}
    </main>
  );
}
