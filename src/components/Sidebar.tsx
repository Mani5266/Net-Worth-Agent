"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui";
import type { CertificateRecord } from "@/types";
import type { Session } from "@supabase/supabase-js";

interface SidebarProps {
  session: Session;
  history: CertificateRecord[];
  certificateId: string | null;
  onNewCertificate: () => void;
  onSwitchCertificate: (id: string) => Promise<void>;
  onRename: (id: string, newName: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onSignOut: () => void;
  loading: boolean;
}

export function Sidebar({
  session,
  history,
  certificateId,
  onNewCertificate,
  onSwitchCertificate,
  onRename,
  onDelete,
  onSignOut,
  loading,
}: SidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const handleRename = async (id: string) => {
    if (!editValue.trim()) {
      setEditingId(null);
      return;
    }
    await onRename(id, editValue.trim());
    setEditingId(null);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this certificate?")) return;
    await onDelete(id);
  };

  return (
    <aside className="w-full lg:w-80 bg-white border-b lg:border-r border-gray-200 p-6 flex flex-col no-print">
      {/* Logo */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 bg-emerald-700 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-lg shadow-emerald-200">
          N
        </div>
        <h1 className="text-xl font-black text-emerald-900 tracking-tight leading-tight">
          Net Worth<br/>Agent
        </h1>
      </div>

      {/* New Certificate */}
      <Button
        variant="primary"
        className="w-full justify-start gap-2 mb-8 py-3 rounded-xl shadow-md shadow-emerald-100"
        onClick={onNewCertificate}
      >
        <span className="text-lg">+</span> New Certificate
      </Button>

      {/* Certificate List */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex items-center justify-between mb-4 px-1">
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">
            Recent Certificates
          </h2>
          <Link href="/history" className="text-[10px] font-bold text-emerald-700 hover:underline px-1">
            View All
          </Link>
        </div>

        <div className="space-y-2">
          {history.length === 0 ? (
            <p className="text-xs text-center text-gray-400 py-8 italic">No drafts yet.</p>
          ) : (
            history.slice(0, 10).map((cert) => (
              <div
                key={cert.id}
                className={`relative group w-full rounded-xl transition-all border ${
                  certificateId === cert.id
                    ? "bg-emerald-50 border-emerald-200 ring-1 ring-emerald-100"
                    : "bg-white border-transparent hover:border-gray-200 hover:bg-gray-50/50"
                }`}
              >
                {editingId === cert.id ? (
                  <div className="p-3">
                    <input
                      autoFocus
                      className="w-full text-[13px] font-bold bg-white border border-emerald-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={() => handleRename(cert.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRename(cert.id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                    />
                  </div>
                ) : (
                  <button
                    onClick={() => onSwitchCertificate(cert.id)}
                    disabled={loading}
                    className="w-full text-left p-3 pr-10"
                  >
                    <p className="text-[13px] font-bold text-gray-800 line-clamp-1 group-hover:text-emerald-800 transition-colors">
                      {cert.nickname || cert.clientName || "Unnamed Client"}
                    </p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[10px] text-gray-400 font-medium">
                        <ClientDate date={cert.createdAt} />
                      </span>
                      <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded leading-none ${
                        cert.status === "completed"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                      }`}>
                        {cert.status}
                      </span>
                    </div>
                  </button>
                )}

                {editingId !== cert.id && (
                  <div className="absolute right-2 top-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingId(cert.id);
                        setEditValue(cert.nickname || cert.clientName || "");
                      }}
                      className="p-1 text-gray-400 hover:text-emerald-600 transition-colors"
                      title="Rename"
                    >
                      ✏
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(cert.id);
                      }}
                      className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                      title="Delete"
                    >
                      x
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* User Footer */}
      <div className="mt-8 pt-6 border-t border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-xs shrink-0">
              {(session.user?.email?.[0] ?? "?").toUpperCase()}
            </div>
            <p className="text-[11px] font-bold text-gray-600 truncate">
              {session.user?.email}
            </p>
          </div>
          <button
            onClick={onSignOut}
            className="p-2 text-gray-400 hover:text-red-600 transition-colors"
            title="Sign Out"
          >
            Sign Out
          </button>
        </div>
      </div>
    </aside>
  );
}

function ClientDate({ date }: { date: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return <>{new Date(date).toLocaleDateString()}</>;
}
