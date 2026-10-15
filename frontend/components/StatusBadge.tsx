"use client";

interface StatusBadgeProps {
  status: string;
  stage?: string | null;
  progress?: number;
}

export function StatusBadge({ status, stage, progress = 0 }: Readonly<StatusBadgeProps>) {
  const normalizedStatus = status.toLowerCase();
  const chipClass = `status-chip status-${normalizedStatus}`;

  const label = stage && stage !== normalizedStatus ? `${status} (${stage})` : status;
  const progressLabel = `Processing progress for ${stage || status}: ${progress}%`;

  return (
    <div>
      <span className={chipClass}>{label}</span>
      {progress > 0 && progress < 100 && (
        <div
          className="progress-track"
          role="progressbar"
          aria-label={progressLabel}
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  );
}
