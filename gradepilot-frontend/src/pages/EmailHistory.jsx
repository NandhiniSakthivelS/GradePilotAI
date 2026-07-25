import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API = 'http://localhost:8080/api';

const EmailHistory = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [resendingId, setResendingId] = useState(null);
  const [downloadingReportId, setDownloadingReportId] = useState(null);

  // Resend confirmation modal state
  const [resendModal, setResendModal] = useState({ open: false, record: null });

  useEffect(() => {
    if (!token) { navigate('/login'); return; }
    fetchHistory();
  }, [token]);

  const authHeaders = () => ({ Authorization: `Bearer ${token}` });

  const fetchHistory = async () => {
    setLoading(true);
    setMsg({ type: '', text: '' });
    try {
      const res = await axios.get(`${API}/email/history`, { headers: authHeaders() });
      setHistory(res.data);
    } catch {
      setMsg({ type: 'error', text: 'Failed to load email history.' });
    } finally {
      setLoading(false);
    }
  };

  const handleResendConfirm = (record) => {
    setResendModal({ open: true, record });
  };

  const handleResend = async () => {
    const record = resendModal.record;
    setResendModal({ open: false, record: null });
    setResendingId(record.id);
    try {
      await axios.post(`${API}/email/resend/${record.id}`, null, { headers: authHeaders() });
      setMsg({ type: 'success', text: `✅ Report resent successfully to ${record.parentEmail}` });
      fetchHistory(); // Refresh table to show new record
    } catch (err) {
      const errMsg = err.response?.data?.error || 'Failed to resend email. Check SMTP configuration.';
      setMsg({ type: 'error', text: `❌ ${errMsg}` });
    } finally {
      setResendingId(null);
    }
  };

  const handleViewReport = async (record) => {
    setDownloadingReportId(record.id);
    try {
      const res = await axios.get(`${API}/ai/analysis/${record.reportId}/report`, {
        headers: authHeaders(),
        responseType: 'blob',
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Academic_Report_${record.studentName.replace(/ /g, '_')}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setMsg({ type: 'error', text: 'Failed to download the report PDF.' });
    } finally {
      setDownloadingReportId(null);
    }
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
  };

  const StatusBadge = ({ status }) => {
    if (status === 'SUCCESS') {
      return (
        <span className="badge rounded-pill px-3 py-1" style={{ background: 'rgba(16,185,129,0.12)', color: '#059669', fontWeight: 600, fontSize: '0.78rem' }}>
          ✅ Delivered
        </span>
      );
    }
    return (
      <span className="badge rounded-pill px-3 py-1" style={{ background: 'rgba(239,68,68,0.12)', color: '#dc2626', fontWeight: 600, fontSize: '0.78rem' }}>
        ❌ Failed
      </span>
    );
  };

  return (
    <div className="fade-in-content">
      {/* Page Header */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
        <div>
          <h2 className="fw-bold text-dark mb-1">📧 Email History</h2>
          <p className="text-muted-dark mb-0">
            Track all parent communication logs and resend academic reports.
          </p>
        </div>
        <button
          className="btn btn-outline-primary btn-sm d-flex align-items-center gap-2"
          onClick={fetchHistory}
          disabled={loading}
          id="refresh-history-btn"
        >
          <i className={`bi bi-arrow-clockwise ${loading ? 'spin' : ''}`}></i>
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Status Message */}
      {msg.text && (
        <div className={`alert border-0 rounded-3 mb-4 ${
          msg.type === 'success' ? 'alert-success' : 'alert-danger'
        }`} role="alert">
          {msg.text}
          <button type="button" className="btn-close float-end" onClick={() => setMsg({ type: '', text: '' })} />
        </div>
      )}

      {/* Stats Summary */}
      {!loading && history.length > 0 && (
        <div className="row g-3 mb-4">
          <div className="col-md-4">
            <div className="gp-card p-3 d-flex align-items-center gap-3">
              <div className="rounded-3 p-2 d-flex align-items-center justify-content-center" style={{ background: 'rgba(59,130,246,0.1)', width: 44, height: 44 }}>
                <i className="bi bi-envelope-fill text-primary fs-5"></i>
              </div>
              <div>
                <p className="mb-0 text-muted-light small">Total Emails</p>
                <h5 className="mb-0 fw-bold text-dark">{history.length}</h5>
              </div>
            </div>
          </div>
          <div className="col-md-4">
            <div className="gp-card p-3 d-flex align-items-center gap-3">
              <div className="rounded-3 p-2 d-flex align-items-center justify-content-center" style={{ background: 'rgba(16,185,129,0.1)', width: 44, height: 44 }}>
                <i className="bi bi-check-circle-fill fs-5" style={{ color: '#10b981' }}></i>
              </div>
              <div>
                <p className="mb-0 text-muted-light small">Delivered</p>
                <h5 className="mb-0 fw-bold text-dark">{history.filter(h => h.deliveryStatus === 'SUCCESS').length}</h5>
              </div>
            </div>
          </div>
          <div className="col-md-4">
            <div className="gp-card p-3 d-flex align-items-center gap-3">
              <div className="rounded-3 p-2 d-flex align-items-center justify-content-center" style={{ background: 'rgba(239,68,68,0.1)', width: 44, height: 44 }}>
                <i className="bi bi-x-circle-fill fs-5" style={{ color: '#ef4444' }}></i>
              </div>
              <div>
                <p className="mb-0 text-muted-light small">Failed</p>
                <h5 className="mb-0 fw-bold text-dark">{history.filter(h => h.deliveryStatus === 'FAILURE').length}</h5>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="p-5 text-center text-muted-dark">
          <span className="spinner-border spinner-border-sm me-2" />
          Loading email history...
        </div>
      ) : history.length === 0 ? (
        <div className="gp-card p-5 text-center">
          <i className="bi bi-envelope-x fs-1 text-muted d-block mb-3"></i>
          <h5 className="fw-bold text-dark mb-1">No Email History Found</h5>
          <p className="text-muted-dark mb-0">
            No parent emails have been sent yet. Generate and approve a report, then use
            <strong> "Send Parent Email"</strong> from the AI Review page.
          </p>
        </div>
      ) : (
        <div className="gp-card p-0 overflow-hidden">
          <div className="table-responsive">
            <table className="table table-hover mb-0" style={{ fontSize: '0.875rem' }}>
              <thead style={{ background: 'rgba(59,130,246,0.06)', borderBottom: '2px solid rgba(59,130,246,0.15)' }}>
                <tr>
                  <th className="py-3 px-3 fw-semibold text-dark">#</th>
                  <th className="py-3 px-3 fw-semibold text-dark">Student</th>
                  <th className="py-3 px-3 fw-semibold text-dark">Parent Email</th>
                  <th className="py-3 px-3 fw-semibold text-dark">Exam</th>
                  <th className="py-3 px-3 fw-semibold text-dark">Report ID</th>
                  <th className="py-3 px-3 fw-semibold text-dark">Sent At</th>
                  <th className="py-3 px-3 fw-semibold text-dark">Status</th>
                  <th className="py-3 px-3 fw-semibold text-dark text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {history.map((record, idx) => (
                  <tr key={record.id} style={{ verticalAlign: 'middle' }}>
                    <td className="px-3 text-muted-light">{idx + 1}</td>
                    <td className="px-3">
                      <div className="d-flex align-items-center gap-2">
                        <div
                          className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold"
                          style={{ width: 34, height: 34, background: '#3b82f6', fontSize: '0.78rem', flexShrink: 0 }}
                        >
                          {record.studentName?.charAt(0)}
                        </div>
                        <div>
                          <div className="fw-semibold text-dark">{record.studentName}</div>
                          <div className="text-muted-light small font-monospace">{record.registerNo}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3">
                      <span className="text-dark" style={{ fontSize: '0.82rem' }}>{record.parentEmail}</span>
                    </td>
                    <td className="px-3">
                      <span className="badge bg-primary-subtle text-primary rounded-pill px-2 py-1" style={{ fontSize: '0.78rem' }}>
                        {record.examName}
                      </span>
                    </td>
                    <td className="px-3">
                      <span className="font-monospace text-muted-dark" style={{ fontSize: '0.8rem' }}>#{record.reportId}</span>
                    </td>
                    <td className="px-3">
                      <span className="text-muted-dark" style={{ fontSize: '0.82rem' }}>{formatDateTime(record.sentAt)}</span>
                    </td>
                    <td className="px-3">
                      <StatusBadge status={record.deliveryStatus} />
                      {record.deliveryStatus === 'FAILURE' && record.failureReason && (
                        <div className="text-danger small mt-1" title={record.failureReason} style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {record.failureReason}
                        </div>
                      )}
                    </td>
                    <td className="px-3 text-center">
                      <div className="d-flex gap-2 justify-content-center">
                        <button
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => handleViewReport(record)}
                          disabled={downloadingReportId === record.id}
                          title="Download PDF Report"
                          id={`view-report-btn-${record.id}`}
                        >
                          {downloadingReportId === record.id
                            ? <span className="spinner-border spinner-border-sm" />
                            : <><i className="bi bi-file-earmark-pdf-fill me-1"></i>Report</>
                          }
                        </button>
                        <button
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => handleResendConfirm(record)}
                          disabled={resendingId === record.id}
                          title="Resend Email to Parent"
                          id={`resend-btn-${record.id}`}
                        >
                          {resendingId === record.id
                            ? <span className="spinner-border spinner-border-sm" />
                            : <><i className="bi bi-send-fill me-1"></i>Resend</>
                          }
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Resend Confirmation Modal */}
      {resendModal.open && resendModal.record && (
        <div className="modal show d-block" style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg rounded-4">
              <div className="modal-header border-0 pb-0 px-4 pt-4">
                <div className="d-flex align-items-center gap-3">
                  <div className="rounded-3 p-2" style={{ background: 'rgba(59,130,246,0.1)' }}>
                    <i className="bi bi-send-fill text-primary fs-4"></i>
                  </div>
                  <div>
                    <h5 className="mb-0 fw-bold text-dark">Resend Academic Report</h5>
                    <p className="mb-0 text-muted-dark small">Re-send the same PDF report to parent</p>
                  </div>
                </div>
              </div>
              <div className="modal-body px-4 pt-3 pb-0">
                <div className="rounded-3 p-3 mb-2" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                  <div className="row g-2" style={{ fontSize: '0.875rem' }}>
                    <div className="col-5 text-muted-dark fw-semibold">Student</div>
                    <div className="col-7 text-dark fw-bold">{resendModal.record.studentName}</div>
                    <div className="col-5 text-muted-dark fw-semibold">Register No</div>
                    <div className="col-7 text-dark font-monospace">{resendModal.record.registerNo}</div>
                    <div className="col-5 text-muted-dark fw-semibold">Parent Email</div>
                    <div className="col-7 text-primary">{resendModal.record.parentEmail}</div>
                    <div className="col-5 text-muted-dark fw-semibold">Exam</div>
                    <div className="col-7 text-dark">{resendModal.record.examName}</div>
                    <div className="col-5 text-muted-dark fw-semibold">Report ID</div>
                    <div className="col-7 text-dark font-monospace">#{resendModal.record.reportId}</div>
                  </div>
                </div>
                <p className="text-muted-dark small mb-0">
                  <i className="bi bi-info-circle me-1"></i>
                  A new delivery record will be created for this resend attempt.
                </p>
              </div>
              <div className="modal-footer border-0 px-4 pb-4 pt-3 gap-2">
                <button
                  className="btn btn-outline-secondary"
                  onClick={() => setResendModal({ open: false, record: null })}
                  id="resend-cancel-btn"
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary d-flex align-items-center gap-2"
                  onClick={handleResend}
                  id="resend-confirm-btn"
                >
                  <i className="bi bi-send-fill"></i>
                  Resend Email
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmailHistory;
