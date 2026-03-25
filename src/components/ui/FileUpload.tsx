"use client";

import React, { useRef, useState, useCallback } from "react";
import { Paperclip, FolderUp, FileText, ImageIcon, X } from "lucide-react";
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
    name.toLowerCase().endsWith(".pdf")
      ? <FileText className="w-3.5 h-3.5 text-red-500 shrink-0" />
      : <ImageIcon className="w-3.5 h-3.5 text-blue-500 shrink-0" />;

  return (
    <div className="mt-2 mb-3">
      <p className="text-xs font-semibold text-navy-800 mb-1.5 flex items-center gap-1.5">
        <Paperclip className="w-3.5 h-3.5" />
        Documents for <span className="italic">{label}</span>
      </p>

      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        aria-label={`Upload documents for ${label}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); inputRef.current?.click(); } }}
        className={`flex flex-col items-center justify-center gap-1 border-2 border-dashed
          rounded-xl px-4 py-4 cursor-pointer transition-all text-center
          focus:outline-none focus:ring-2 focus:ring-navy-900/10
          ${dragging
            ? "border-navy-500 bg-navy-50"
            : "border-slate-200 hover:border-navy-400 bg-slate-50 hover:bg-navy-50"
          }`}
      >
        <FolderUp className="w-5 h-5 text-slate-400" />
        <p className="text-xs text-slate-500">
          Drag &amp; drop or <span className="text-navy-700 font-semibold">click to upload</span>
        </p>
        <p className="text-[10px] text-slate-400">{hint || "PDF or JPG accepted"}</p>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,application/pdf,image/jpeg"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
          aria-label={`File input for ${label}`}
        />
      </div>

      {/* File list */}
      {docs.length > 0 && (
        <ul className="mt-2 space-y-1">
          {docs.map((doc, i) => (
            <li
              key={i}
              className="flex items-center justify-between bg-white border border-slate-100 rounded-lg px-3 py-1.5 text-xs"
            >
              <span className="flex items-center gap-1.5 truncate">
                {iconForFile(doc.name)}
                <span className="truncate max-w-[200px] text-slate-700">{doc.name}</span>
                <span className="text-slate-400 shrink-0">({formatSize(doc.size)})</span>
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); onRemove(i); }}
                className="ml-2 p-0.5 text-red-400 hover:text-red-600 rounded transition-colors shrink-0"
                aria-label={`Remove ${doc.name}`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
