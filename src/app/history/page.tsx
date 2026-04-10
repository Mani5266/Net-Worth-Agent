"use client";

import { useEffect, useState, useCallback } from "react";
import { getAllCertificates, getCertificate, deleteCertificate } from "@/lib/db";
import { CertificateRecord } from "@/types";
import { Button } from "@/components/ui";
import { Modal } from "@/components/ui/Modal";
import { ClientDate } from "@/components/ui/ClientDate";
import { useToast } from "@/components/ui/Toast";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Play, Eye, Trash2 } from "lucide-react";

export default function HistoryPage() {
  const [certificates, setCertificates] = useState<CertificateRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const router = useRouter();
  const { toast } = useToast();

  const loadCertificates = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getAllCertificates();
      setCertificates(data);
    } catch (err) {
      if (err instanceof Error && err.message === "Not authenticated") return;
      toast("Failed to load certificates", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadCertificates();
  }, [loadCertificates]);

  const handleResume = async (id: string) => {
    try {
      const data = await getCertificate(id);
      localStorage.setItem("networth_resume_data", JSON.stringify(data));
      localStorage.setItem("networth_resume_id", id);
      router.push("/");
    } catch {
      toast("Failed to load certificate data", "error");
    }
  };

  const handleView = async (id: string) => {
    try {
      const data = await getCertificate(id);
      localStorage.setItem("networth_resume_data", JSON.stringify(data));
      localStorage.setItem("networth_resume_id", id);
      localStorage.setItem("networth_view_only", "true");
      router.push("/");
    } catch {
      toast("Failed to load certificate data", "error");
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteCertificate(deleteTarget);
      await loadCertificates();
      toast("Certificate deleted", "success");
    } catch {
      toast("Failed to delete certificate", "error");
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black text-navy-950 tracking-tight">
              Certificate History
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              View and resume your saved drafts
            </p>
          </div>
          <Link href="/">
            <Button variant="outline" size="sm">
              <span className="inline-flex items-center gap-1.5">
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to Generator
              </span>
            </Button>
          </Link>
        </div>

        <div className="bg-white shadow-sm border border-slate-200 rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <div className="inline-block w-8 h-8 border-4 border-navy-700 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-slate-500 animate-pulse">Loading certificates...</p>
            </div>
          ) : certificates.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              No certificates found. Start by creating one!
            </div>
          ) : (
            <>
              {/* Desktop Table (hidden on mobile) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-navy-50/50 border-b border-slate-200">
                      <th className="px-6 py-4 text-xs font-bold text-navy-800 uppercase tracking-widest">Client Name</th>
                      <th className="px-6 py-4 text-xs font-bold text-navy-800 uppercase tracking-widest">Purpose</th>
                      <th className="px-6 py-4 text-xs font-bold text-navy-800 uppercase tracking-widest">Date</th>
                      <th className="px-6 py-4 text-xs font-bold text-navy-800 uppercase tracking-widest">Status</th>
                      <th className="px-6 py-4 text-xs font-bold text-navy-800 uppercase tracking-widest">Created At</th>
                      <th className="px-6 py-4 text-xs font-bold text-navy-800 uppercase tracking-widest text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-sm">
                    {certificates.map((cert) => (
                      <tr key={cert.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 font-semibold text-slate-900">{cert.clientName}</td>
                        <td className="px-6 py-4 text-slate-600 capitalize">{cert.purpose.replace(/_/g, " ")}</td>
                        <td className="px-6 py-4 text-slate-600">{cert.certDate}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${
                            cert.status === 'completed' 
                              ? 'bg-emerald-100 text-emerald-700' 
                              : 'bg-amber-100 text-amber-700'
                          }`}>
                            {cert.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-400">
                          <ClientDate date={cert.createdAt} />
                        </td>
                        <td className="px-6 py-4 text-right space-x-2">
                          <Button variant="primary" size="sm" className="px-4" onClick={() => handleResume(cert.id)}>
                            Resume
                          </Button>
                          <Button variant="secondary" size="sm" className="px-4" onClick={() => handleView(cert.id)}>
                            View
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="px-4 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                            onClick={() => setDeleteTarget(cert.id)}
                          >
                            Delete
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card Layout (visible on mobile only) */}
              <div className="md:hidden divide-y divide-slate-200">
                {certificates.map((cert) => (
                  <div key={cert.id} className="p-4 space-y-3">
                    {/* Name + Status */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-slate-900 text-sm">{cert.clientName}</p>
                        <p className="text-xs text-slate-500 capitalize mt-0.5">
                          {cert.purpose.replace(/_/g, " ")}
                        </p>
                      </div>
                      <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${
                        cert.status === 'completed' 
                          ? 'bg-emerald-100 text-emerald-700' 
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {cert.status}
                      </span>
                    </div>

                    {/* Meta */}
                    <div className="flex items-center gap-4 text-xs text-slate-400">
                      <span>Date: {cert.certDate}</span>
                      <span>Created: <ClientDate date={cert.createdAt} /></span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <Button variant="primary" size="sm" className="flex-1" onClick={() => handleResume(cert.id)}>
                        <span className="inline-flex items-center justify-center gap-1.5">
                          <Play className="w-3 h-3" />
                          Resume
                        </span>
                      </Button>
                      <Button variant="secondary" size="sm" className="flex-1" onClick={() => handleView(cert.id)}>
                        <span className="inline-flex items-center justify-center gap-1.5">
                          <Eye className="w-3 h-3" />
                          View
                        </span>
                      </Button>
                      <button
                        onClick={() => setDeleteTarget(cert.id)}
                        className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        aria-label={`Delete certificate for ${cert.clientName}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        open={deleteTarget !== null}
        title="Delete Certificate"
        onClose={() => setDeleteTarget(null)}
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
        Are you sure you want to delete this certificate? This action cannot be undone.
      </Modal>
    </div>
  );
}
