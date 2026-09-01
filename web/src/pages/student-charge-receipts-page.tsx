import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { PageEmpty, PageTips, SectionProgress } from '@/components/page-fill';
import { RejectionFeedback } from '@/components/rejection-feedback';
import { AppShell } from '@/components/shell';
import { api, getApiErrorMessage } from '@/lib/api';
import { openAuthenticatedFile } from '@/lib/open-authenticated-file';
import { prepareUploadFile } from '@/lib/prepare-upload-file';
import type { ChargeReceipt } from '@/types/auth';
import './dashboard.css';

export function StudentChargeReceiptsPage() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [openingKey, setOpeningKey] = useState<string | null>(null);

  const receiptsQuery = useQuery({
    queryKey: ['student-charge-receipts'],
    queryFn: async () => {
      const { data } = await api.get<{ data: ChargeReceipt[] }>('/student/charge-receipts');
      return data.data;
    },
  });

  const receipts = receiptsQuery.data ?? [];
  const feesProgress = useMemo(() => {
    const total = receipts.length;
    const action = receipts.filter(
      (r) => r.status === 'awaiting_student' || r.status === 'rejected',
    ).length;
    const review = receipts.filter((r) => r.status === 'awaiting_review').length;
    const approved = receipts.filter((r) => r.status === 'approved').length;

    if (total === 0) {
      return {
        percent: 0,
        title: 'Fees incomplete',
        description: 'No charge slips yet, Finance will send them here.',
      };
    }
    if (action > 0) {
      return {
        percent: Math.round((approved / total) * 100),
        title: 'Fees need your action',
        description: `${action} slip${action === 1 ? '' : 's'} waiting for payment upload.`,
      };
    }
    if (review > 0) {
      return {
        percent: Math.round(((approved + review * 0.5) / total) * 100),
        title: 'Fees in review',
        description: `${approved} approved, ${review} with Finance.`,
      };
    }
    return {
      percent: 100,
      title: 'Fees complete',
      description: `All ${approved} slip${approved === 1 ? '' : 's'} are approved.`,
    };
  }, [receipts]);

  const upload = useMutation({
    mutationFn: async ({ id, file }: { id: number; file: File }) => {
      const ready = await prepareUploadFile(file);
      const formData = new FormData();
      formData.append('file', ready, ready.name);
      await api.post(`/student/charge-receipts/${id}/upload`, formData);
    },
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ['student-charge-receipts'] });
    },
    onError: (err) => {
      if (err instanceof Error && !('response' in err)) {
        setError(err.message);
        return;
      }
      setError(getApiErrorMessage(err, 'Could not upload payment slip.'));
    },
  });

  async function viewSlip(path: string, title: string, key: string) {
    setOpeningKey(key);
    setError(null);
    try {
      await openAuthenticatedFile(path, title);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not open this slip.'));
    } finally {
      setOpeningKey(null);
    }
  }

  return (
    <AppShell
      badge="Student"
      title="Charge receipts">
      <div className="page-stack">
        <SectionProgress
          loading={receiptsQuery.isLoading}
          title={feesProgress.title}
          percent={feesProgress.percent}
        />

        {error ? <p className="form-error">{error}</p> : null}

        {!receiptsQuery.isLoading && receipts.length === 0 ? (
          <PageEmpty
            title="No charge slips yet"
          />
        ) : null}

        <div className="stack-list">
          {receiptsQuery.isLoading ? <p className="muted">Loading…</p> : null}
          {receipts.map((receipt) => {
            const consultantKey = `consultant-${receipt.id}`;
            const studentKey = `student-${receipt.id}`;
            return (
              <div key={receipt.id} className="panel">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <h2 style={{ margin: 0 }}>{receipt.title}</h2>
                  <span
                    className={`status-pill${
                      receipt.status === 'rejected'
                        ? ' danger'
                        : receipt.status === 'awaiting_student'
                          ? ' warn'
                          : ''
                    }`}>
                    {receipt.status_label}
                  </span>
                </div>
                <p style={{ marginTop: 10 }}>
                  {receipt.amount ? `${receipt.currency ?? ''} ${receipt.amount}` : 'Amount in slip notes'}
                </p>
                {receipt.notes ? <p>{receipt.notes}</p> : null}
                {receipt.status === 'rejected' && receipt.rejection_reason ? (
                  <RejectionFeedback reason={receipt.rejection_reason} />
                ) : null}

                <div className="org-actions" style={{ marginTop: 12, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="primary-btn doc-view-btn"
                    disabled={openingKey === consultantKey}
                    onClick={() =>
                      void viewSlip(
                        `/student/charge-receipts/${receipt.id}/consultant-file`,
                        receipt.consultant_file?.original_name ?? receipt.title,
                        consultantKey,
                      )
                    }>
                    {openingKey === consultantKey ? 'Opening…' : 'View finance slip'}
                  </button>
                  {receipt.student_file ? (
                    <button
                      type="button"
                      className="primary-btn doc-view-btn"
                      disabled={openingKey === studentKey}
                      onClick={() =>
                        void viewSlip(
                          `/student/charge-receipts/${receipt.id}/student-file`,
                          receipt.student_file!.original_name,
                          studentKey,
                        )
                      }>
                      {openingKey === studentKey ? 'Opening…' : 'View my payment'}
                    </button>
                  ) : null}
                </div>

                {receipt.status === 'awaiting_student' || receipt.status === 'rejected' ? (
                  <label className="field" style={{ marginTop: 12 }}>
                    <span>Upload paid slip / screenshot</span>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) upload.mutate({ id: receipt.id, file });
                      }}
                    />
                  </label>
                ) : null}
              </div>
            );
          })}
        </div>

        <PageTips
          title="Payment tips"
          items={[
            'Include the full receipt amount and reference in the screenshot.',
            'If rejected, read the reason and upload a clearer copy.',
            'Approved fees help unlock interview preparation.',
          ]}
        />
      </div>
    </AppShell>
  );
}
