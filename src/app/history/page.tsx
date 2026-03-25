"use client";

import { useEffect, useState } from "react";
import { getAllCertificates, getCertificate, deleteCertificate } from "@/lib/db";
import { CertificateRecord } from "@/types";
import { Button } from "@/components/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";

export default function HistoryPage() {
  const [certificates, setCertificates] = useState<CertificateRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // 1. Initial Check
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthChecking(false);
      if (!session) router.push("/");
    });

    // 2. Subscribe
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) router.push("/");
    });

    return () => subscription.unsubscribe();
  }, [router]);

  useEffect(() => {
    if (session) {
      loadCertificates();
    }
  }, [session]);

  const loadCertificates = async () => {
    try {
      setLoading(true);
      const data = await getAllCertificates();
      setCertificates(data);
    } catch (err) {
      console.error("Failed to load certificates:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleResume = async (id: string) => {
    try {
      const data = await getCertificate(id);
      // Store in localStorage for the HomePage to pick up
      localStorage.setItem("networth_resume_data", JSON.stringify(data));
      localStorage.setItem("networth_resume_id", id);
      router.push("/");
    } catch (err) {
      console.error("Failed to resume certificate:", err);
      alert("Failed to load certificate data.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this certificate? This action cannot be undone.")) return;
    try {
      await deleteCertificate(id);
      await loadCertificates();
    } catch (err) {
      console.error("Failed to delete certificate:", err);
      alert("Failed to delete certificate.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black text-emerald-900 tracking-tight">
              Certificate History
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              View and resume your saved drafts
            </p>
          </div>
          <Link href="/">
            <Button variant="outline" size="sm">
              ← Back to Generator
            </Button>
          </Link>
        </div>

        <div className="bg-white shadow-sm border border-gray-200 rounded-xl overflow-hidden">
          {authChecking || loading ? (
            <div className="p-12 text-center">
              <div className="inline-block w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-gray-500 animate-pulse">{authChecking ? "Checking authorization..." : "Loading certificates..."}</p>
            </div>
          ) : !session ? (
            <div className="p-12 text-center text-gray-500">
              Please log in to view your history. Redirecting...
            </div>
          ) : certificates.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              No certificates found. Start by creating one!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-emerald-50/50 border-b border-gray-200">
                    <th className="px-6 py-4 text-xs font-bold text-emerald-800 uppercase tracking-widest">Client Name</th>
                    <th className="px-6 py-4 text-xs font-bold text-emerald-800 uppercase tracking-widest">Purpose</th>
                    <th className="px-6 py-4 text-xs font-bold text-emerald-800 uppercase tracking-widest">Date</th>
                    <th className="px-6 py-4 text-xs font-bold text-emerald-800 uppercase tracking-widest">Status</th>
                    <th className="px-6 py-4 text-xs font-bold text-emerald-800 uppercase tracking-widest">Created At</th>
                    <th className="px-6 py-4 text-xs font-bold text-emerald-800 uppercase tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 text-sm">
                  {certificates.map((cert) => (
                    <tr key={cert.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-semibold text-gray-900">{cert.clientName}</td>
                      <td className="px-6 py-4 text-gray-600 capitalize">{cert.purpose.replace(/_/g, " ")}</td>
                      <td className="px-6 py-4 text-gray-600">{cert.certDate}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${
                          cert.status === 'completed' 
                            ? 'bg-emerald-100 text-emerald-700' 
                            : 'bg-amber-100 text-amber-700'
                        }`}>
                          {cert.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-400">
                        <ClientDate date={cert.createdAt} />
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <Button 
                          variant="primary" 
                          size="sm" 
                          className="px-4"
                          onClick={() => handleResume(cert.id)}
                        >
                          Resume
                        </Button>
                        <Button 
                          variant="secondary" 
                          size="sm" 
                          className="px-4"
                          onClick={async () => {
                            try {
                              const data = await getCertificate(cert.id);
                              localStorage.setItem("networth_resume_data", JSON.stringify(data));
                              localStorage.setItem("networth_resume_id", cert.id);
                              localStorage.setItem("networth_view_only", "true");
                              router.push("/");
                            } catch (err) {
                              console.error("Failed to load certificate for view:", err);
                              alert("Failed to load data.");
                            }
                          }}
                        >
                          View
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="px-4 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                          onClick={() => handleDelete(cert.id)}
                        >
                          Delete
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ClientDate({ date }: { date: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return <>{new Date(date).toLocaleDateString()}</>;
}
