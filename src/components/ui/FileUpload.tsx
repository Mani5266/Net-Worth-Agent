"use client";

import React, { useRef, useState, useCallback } from "react";
import type { UploadedDoc } from "@/types";

interface FileUploadProps {
  label: string;
  docs: UploadedDoc[];
  onAdd: (files: File[]) => void;
  onRemove: (index: number) => void;
  hint?: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileUpload({ label, docs, onAdd, onRemove, hint }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return;
      const valid = Array.from(files).filter((f) =>
        ["application/pdf", "image/jpeg", "image/jpg"].includes(f.type) ||
        f.name.toLowerCase().endsWith(".pdf") ||
        f.name.toLowerCase().endsWith(".jpg") ||
        f.name.toLowerCase().endsWith(".jpeg")
      );
      if (valid.length > 0) onAdd(valid);
    },
    [onAdd]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const iconForFile = (name: string) =>
    name.toLowerCase().endsWith(".pdf") ? "📄" : "🖼️";

  return (
    <div className="mt-2 mb-3">
      <p className="text-xs font-semibold text-emerald-800 mb-1.5">
        📎 Documents for <span className="italic">{label}</span>
      </p>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`flex flex-col items-center justify-center gap-1 border-2 border-dashed
          rounded-xl px-4 py-4 cursor-pointer transition-all text-center
          ${dragging
            ? "border-emerald-500 bg-emerald-50"
            : "border-gray-200 hover:border-emerald-400 bg-gray-50 hover:bg-emerald-50"
          }`}
      >
        <span className="text-xl">📁</span>
        <p className="text-xs text-gray-500">
          Drag &amp; drop or <span className="text-emerald-700 font-semibold">click to upload</span>
        </p>
        <p className="text-[10px] text-gray-400">{hint || "PDF or JPG accepted"}</p>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,application/pdf,image/jpeg"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {/* File list */}
      {docs.length > 0 && (
        <ul className="mt-2 space-y-1">
          {docs.map((doc, i) => (
            <li
              key={i}
              className="flex items-center justify-between bg-white border border-gray-100 rounded-lg px-3 py-1.5 text-xs"
            >
              <span className="flex items-center gap-1.5 truncate">
                <span>{iconForFile(doc.name)}</span>
                <span className="truncate max-w-[200px] text-gray-700">{doc.name}</span>
                <span className="text-gray-400 shrink-0">({formatSize(doc.size)})</span>
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); onRemove(i); }}
                className="ml-2 text-red-400 hover:text-red-600 font-bold shrink-0"
                title="Remove"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
