"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { Modal } from "@/components/ui/Modal";
import { ClientDate } from "@/components/ui/ClientDate";
import { supabase } from "@/lib/supabase";
import type { CertificateRecord } from "@/types";
import {
  Plus,
  Pencil,
  Trash2,
  Menu,
  X,
  History,
  FileText,
  CheckCircle2,
  LogOut,
  Sparkles,
} from "lucide-react";

interface SidebarProps {
  history: CertificateRecord[];
  certificateId: string | null;
  onNewCertificate: () => void;
  onSwitchCertificate: (id: string) => Promise<void>;
  onRename: (id: string, newName: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onToggleChat: () => void;
  loading: boolean;
}

export function Sidebar({
  history,
  certificateId,
  onNewCertificate,
  onSwitchCertificate,
  onRename,
  onDelete,
  onToggleChat,
  loading,
}: SidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserEmail(user.email ?? null);
    });
  }, []);

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
        <div className="w-10 h-10 bg-gold-500 rounded-2xl flex items-center justify-center text-navy-950 font-black text-lg shadow-lg shadow-gold-500/20">
          O
        </div>
        <div>
          <h1 className="text-xl font-extrabold text-white tracking-tight leading-tight">
            OnEasy
          </h1>
          <p className="text-[11px] font-semibold text-gold-400 tracking-wide leading-tight">
            Net Worth Agent
          </p>
        </div>
      </div>

      {/* New Certificate */}
      <button
        onClick={() => {
          onNewCertificate();
          setMobileOpen(false);
        }}
        className="w-full flex items-center justify-center gap-2 mb-3 py-3 px-4 rounded-xl font-semibold text-sm
          text-navy-950 bg-white hover:bg-slate-100 shadow-md shadow-black/10
          transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gold-500/30 focus:ring-offset-2 focus:ring-offset-navy-900"
      >
        <Plus className="w-4 h-4" /> New Certificate
      </button>

      {/* AI Intake */}
      <button
        onClick={() => {
          onToggleChat();
          setMobileOpen(false);
        }}
        className="w-full flex items-center justify-center gap-2 mb-8 py-2.5 px-4 rounded-xl font-semibold text-sm
          text-gold-400 bg-gold-500/10 hover:bg-gold-500/20 border border-gold-500/20
          transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gold-500/30 focus:ring-offset-2 focus:ring-offset-navy-900"
      >
        <Sparkles className="w-4 h-4" /> Fill with AI
      </button>

      {/* Certificate List */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex items-center justify-between mb-4 px-1">
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
            Recent Drafts
          </h2>
        </div>

        <div className="space-y-1.5">
          {history.length === 0 ? (
            <p className="text-xs text-center text-slate-500 py-8 italic">
              No drafts yet. Create your first certificate above.
            </p>
          ) : (
            history.slice(0, 10).map((cert) => (
              <div
                key={cert.id}
                className={`relative group w-full rounded-xl transition-all border ${
                  certificateId === cert.id
                    ? "bg-navy-800/60 border-gold-500/30 ring-1 ring-gold-500/20"
                    : "bg-transparent border-transparent hover:bg-navy-800/40 hover:border-navy-700/50"
                }`}
              >
                {editingId === cert.id ? (
                  <div className="p-3">
                    <input
                      autoFocus
                      className="w-full text-[13px] font-bold bg-navy-800 border border-gold-500/40 rounded-lg px-2.5 py-1.5
                        text-white placeholder:text-slate-500
                        focus:outline-none focus:ring-2 focus:ring-gold-500/30 focus:border-gold-500"
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
                      className={`mt-0.5 shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                        cert.status === "completed"
                          ? "bg-emerald-500/20 text-emerald-400"
                          : certificateId === cert.id
                            ? "bg-gold-500/20 text-gold-400"
                            : "bg-navy-700/50 text-slate-500 group-hover:bg-navy-700 group-hover:text-slate-400"
                      }`}
                    >
                      {cert.status === "completed" ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : (
                        <FileText className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-bold text-slate-200 line-clamp-1 group-hover:text-white transition-colors">
                        {cert.nickname || cert.clientName || "Unnamed Client"}
                      </p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[10px] text-slate-500 font-medium">
                          <ClientDate date={cert.createdAt} />
                        </span>
                        <span
                          className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded leading-none ${
                            cert.status === "completed"
                              ? "bg-emerald-500/20 text-emerald-400"
                              : "bg-gold-500/20 text-gold-400"
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
                      className="p-1.5 text-slate-500 hover:text-gold-400 transition-colors rounded-md hover:bg-navy-700/50"
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
                      className="p-1.5 text-slate-500 hover:text-red-400 transition-colors rounded-md hover:bg-red-500/10"
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

      {/* Bottom section */}
      <div className="mt-auto pt-4 border-t border-navy-700/50">
        {userEmail && (
          <p className="text-[11px] text-slate-500 truncate mb-3 px-1" title={userEmail}>
            {userEmail}
          </p>
        )}

        {/* Generator / History nav buttons */}
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={() => setMobileOpen(false)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold
              text-white bg-navy-700/60 hover:bg-navy-700 transition-all"
          >
            <FileText className="w-3.5 h-3.5" />
            Generator
          </button>
          <Link
            href="/history"
            onClick={() => setMobileOpen(false)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold
              text-slate-400 hover:text-white hover:bg-navy-700/60 transition-all"
          >
            <History className="w-3.5 h-3.5" />
            History
          </Link>
        </div>

        <button
          onClick={async () => {
            await supabase.auth.signOut();
            router.push("/login");
          }}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium
            text-slate-400 hover:text-red-400 hover:bg-red-500/10
            transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-500/20"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
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
          className="p-2.5 bg-navy-900 border border-navy-700 rounded-xl shadow-md hover:bg-navy-800 transition-colors"
          aria-label="Open sidebar menu"
        >
          <Menu className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-navy-950/60 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:sticky top-0 left-0 z-50 lg:z-auto
          h-screen w-72 bg-navy-900 border-r border-navy-800 p-6 flex flex-col no-print
          transition-transform duration-300 ease-in-out
          ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        {/* Mobile close button */}
        <button
          onClick={() => setMobileOpen(false)}
          className="lg:hidden absolute top-4 right-4 p-1.5 text-slate-500 hover:text-white transition-colors"
          aria-label="Close sidebar menu"
        >
          <X className="w-5 h-5" />
        </button>

        {sidebarContent}
      </aside>
    </>
  );
}
