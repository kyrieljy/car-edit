'use client';

import { useState } from 'react';
import { Download, FileText, Calendar, BarChart3 } from 'lucide-react';
import type { ReportType } from '@/lib/types';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ReportGenerator() {
  const [reportType, setReportType] = useState<ReportType>('daily');
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await fetch(`/api/admin/reports/generate?type=${reportType}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const filename = res.headers.get('Content-Disposition')?.split('filename=')[1]?.replace(/"/g, '') || 'report.csv';
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      }
    } catch {
      // noop
    } finally {
      setDownloading(false);
    }
  };

  const reportOptions: Array<{ value: ReportType; label: string; icon: React.ReactNode; desc: string }> = [
    { value: 'daily', label: 'Daily Report', icon: <FileText size={18} />, desc: 'Last 24 hours, hourly granularity' },
    { value: 'weekly', label: 'Weekly Report', icon: <Calendar size={18} />, desc: 'Last 7 days, daily granularity' },
    { value: 'monthly', label: 'Monthly Report', icon: <BarChart3 size={18} />, desc: 'Last 30 days, daily granularity' },
  ];

  return (
    <div className="analytics-page">
      <div className="analytics-chart-card">
        <div className="analytics-chart-header">
          <h3>Generate Report</h3>
        </div>
        <div className="analytics-chart-body" style={{ padding: '24px' }}>
          <div className="report-options">
            {reportOptions.map((opt) => (
              <button
                key={opt.value}
                className={`report-option ${reportType === opt.value ? 'selected' : ''}`}
                onClick={() => setReportType(opt.value)}
              >
                <span className="report-option-icon">{opt.icon}</span>
                <span className="report-option-label">{opt.label}</span>
                <span className="report-option-desc">{opt.desc}</span>
              </button>
            ))}
          </div>

          <button
            className="report-download-btn"
            onClick={handleDownload}
            disabled={downloading}
          >
            <Download size={16} />
            {downloading ? 'Generating...' : 'Download CSV'}
          </button>
        </div>
      </div>
    </div>
  );
}
