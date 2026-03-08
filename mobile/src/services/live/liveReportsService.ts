import { supabase } from '../supabaseClient';
import { loadSessionToken } from '../storage';
import type { ReportService } from '../contracts';
import type { AdminOverview, ExportedReport, ReportSummary } from '../../types/domain';

interface Envelope<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const token = await loadSessionToken();
  if (!token) {
    throw new Error('No active session token was found.');
  }

  const { data, error } = await supabase.functions.invoke<Envelope<T>>('report-export', {
    body: { ...body, token },
  });

  if (error) {
    throw new Error(error.message);
  }
  if (!data?.ok || !data.data) {
    throw new Error(data?.error ?? 'Report export invocation failed.');
  }
  return data.data;
}

export const liveReportsService: ReportService = {
  async getAdminOverview(): Promise<AdminOverview> {
    return invoke<AdminOverview>({ action: 'getAdminOverview' });
  },

  async listReports(): Promise<ReportSummary[]> {
    const response = await invoke<{ reports: ReportSummary[] }>({ action: 'listReports' });
    return response.reports;
  },

  async exportReport(title: string, format: 'PDF' | 'CSV'): Promise<ExportedReport> {
    return invoke<ExportedReport>({ action: 'exportReport', title, format });
  },
};
