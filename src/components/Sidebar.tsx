"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui";
import { Modal } from "@/components/ui/Modal";
import { ClientDate } from "@/components/ui/ClientDate";
import type { CertificateRecord } from "@/types";
import type { Session } from "@supabase/supabase-js";
import {
  Plus,
  Pencil,
  Trash2,
  LogOut,
  Menu,
  X,
  History,
  FileText,
  CheckCircle2,
} from "lucide-react";

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
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile drawer on route change / resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) setMobileOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleRename = async (id: string) => {
    if (!editValue.trim()) {
      setEditingId(null);
      return;
    }
    await onRename(id, editValue.trim());
    setEditingId(null);
  };

  const confirmDelete = async () => {
    if (deleteTarget) {
      await onDelete(deleteTarget);
      setDeleteTarget(null);
    }
  };

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 bg-emerald-800 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-lg shadow-emerald-800/20">
          N
        </div>
        <h1 className="text-xl font-black text-emerald-900 tracking-tight leading-tight">
          Net Worth<br />Agent
        </h1>
      </div>

      {/* New Certificate */}
      <Button
        variant="primary"
        className="w-full justify-center gap-2 mb-8 py-3 rounded-xl shadow-md shadow-emerald-800/10"
        onClick={() => {
          onNewCertificate();
          setMobileOpen(false);
        }}
      >
        <Plus className="w-4 h-4" /> New Certificate
      </Button>

      {/* Certificate List */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex items-center justify-between mb-4 px-1">
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
            Recent Certificates
          </h2>
          <Link
            href="/history"
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 transition-colors"
            onClick={() => setMobileOpen(false)}
          >
            <History className="w-3 h-3" />
            View All
          </Link>
        </div>

        <div className="space-y-1.5">
          {history.length === 0 ? (
            <p className="text-xs text-center text-slate-400 py-8 italic">
              No drafts yet. Create your first certificate above.
            </p>
          ) : (
            history.slice(0, 10).map((cert) => (
              <div
                key={cert.id}
                className={`relative group w-full rounded-xl transition-all border ${
                  certificateId === cert.id
                    ? "bg-emerald-50 border-emerald-200 ring-1 ring-emerald-100"
                    : "bg-white border-transparent hover:border-slate-200 hover:bg-slate-50/50"
                }`}
              >
                {editingId === cert.id ? (
                  <div className="p-3">
                    <input
                      autoFocus
                      className="w-full text-[13px] font-bold bg-white border border-emerald-300 rounded-lg px-2.5 py-1.5
                        focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
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
                    onClick={() => {
                      onSwitchCertificate(cert.id);
                      setMobileOpen(false);
                    }}
                    disabled={loading}
                    className="w-full text-left p-3 pr-16 flex items-start gap-2.5"
                  >
                    <div
                      className={`mt-0.5 shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${
                        cert.status === "completed"
                          ? "bg-emerald-100 text-emerald-600"
                          : certificateId === cert.id
                            ? "bg-emerald-100 text-emerald-600"
                            : "bg-slate-100 text-slate-400 group-hover:bg-emerald-50 group-hover:text-emerald-500"
                      } transition-colors`}
                    >
                      {cert.status === "completed" ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : (
                        <FileText className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-bold text-slate-800 line-clamp-1 group-hover:text-emerald-800 transition-colors">
                        {cert.nickname || cert.clientName || "Unnamed Client"}
                      </p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[10px] text-slate-500 font-medium">
                          <ClientDate date={cert.createdAt} />
                        </span>
                        <span
                          className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded leading-none ${
                            cert.status === "completed"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {cert.status}
                        </span>
                      </div>
                    </div>
                  </button>
                )}

                {editingId !== cert.id && (
                  <div className="absolute right-2 top-3 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingId(cert.id);
                        setEditValue(cert.nickname || cert.clientName || "");
                      }}
                      className="p-1.5 text-slate-400 hover:text-emerald-600 transition-colors rounded-md hover:bg-emerald-50"
                      aria-label="Rename certificate"
                      title="Rename"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(cert.id);
                      }}
                      className="p-1.5 text-slate-400 hover:text-red-500 transition-colors rounded-md hover:bg-red-50"
                      aria-label="Delete certificate"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* User Footer */}
      <div className="mt-8 pt-6 border-t border-slate-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-xs shrink-0">
              {(session.user?.email?.[0] ?? "?").toUpperCase()}
            </div>
            <p className="text-[11px] font-semibold text-slate-600 truncate">
              {session.user?.email}
            </p>
          </div>
          <button
            onClick={onSignOut}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-500
              hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            aria-label="Sign out"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Certificate"
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={confirmDelete}>
              Delete
            </Button>
          </>
        }
      >
        <p>
          Are you sure you want to delete this certificate? This action cannot be undone.
        </p>
      </Modal>
    </>
  );

  return (
    <>
      {/* Mobile hamburger button */}
      <div className="lg:hidden fixed top-4 left-4 z-40 no-print">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2.5 bg-white border border-slate-200 rounded-xl shadow-md hover:bg-slate-50 transition-colors"
          aria-label="Open sidebar menu"
        >
          <Menu className="w-5 h-5 text-slate-700" />
        </button>
      </div>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar - desktop: static, mobile: drawer */}
      <aside
        className={`
          fixed lg:sticky top-0 left-0 z-50 lg:z-auto
          h-screen w-80 bg-white border-r border-slate-200 p-6 flex flex-col no-print
          transition-transform duration-300 ease-in-out
          ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        {/* Mobile close button */}
        <button
          onClick={() => setMobileOpen(false)}
          className="lg:hidden absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 transition-colors"
          aria-label="Close sidebar menu"
        >
          <X className="w-5 h-5" />
        </button>

        {sidebarContent}
      </aside>
    </>
  );
}
