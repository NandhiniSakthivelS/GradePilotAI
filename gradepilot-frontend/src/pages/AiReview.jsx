import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API = 'http://localhost:8080/api';

const performanceLevels = ['Excellent', 'Very Good', 'Good', 'Needs Improvement'];

const getPerformanceBadge = (level) => {
  if (!level) return 'badge bg-secondary';
  const l = level.toLowerCase();
  if (l.includes('excellent')) return 'badge bg-success';
  if (l.includes('very good')) return 'badge bg-info text-dark';
  if (l.includes('good')) return 'badge bg-primary';
  return 'badge bg-danger';
};

const AiReview = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  const [exams, setExams] = useState([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState(null);
  const [approvingId, setApprovingId] = useState(null);
  const [approvingAll, setApprovingAll] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [downloadingClass, setDownloadingClass] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [editMap, setEditMap] = useState({});
  const [expandedId, setExpandedId] = useState(null);

  // ── Bulk email state ──────────────────────────────────────────────────────
  const [bulkEmailModal, setBulkEmailModal] = useState(false);
  const [sendingBulk, setSendingBulk] = useState(false);
  const [bulkResult, setBulkResult] = useState(null); // BulkEmailResponseDto

  useEffect(() => {
    if (!token) { navigate('/login'); return; }
    fetchExams();
  }, [token]);

  const authHeaders = () => ({ Authorization: `Bearer ${token}` });

  const fetchExams = async () => {
    try {
      const res = await axios.get(`${API}/exams`, { headers: authHeaders() });
      setExams(res.data);
      if (res.data.length > 0) {
        setSelectedExamId(res.data[0].id);
        fetchAnalysis(res.data[0].id);
      }
    } catch {
      setMsg({ type: 'error', text: 'Failed to load exams.' });
    }
  };

  const fetchAnalysis = async (examId) => {
    if (!examId) return;
    setLoading(true);
    setMsg({ type: '', text: '' });
    setStudents([]);
    setEditMap({});
    setBulkResult(null);
    try {
      const res = await axios.get(`${API}/ai/exams/${examId}/analysis`, { headers: authHeaders() });
      const list = res.data.studentsAnalysis || [];
      setStudents(list);
      const seed = {};
      list.forEach(s => {
        seed[s.id] = {
          suggestions: s.editedSuggestions ?? s.suggestions ?? '',
          parentSummary: s.editedParentSummary ?? s.parentSummary ?? '',
          performanceLevel: s.editedPerformanceLevel ?? s.performanceLevel ?? '',
        };
      });
      setEditMap(seed);
    } catch {
      setMsg({ type: 'info', text: 'No AI Analysis found for this exam. Please run AI Analysis first.' });
    } finally {
      setLoading(false);
    }
  };

  const handleExamChange = (e) => {
    const id = e.target.value;
    setSelectedExamId(id);
    fetchAnalysis(id);
  };

  const handleEditChange = (analysisId, field, value) => {
    setEditMap(prev => ({
      ...prev,
      [analysisId]: { ...prev[analysisId], [field]: value },
    }));
  };

  const saveEdits = async (student) => {
    setSavingId(student.id);
    try {
      const edits = editMap[student.id] || {};
      const res = await axios.patch(
        `${API}/ai/analysis/${student.id}/review`,
        {
          analysisId: student.id,
          editedSuggestions: edits.suggestions,
          editedParentSummary: edits.parentSummary,
          editedPerformanceLevel: edits.performanceLevel,
        },
        { headers: authHeaders() }
      );
      updateStudentInList(res.data);
      setMsg({ type: 'success', text: `Edits saved for ${student.studentName}.` });
    } catch {
      setMsg({ type: 'error', text: 'Failed to save edits.' });
    } finally {
      setSavingId(null);
    }
  };

  const approveStudent = async (student) => {
    setApprovingId(student.id);
    try {
      const res = await axios.post(
        `${API}/ai/analysis/${student.id}/approve`,
        null,
        { headers: authHeaders() }
      );
      updateStudentInList(res.data);
      setMsg({ type: 'success', text: `✅ Report approved for ${student.studentName}.` });
    } catch {
      setMsg({ type: 'error', text: 'Failed to approve.' });
    } finally {
      setApprovingId(null);
    }
  };

  const approveAll = async () => {
    if (!selectedExamId) return;
    setApprovingAll(true);
    try {
      await axios.post(`${API}/ai/exams/${selectedExamId}/approve-all`, null, { headers: authHeaders() });
      await fetchAnalysis(selectedExamId);
      setMsg({ type: 'success', text: '✅ All students approved successfully!' });
    } catch {
      setMsg({ type: 'error', text: 'Failed to approve all.' });
    } finally {
      setApprovingAll(false);
    }
  };

  const downloadStudentPdf = async (student) => {
    setDownloadingId(student.id);
    try {
      const res = await axios.get(`${API}/ai/analysis/${student.id}/report`, {
        headers: authHeaders(),
        responseType: 'blob',
      });
      triggerDownload(res.data, `Report_${student.studentName}_${student.registerNo}.pdf`);
    } catch {
      setMsg({ type: 'error', text: 'Failed to generate PDF report.' });
    } finally {
      setDownloadingId(null);
    }
  };

  const downloadClassPdf = async () => {
    if (!selectedExamId) return;
    setDownloadingClass(true);
    try {
      const res = await axios.get(`${API}/ai/exams/${selectedExamId}/report`, {
        headers: authHeaders(),
        responseType: 'blob',
      });
      const examName = exams.find(e => String(e.id) === String(selectedExamId))?.examName || 'Class';
      triggerDownload(res.data, `Class_Report_${examName}.pdf`);
    } catch {
      setMsg({ type: 'error', text: 'Failed to generate class report PDF.' });
    } finally {
      setDownloadingClass(false);
    }
  };

  const triggerDownload = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const updateStudentInList = (updated) => {
    setStudents(prev => prev.map(s => (s.id === updated.id ? updated : s)));
    if (updated) {
      setEditMap(prev => ({
        ...prev,
        [updated.id]: {
          suggestions: updated.editedSuggestions ?? updated.suggestions ?? '',
          parentSummary: updated.editedParentSummary ?? updated.parentSummary ?? '',
          performanceLevel: updated.editedPerformanceLevel ?? updated.performanceLevel ?? '',
        },
      }));
    }
  };

  // ── Bulk Email Handlers ───────────────────────────────────────────────────

  const openBulkEmailModal = () => {
    setBulkResult(null);
    setBulkEmailModal(true);
  };

  const closeBulkEmailModal = () => {
    setBulkEmailModal(false);
    setBulkResult(null);
  };

  const sendBulkEmails = async () => {
    setBulkEmailModal(false);
    setSendingBulk(true);
    setBulkResult(null);
    try {
      const res = await axios.post(
        `${API}/email/send-bulk/${selectedExamId}`,
        null,
        { headers: authHeaders() }
      );
      setBulkResult({ success: true, data: res.data });
    } catch (err) {
      const errMsg = err.response?.data?.error || 'SMTP configuration error or network issue.';
      setBulkResult({ success: false, error: errMsg });
    } finally {
      setSendingBulk(false);
    }
  };

  // ── Computed values ───────────────────────────────────────────────────────
  const approvedCount = students.filter(s => s.isApproved).length;
  const totalCount = students.length;
  const allApproved = totalCount > 0 && approvedCount === totalCount;
  const pendingCount = totalCount - approvedCount;
  const selectedExamName = exams.find(e => String(e.id) === String(selectedExamId))?.examName || '';

  return (
    <div className="fade-in-content">
      {/* Page Header */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
        <div>
          <h2 className="fw-bold text-dark mb-1">📋 AI Review &amp; Approval</h2>
          <p className="text-muted-dark mb-0">
            Review, edit and approve AI-generated analysis before generating the academic report.
          </p>
        </div>
        <div className="d-flex align-items-center gap-2" style={{ minWidth: '280px' }}>
          <label className="text-muted-light small fw-semibold text-nowrap mb-0 me-2">Exam:</label>
          <select
            className="form-select"
            value={selectedExamId}
            onChange={handleExamChange}
            disabled={loading}
          >
            {exams.map(e => (
              <option key={e.id} value={e.id}>{e.examName}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Status Message */}
      {msg.text && (
        <div className={`alert border-0 rounded-3 mb-4 ${
          msg.type === 'success' ? 'alert-success' :
          msg.type === 'error' ? 'alert-danger' : 'alert-info'
        }`} role="alert">
          {msg.text}
          <button
            type="button"
            className="btn-close float-end"
            onClick={() => setMsg({ type: '', text: '' })}
          />
        </div>
      )}

      {/* Progress Bar + Bulk Actions */}
      {students.length > 0 && (
        <div className="gp-card p-3 mb-4">
          {/* Top row: progress text + action buttons */}
          <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
            <span className="small fw-semibold text-dark">
              Approval Progress: <span className="text-success">{approvedCount}</span> / {totalCount} students approved
            </span>
            <div className="d-flex gap-2 flex-wrap">
              {!allApproved && (
                <button
                  className="btn btn-success btn-sm"
                  onClick={approveAll}
                  disabled={approvingAll}
                  id="approve-all-btn"
                >
                  {approvingAll
                    ? <><span className="spinner-border spinner-border-sm me-1" />Approving...</>
                    : '✅ Approve All'}
                </button>
              )}
              <button
                className="btn btn-primary btn-sm"
                onClick={downloadClassPdf}
                disabled={downloadingClass}
                id="download-class-report-btn"
              >
                {downloadingClass
                  ? <><span className="spinner-border spinner-border-sm me-1" />Generating...</>
                  : '📥 Download Class Report'}
              </button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="progress mb-3" style={{ height: '8px' }}>
            <div
              className="progress-bar bg-success"
              style={{ width: `${totalCount ? (approvedCount / totalCount) * 100 : 0}%`, transition: 'width 0.4s ease' }}
            />
          </div>

          {/* Approval status banner + Send button */}
          <div
            className="d-flex align-items-center justify-content-between flex-wrap gap-3 rounded-3 px-3 py-2"
            style={{
              background: allApproved
                ? 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(5,150,105,0.05))'
                : 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(217,119,6,0.05))',
              border: allApproved ? '1px solid rgba(16,185,129,0.25)' : '1px solid rgba(245,158,11,0.25)',
            }}
          >
            {/* Status label */}
            <div className="d-flex align-items-center gap-2">
              {allApproved ? (
                <>
                  <span style={{ fontSize: '1.1rem' }}>✅</span>
                  <span className="fw-semibold small" style={{ color: '#059669' }}>
                    All student reports approved — ready to send parent emails.
                  </span>
                </>
              ) : (
                <>
                  <span style={{ fontSize: '1.1rem' }}>⚠️</span>
                  <span className="fw-semibold small" style={{ color: '#b45309' }}>
                    {pendingCount} student report{pendingCount !== 1 ? 's are' : ' is'} still pending approval.
                    Approve all before sending emails.
                  </span>
                </>
              )}
            </div>

            {/* Bulk Send button */}
            <button
              className="btn btn-sm d-flex align-items-center gap-2 px-3"
              style={{
                background: allApproved
                  ? 'linear-gradient(135deg,#3b82f6,#2563eb)'
                  : 'rgba(100,116,139,0.18)',
                color: allApproved ? '#fff' : '#64748b',
                fontWeight: 600,
                border: 'none',
                cursor: allApproved ? 'pointer' : 'not-allowed',
                opacity: allApproved ? 1 : 0.65,
                transition: 'all 0.2s',
              }}
              onClick={allApproved ? openBulkEmailModal : undefined}
              disabled={!allApproved || sendingBulk}
              id="bulk-send-email-btn"
              title={allApproved ? 'Send academic reports to all parents' : `Approve all ${pendingCount} pending report(s) first`}
            >
              📧 Send Parent Email
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="p-5 text-center text-muted-dark">
          <span className="spinner-border spinner-border-sm me-2" />
          Loading analysis data...
        </div>
      ) : students.length === 0 ? (
        <div className="text-center p-5 text-muted-dark bg-light rounded-4 border">
          <i className="bi bi-clipboard-check fs-1 text-muted mb-2 d-block"></i>
          No AI Analysis found. Run AI Analysis first from the AI Analysis page.
        </div>
      ) : (
        <div className="d-flex flex-column gap-3">
          {students.map(student => {
            const edits = editMap[student.id] || {};
            const isExpanded = expandedId === student.id;
            const isApproved = student.isApproved;
            const isSaving = savingId === student.id;
            const isApproving = approvingId === student.id;
            const isDownloading = downloadingId === student.id;

            return (
              <div
                key={student.id}
                className={`gp-card p-0 overflow-hidden ${isApproved ? 'border border-success border-opacity-50' : ''}`}
                style={{ transition: 'all 0.2s' }}
              >
                {/* Card Header / Summary Row */}
                <div
                  className="d-flex justify-content-between align-items-center p-3 cursor-pointer"
                  style={{ cursor: 'pointer', background: isApproved ? 'rgba(16,185,129,0.06)' : 'transparent' }}
                  onClick={() => setExpandedId(isExpanded ? null : student.id)}
                >
                  <div className="d-flex align-items-center gap-3">
                    <div
                      className={`rounded-circle d-flex align-items-center justify-content-center fw-bold text-white`}
                      style={{
                        width: 40, height: 40, flexShrink: 0,
                        background: isApproved ? '#10b981' : '#3b82f6',
                        fontSize: '0.85rem',
                      }}
                    >
                      {student.studentName?.charAt(0) || '?'}
                    </div>
                    <div>
                      <h6 className="fw-bold text-dark mb-0">{student.studentName}</h6>
                      <span className="text-muted-light small font-monospace">{student.registerNo}</span>
                    </div>
                  </div>

                  <div className="d-flex align-items-center gap-3 flex-wrap justify-content-end">
                    <span className="badge bg-primary-subtle text-primary rounded-pill fw-bold px-3 py-1">
                      {student.overallPercentage?.toFixed(2)}%
                    </span>
                    <span className={getPerformanceBadge(edits.performanceLevel || student.performanceLevel)}>
                      {edits.performanceLevel || student.performanceLevel || 'N/A'}
                    </span>
                    {isApproved && (
                      <span className="badge bg-success text-white rounded-pill px-3 py-1">
                        ✅ Approved
                      </span>
                    )}
                    <i className={`bi bi-chevron-${isExpanded ? 'up' : 'down'} text-muted`}></i>
                  </div>
                </div>

                {/* Expanded Editor */}
                {isExpanded && (
                  <div className="border-top p-3">
                    <div className="row g-3 mb-3">
                      {/* Strong / Weak (readonly) */}
                      <div className="col-md-6">
                        <label className="form-label small fw-semibold text-success mb-1">
                          ✨ Strong Subjects (AI)
                        </label>
                        <div className="form-control bg-light text-dark small" style={{ minHeight: 38 }}>
                          {student.strongSubjects || 'None'}
                        </div>
                      </div>
                      <div className="col-md-6">
                        <label className="form-label small fw-semibold text-danger mb-1">
                          ⚠ Weak Subjects (AI)
                        </label>
                        <div className="form-control bg-light text-dark small" style={{ minHeight: 38 }}>
                          {student.weakSubjects || 'None'}
                        </div>
                      </div>

                      {/* Performance Level (editable) */}
                      <div className="col-md-4">
                        <label className="form-label small fw-semibold text-dark mb-1">
                          🎯 Performance Level
                        </label>
                        <select
                          className="form-select form-select-sm"
                          value={edits.performanceLevel || ''}
                          onChange={e => handleEditChange(student.id, 'performanceLevel', e.target.value)}
                          disabled={isApproved}
                          id={`perf-${student.id}`}
                        >
                          {performanceLevels.map(l => (
                            <option key={l} value={l}>{l}</option>
                          ))}
                        </select>
                      </div>

                      {/* AI Suggestions (editable) */}
                      <div className="col-12">
                        <label className="form-label small fw-semibold text-dark mb-1">
                          🤖 AI Suggestions
                          {student.editedSuggestions && (
                            <span className="badge bg-warning text-dark ms-2 small">Edited</span>
                          )}
                        </label>
                        <textarea
                          className="form-control form-control-sm"
                          rows={3}
                          value={edits.suggestions || ''}
                          onChange={e => handleEditChange(student.id, 'suggestions', e.target.value)}
                          disabled={isApproved}
                          placeholder="Edit AI suggestions here..."
                          id={`suggestions-${student.id}`}
                        />
                        {student.suggestions && student.suggestions !== edits.suggestions && (
                          <div className="mt-1 small text-muted-light">
                            <strong>Original:</strong> {student.suggestions}
                          </div>
                        )}
                      </div>

                      {/* Parent Summary (editable) */}
                      <div className="col-12">
                        <label className="form-label small fw-semibold text-dark mb-1">
                          👨‍👩‍👧 Parent Communication Summary
                          {student.editedParentSummary && (
                            <span className="badge bg-warning text-dark ms-2 small">Edited</span>
                          )}
                        </label>
                        <textarea
                          className="form-control form-control-sm"
                          rows={3}
                          value={edits.parentSummary || ''}
                          onChange={e => handleEditChange(student.id, 'parentSummary', e.target.value)}
                          disabled={isApproved}
                          placeholder="Edit parent summary here..."
                          id={`parent-summary-${student.id}`}
                        />
                        {student.parentSummary && student.parentSummary !== edits.parentSummary && (
                          <div className="mt-1 small text-muted-light">
                            <strong>Original:</strong> {student.parentSummary}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Approval info */}
                    {isApproved && student.approvedBy && (
                      <div className="alert alert-success py-2 px-3 mb-3 small">
                        ✅ Approved by <strong>{student.approvedBy}</strong>
                        {student.approvedAt && (
                          <> on {new Date(student.approvedAt).toLocaleString()}</>
                        )}
                      </div>
                    )}

                    {/* Action Buttons — no per-student email button */}
                    <div className="d-flex gap-2 flex-wrap">
                      {!isApproved && (
                        <button
                          className="btn btn-outline-primary btn-sm"
                          onClick={() => saveEdits(student)}
                          disabled={isSaving}
                          id={`save-btn-${student.id}`}
                        >
                          {isSaving
                            ? <><span className="spinner-border spinner-border-sm me-1" />Saving...</>
                            : '💾 Save Edits'}
                        </button>
                      )}
                      {!isApproved && (
                        <button
                          className="btn btn-success btn-sm"
                          onClick={() => approveStudent(student)}
                          disabled={isApproving}
                          id={`approve-btn-${student.id}`}
                        >
                          {isApproving
                            ? <><span className="spinner-border spinner-border-sm me-1" />Approving...</>
                            : '✅ Approve Report'}
                        </button>
                      )}
                      <button
                        className="btn btn-dark btn-sm ms-auto"
                        onClick={() => downloadStudentPdf(student)}
                        disabled={isDownloading}
                        id={`download-btn-${student.id}`}
                      >
                        {isDownloading
                          ? <><span className="spinner-border spinner-border-sm me-1" />Generating...</>
                          : '📥 Download PDF Report'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Bulk Email Confirmation Modal ── */}
      {bulkEmailModal && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
          style={{ background: 'rgba(0,0,0,0.50)', backdropFilter: 'blur(4px)', zIndex: 9999 }}
        >
          <div className="border-0 shadow-lg rounded-4 bg-white" style={{ maxWidth: 480, width: '92%' }}>
            <div className="border-0 pb-0 px-4 pt-4">
              <div className="d-flex align-items-center gap-3">
                <div className="rounded-3 p-2" style={{ background: 'rgba(59,130,246,0.1)' }}>
                  <i className="bi bi-envelope-fill text-primary fs-4"></i>
                </div>
                <div>
                  <h5 className="mb-0 fw-bold text-dark">Send Parent Emails</h5>
                  <p className="mb-0 text-muted-dark small">Send academic reports to all parents at once</p>
                </div>
              </div>
            </div>
            <div className="px-4 pt-3 pb-0">
              <div className="rounded-3 p-3 mb-3" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <div className="row g-2" style={{ fontSize: '0.875rem' }}>
                  <div className="col-5 fw-semibold text-muted-dark">Exam</div>
                  <div className="col-7 fw-bold text-dark">{selectedExamName}</div>
                  <div className="col-5 fw-semibold text-muted-dark">Total Students</div>
                  <div className="col-7 fw-bold text-dark">{totalCount}</div>
                  <div className="col-5 fw-semibold text-muted-dark">Approved</div>
                  <div className="col-7">
                    <span className="badge bg-success rounded-pill px-2">{approvedCount} / {totalCount}</span>
                  </div>
                </div>
              </div>
              <div className="alert alert-info py-2 px-3 mb-3 small d-flex align-items-start gap-2">
                <i className="bi bi-info-circle-fill text-info mt-1 flex-shrink-0"></i>
                <span>
                  Academic reports for all <strong>{totalCount} approved students</strong> will be sent
                  to their respective parents. The already generated PDF will be attached — no regeneration or
                  AI call will occur.
                </span>
              </div>
              <p className="text-muted-dark small mb-0">
                <i className="bi bi-shield-check me-1 text-success"></i>
                Each email is tracked individually. You can review delivery status in Email History.
              </p>
            </div>
            <div className="d-flex justify-content-end px-4 pb-4 pt-3 gap-2">
              <button className="btn btn-outline-secondary" onClick={closeBulkEmailModal} id="bulk-email-cancel-btn">
                Cancel
              </button>
              <button
                className="btn btn-primary d-flex align-items-center gap-2"
                onClick={sendBulkEmails}
                id="bulk-email-confirm-btn"
              >
                <i className="bi bi-send-fill"></i>
                Confirm &amp; Send {totalCount} Email{totalCount !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk Sending Overlay ── */}
      {sendingBulk && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)', zIndex: 9999 }}
        >
          <div className="text-center text-white">
            <div className="mb-4">
              <div
                className="rounded-circle d-inline-flex align-items-center justify-content-center mb-3"
                style={{ width: 80, height: 80, background: 'rgba(255,255,255,0.15)', border: '2px solid rgba(255,255,255,0.3)' }}
              >
                <i className="bi bi-envelope-fill fs-1"></i>
              </div>
            </div>
            <h4 className="fw-bold mb-2">📧 Sending Academic Reports...</h4>
            <p className="text-white-50 mb-4">
              Delivering reports to all {totalCount} parents. Please wait.
            </p>
            <div className="spinner-border text-white" style={{ width: '3rem', height: '3rem' }} role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk Result Summary ── */}
      {bulkResult && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)', zIndex: 9999 }}
        >
          <div
            className="rounded-4 shadow-lg p-4"
            style={{ background: '#fff', maxWidth: 520, width: '92%', maxHeight: '85vh', overflowY: 'auto' }}
          >
            {bulkResult.success ? (
              <>
                {/* Success / Partial header */}
                <div className="text-center mb-3">
                  {bulkResult.data.failureCount === 0 ? (
                    <>
                      <div
                        className="rounded-circle d-inline-flex align-items-center justify-content-center mb-3"
                        style={{ width: 72, height: 72, background: 'rgba(16,185,129,0.12)' }}
                      >
                        <i className="bi bi-check-circle-fill fs-1" style={{ color: '#10b981' }}></i>
                      </div>
                      <h4 className="fw-bold text-dark mb-1">✅ All Emails Sent!</h4>
                      <p className="text-muted-dark small mb-0">Every parent report was delivered successfully.</p>
                    </>
                  ) : (
                    <>
                      <div
                        className="rounded-circle d-inline-flex align-items-center justify-content-center mb-3"
                        style={{ width: 72, height: 72, background: 'rgba(245,158,11,0.12)' }}
                      >
                        <i className="bi bi-exclamation-triangle-fill fs-1" style={{ color: '#f59e0b' }}></i>
                      </div>
                      <h4 className="fw-bold text-dark mb-1">⚠️ Partially Sent</h4>
                      <p className="text-muted-dark small mb-0">Some emails could not be delivered.</p>
                    </>
                  )}
                </div>

                {/* Summary counts */}
                <div className="row g-2 mb-3">
                  <div className="col-4">
                    <div className="rounded-3 p-2 text-center" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                      <div className="fw-bold fs-5 text-dark">{bulkResult.data.totalStudents}</div>
                      <div className="small text-muted-dark">Total</div>
                    </div>
                  </div>
                  <div className="col-4">
                    <div className="rounded-3 p-2 text-center" style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)' }}>
                      <div className="fw-bold fs-5" style={{ color: '#059669' }}>{bulkResult.data.successCount}</div>
                      <div className="small" style={{ color: '#059669' }}>Sent ✓</div>
                    </div>
                  </div>
                  <div className="col-4">
                    <div className="rounded-3 p-2 text-center" style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)' }}>
                      <div className="fw-bold fs-5" style={{ color: '#ef4444' }}>{bulkResult.data.failureCount}</div>
                      <div className="small" style={{ color: '#ef4444' }}>Failed ✗</div>
                    </div>
                  </div>
                </div>

                {/* Failed recipients list */}
                {bulkResult.data.failureCount > 0 && (
                  <div className="mb-3">
                    <p className="small fw-semibold text-danger mb-2">❌ Failed Recipients:</p>
                    <div style={{ maxHeight: 180, overflowY: 'auto' }}>
                      {bulkResult.data.results
                        .filter(r => r.status === 'FAILURE')
                        .map((r, idx) => (
                          <div
                            key={idx}
                            className="rounded-3 px-3 py-2 mb-1"
                            style={{ background: '#fff5f5', border: '1px solid #fecaca', fontSize: '0.82rem' }}
                          >
                            <div className="fw-semibold text-dark">{r.studentName} ({r.registerNo})</div>
                            <div className="text-primary">{r.parentEmail}</div>
                            <div className="text-danger mt-1">{r.failureReason || 'Unknown error'}</div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Success recipients — compact list */}
                {bulkResult.data.successCount > 0 && (
                  <div className="mb-3">
                    <p className="small fw-semibold text-success mb-2">✅ Successfully Sent To:</p>
                    <div style={{ maxHeight: 160, overflowY: 'auto' }}>
                      {bulkResult.data.results
                        .filter(r => r.status === 'SUCCESS')
                        .map((r, idx) => (
                          <div
                            key={idx}
                            className="d-flex justify-content-between align-items-center rounded-3 px-3 py-2 mb-1"
                            style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', fontSize: '0.82rem' }}
                          >
                            <div>
                              <span className="fw-semibold text-dark">{r.studentName}</span>
                              <span className="text-muted-dark ms-2">({r.registerNo})</span>
                            </div>
                            <span style={{ color: '#059669' }}>{r.parentEmail}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                <button
                  className="btn btn-success w-100"
                  onClick={closeBulkEmailModal}
                  id="bulk-result-close-btn"
                >
                  Done
                </button>
              </>
            ) : (
              <>
                {/* Total failure */}
                <div className="text-center mb-3">
                  <div
                    className="rounded-circle d-inline-flex align-items-center justify-content-center mb-3"
                    style={{ width: 72, height: 72, background: 'rgba(239,68,68,0.1)' }}
                  >
                    <i className="bi bi-x-circle-fill fs-1" style={{ color: '#ef4444' }}></i>
                  </div>
                  <h4 className="fw-bold text-dark mb-2">❌ Failed to Send Emails</h4>
                  <div className="rounded-3 p-3 mb-4" style={{ background: '#fff5f5', border: '1px solid #fecaca' }}>
                    <p className="mb-0 text-danger small">{bulkResult.error}</p>
                  </div>
                </div>
                <div className="d-flex gap-2">
                  <button
                    className="btn btn-outline-secondary flex-fill"
                    onClick={closeBulkEmailModal}
                    id="bulk-fail-close-btn"
                  >
                    Close
                  </button>
                  <button
                    className="btn btn-danger flex-fill d-flex align-items-center justify-content-center gap-2"
                    onClick={() => { setBulkResult(null); setBulkEmailModal(true); }}
                    id="bulk-fail-retry-btn"
                  >
                    <i className="bi bi-arrow-clockwise"></i> Try Again
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AiReview;
