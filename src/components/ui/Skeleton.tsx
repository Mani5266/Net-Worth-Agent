"use client";

/**
 * Skeleton loader components for showing content placeholders while loading.
 */

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-slate-200 ${className ?? ""}`}
      aria-hidden="true"
    />
  );
}

/**
 * A form-step shaped skeleton with heading, label rows, and input blocks.
 * Used when restoring a draft or switching certificates.
 */
export function StepSkeleton() {
  return (
    <div className="space-y-6" aria-label="Loading content" role="status">
      {/* Section card */}
      <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
        {/* Title */}
        <Skeleton className="h-5 w-48 mb-5" />
        <div className="h-px bg-navy-100 mb-5" />

        {/* Form rows */}
        <div className="space-y-5">
          {/* Row 1: Short label + input */}
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-10 w-full" />
          </div>

          {/* Row 2: Two column */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>

          {/* Row 3 */}
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-10 w-full" />
          </div>

          {/* Row 4: Checkbox-like rows */}
          <div className="space-y-2">
            <Skeleton className="h-3 w-20" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-3 w-40" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-3 w-36" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-3 w-44" />
            </div>
          </div>
        </div>
      </div>

      {/* Screen reader text */}
      <span className="sr-only">Loading, please wait...</span>
    </div>
  );
}
