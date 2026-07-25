import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const History = () => {
  const navigate = useNavigate();
  const [exams, setExams] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [toast, setToast] = useState(null); // { type: 'success'|'error', msg: '' }
  const [marksSaved, setMarksSaved] = useState(false); // shows GradePilot AI button after first save

  // 'view' mode = read-only, 'edit' mode = editable
  const [selectedExam, setSelectedExam] = useState(null);
  const [viewMode, setViewMode] = useState('edit'); // 'edit' | 'view'

  const token = localStorage.getItem('token');

  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchExamsAndStudents = async () => {
    setLoading(true);
    try {
      const examsRes = await axios.get('http://localhost:8080/api/exams', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setExams(examsRes.data);

      const studentsRes = await axios.get('http://localhost:8080/api/students', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setStudents(studentsRes.data);
    } catch (err) {
      console.error('Failed to load history data', err);
      if (err.response && err.response.status === 403) {
        localStorage.removeItem('token');
        navigate('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) { navigate('/login'); return; }
    fetchExamsAndStudents();
  }, [token, navigate]);

  // Opens spreadsheet inline in VIEW or EDIT mode
  const loadExamPreview = async (exam, mode) => {
    setMarksSaved(false); // Hide the Call GradePilot AI button initially
    setLoading(true);
    try {
      const marksRes = await axios.get(`http://localhost:8080/api/exams/${exam.id}/marks`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const savedMarks = marksRes.data;
      setViewMode(mode);
      if (savedMarks && savedMarks.length > 0) {
        setMarksSaved(true);
      }
      setSelectedExam({
        id: exam.id,
        examName: exam.examName,
        subjectNames: exam.subjectNames,
        rows: students.map((s) => {
          const studentMarks = exam.subjectNames.map((subject) => {
            const match = savedMarks.find(
              (sm) =>
                sm.registerNo.toLowerCase() === s.registerNo.toLowerCase() &&
                sm.subjectName.toLowerCase() === subject.toLowerCase()
            );
            return match && match.marks !== null && match.marks !== undefined ? match.marks : '';
          });
          return { registerNo: s.registerNo, studentName: s.studentName, marks: studentMarks };
        }),
      });
    } catch (err) {
      console.error('Failed to fetch saved marks', err);
      alert('Failed to load marks for this exam.');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkChange = (rowIndex, subjectIndex, val) => {
    if (viewMode === 'view') return;
    setMarksSaved(false); // Hide AI analysis button until marks are saved
    setSelectedExam((prev) => {
      const copy = { ...prev };
      const updatedRows = [...copy.rows];
      const updatedMarks = [...updatedRows[rowIndex].marks];
      updatedMarks[subjectIndex] = val;
      updatedRows[rowIndex] = { ...updatedRows[rowIndex], marks: updatedMarks };
      copy.rows = updatedRows;
      return copy;
    });
  };

  const handleSaveMarks = async () => {
    if (!selectedExam) return;
    setSaveLoading(true);
    try {
      const markDtos = [];
      selectedExam.rows.forEach((row) => {
        selectedExam.subjectNames.forEach((subject, sIdx) => {
          const markVal = row.marks[sIdx];
          markDtos.push({
            registerNo: row.registerNo,
            subjectName: subject,
            marks: markVal !== '' && markVal !== null && markVal !== undefined ? parseFloat(markVal) : null,
          });
        });
      });
      await axios.post(`http://localhost:8080/api/exams/${selectedExam.id}/marks`, markDtos, {
        headers: { Authorization: `Bearer ${token}` },
      });
      showToast('success', '✅ Marks saved successfully to the database!');
      setMarksSaved(true);
    } catch (err) {
      showToast('error', '❌ Failed to save marks. Please check inputs and try again.');
    } finally {
      setSaveLoading(false);
    }
  };

  const handleCallAi = async () => {
    if (!selectedExam) return;
    setAiLoading(true);
    try {
      await axios.post(`http://localhost:8080/api/ai/analyze?examId=${selectedExam.id}`, null, {
        headers: { Authorization: `Bearer ${token}` },
      });
      navigate('/ai-analysis', { state: { examId: selectedExam.id } });
    } catch (err) {
      console.error("AI Analysis failed", err);
      showToast('error', '❌ AI Analysis failed. Please verify API key and student marks.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleDownloadExcel = async (examId, examName) => {
    try {
      const response = await axios.get(`http://localhost:8080/api/exams/${examId}/excel`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob',
      });
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${examName.replace(/\s+/g, '_')}_marks.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      alert('Failed to download Excel file.');
    }
  };

  const handleDeleteExam = async (examId) => {
    try {
      await axios.delete(`http://localhost:8080/api/exams/${examId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setDeleteConfirmId(null);
      setExams((prev) => prev.filter((e) => e.id !== examId));
    } catch (err) {
      alert('Failed to delete exam. Please try again.');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  /* ─────────────────────────────────────────────
     SPREADSHEET VIEWER (View / Edit Mode)
  ───────────────────────────────────────────── */
  if (aiLoading) {
    return (
      <div className="d-flex flex-column align-items-center justify-content-center" style={{ minHeight: '80vh', width: '100%' }}>
        <div className="text-center">
          <div className="spinner-border text-primary mb-4" role="status" style={{ width: '3.5rem', height: '3.5rem' }}>
            <span className="visually-hidden">Loading...</span>
          </div>
          <h4 className="fw-bold mb-2">🤖 GradePilot AI is analyzing student performance...</h4>
          <p className="text-muted-light">Please wait. Parsing marks qualitatively through Gemini...</p>
        </div>
      </div>
    );
  }

  if (selectedExam) {
    const isEdit = viewMode === 'edit';

    return (
      <>
        {/* Toast notification */}
        {toast && (
          <div
            style={{
              position: 'fixed', bottom: '24px', left: '24px',
              zIndex: 99999, minWidth: '320px', maxWidth: '480px',
              animation: 'fadeIn 0.3s ease-out',
            }}
            className={`alert ${toast.type === 'success' ? 'alert-success' : 'alert-danger'} d-flex align-items-center gap-2 shadow-lg border-0 rounded-3 px-4 py-3`}
            role="alert"
          >
            <i className={`bi ${toast.type === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill'} fs-5`}></i>
            <span className="fw-semibold">{toast.msg}</span>
          </div>
        )}

        <div className="fade-in-content">

        {/* Top toolbar */}
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-start gap-3 mb-3">
          <div>
            {/* Mode badge */}
            {isEdit ? (
              <span
                className="badge d-inline-flex align-items-center gap-1 px-3 py-2 rounded-pill fw-semibold mb-2"
                style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', fontSize: '0.78rem' }}
              >
                <i className="bi bi-pencil-square"></i>
                Editing Mode — History Record
              </span>
            ) : (
              <span
                className="badge d-inline-flex align-items-center gap-1 px-3 py-2 rounded-pill fw-semibold mb-2"
                style={{ background: 'linear-gradient(135deg,#0ea5e9,#06b6d4)', color: '#fff', fontSize: '0.78rem' }}
              >
                <i className="bi bi-eye-fill"></i>
                View Mode — Read Only
              </span>
            )}
            <h2 className="fw-bold text-dark mb-1">
              {isEdit ? 'Edit Spreadsheet' : 'View Spreadsheet'} — {selectedExam.examName}
            </h2>
            <p className="text-muted-dark mb-0">
              {isEdit
                ? 'Marks are pre-filled from last save. Edit and hit Save Marks below.'
                : 'Viewing saved marks in read-only mode. Switch to Edit to make changes.'}
            </p>
          </div>

          <div className="d-flex gap-2 flex-wrap justify-content-md-end align-items-center">
            {/* Toggle mode button */}
            <button
              onClick={() => setViewMode(isEdit ? 'view' : 'edit')}
              className={`btn btn-sm ${isEdit ? 'btn-outline-secondary' : 'btn-outline-primary'} d-flex align-items-center gap-1`}
            >
              <i className={`bi ${isEdit ? 'bi-eye' : 'bi-pencil-square'}`}></i>
              <span>{isEdit ? 'Switch to View' : 'Switch to Edit'}</span>
            </button>
            <button
              onClick={() => handleDownloadExcel(selectedExam.id, selectedExam.examName)}
              className="btn btn-primary btn-sm d-flex align-items-center gap-2"
            >
              <i className="bi bi-file-earmark-arrow-down-fill"></i>
              <span>Download Excel</span>
            </button>
            <button
              onClick={() => setSelectedExam(null)}
              className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-2"
            >
              <i className="bi bi-arrow-left"></i>
              <span>Back to History</span>
            </button>
          </div>
        </div>

        {/* Spreadsheet table */}
        <div className="gp-table-container shadow-sm overflow-hidden">
          <div className="table-responsive" style={{ maxHeight: '60vh' }}>
            <table className="table gp-table align-middle text-center mb-0">
              <thead>
                <tr>
                  <th className="text-start">Register Number</th>
                  <th className="text-start">Student Name</th>
                  {selectedExam.subjectNames.map((subject, idx) => (
                    <th key={idx}>{subject}</th>
                  ))}
                  <th>Total Marks</th>
                </tr>
              </thead>
              <tbody>
                {selectedExam.rows.map((row, rIdx) => {
                  const total = row.marks.reduce((sum, m) => sum + (parseFloat(m) || 0), 0);
                  return (
                    <tr key={rIdx}>
                      <td className="text-start font-monospace fw-semibold text-primary">{row.registerNo}</td>
                      <td className="text-start fw-semibold text-dark">{row.studentName}</td>
                      {row.marks.map((mark, mIdx) => (
                        <td key={mIdx}>
                          {isEdit ? (
                            <input
                              type="number"
                              min="0"
                              max="100"
                              className="form-control text-center mx-auto"
                              style={{ width: '85px', padding: '0.4rem' }}
                              placeholder="-"
                              value={mark}
                              onChange={(e) => handleMarkChange(rIdx, mIdx, e.target.value)}
                            />
                          ) : (
                            <span
                              className={`fw-semibold ${mark !== '' && mark !== null ? 'text-dark' : 'text-muted'}`}
                            >
                              {mark !== '' && mark !== null ? mark : '—'}
                            </span>
                          )}
                        </td>
                      ))}
                      <td className="fw-bold text-success bg-success-subtle" style={{ fontSize: '1.05rem', width: '120px' }}>
                        {total}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bottom footer — Save Marks (edit only) + GradePilot AI (after save, both modes) */}
        <div className="d-flex align-items-center justify-content-between mt-3 px-1">
          <p className="text-muted small mb-0">
            <i className="bi bi-info-circle me-1"></i>
            {isEdit
              ? 'Saving overwrites the previous marks for this exam in the database.'
              : 'Viewing saved marks in read-only mode.'}
          </p>
          <div className="d-flex align-items-center gap-3">
            {/* GradePilot AI — visible after first Save Marks */}
            {marksSaved && (
              <button
                className="btn d-flex align-items-center gap-2 fw-semibold px-4"
                style={{
                  background: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
                  color: '#fff',
                  border: 'none',
                  boxShadow: '0 4px 14px rgba(14,165,233,0.3)',
                  borderRadius: '0.6rem',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.boxShadow='0 6px 20px rgba(14,165,233,0.4)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='0 4px 14px rgba(14,165,233,0.3)'; }}
                onClick={handleCallAi}
              >
                <span>🤖 Analyze with GradePilot AI</span>
              </button>
            )}
            {/* Save Marks — edit mode only */}
            {isEdit && (
              <button
                onClick={handleSaveMarks}
                className="btn btn-success px-4 d-flex align-items-center gap-2"
                disabled={saveLoading}
              >
                {saveLoading ? (
                  <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                ) : (
                  <i className="bi bi-cloud-arrow-up-fill"></i>
                )}
                <span>Save Marks</span>
              </button>
            )}
          </div>
        </div>
      </div>
      </>
    );
  }

  /* ─────────────────────────────────────────────
     HISTORY LIST
  ───────────────────────────────────────────── */
  return (
    <>
      {/* Toast notification */}
      {toast && (
        <div
          style={{
            position: 'fixed', bottom: '24px', left: '24px',
            zIndex: 99999, minWidth: '320px', maxWidth: '480px',
            animation: 'fadeIn 0.3s ease-out',
          }}
          className={`alert ${toast.type === 'success' ? 'alert-success' : 'alert-danger'} d-flex align-items-center gap-2 shadow-lg border-0 rounded-3 px-4 py-3`}
          role="alert"
        >
          <i className={`bi ${toast.type === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill'} fs-5`}></i>
          <span className="fw-semibold">{toast.msg}</span>
        </div>
      )}

      <div className="fade-in-content">
      <div className="mb-4">
        <h2 className="fw-bold text-dark mb-1">Exam Documentation History</h2>
        <p className="text-muted-dark mb-0">
          View, edit, download, and manage generated exam rosters.
        </p>
      </div>

      <div className="gp-table-container">
        {loading ? (
          <div className="p-5 text-center text-muted-dark">
            <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
            Loading history log...
          </div>
        ) : exams.length === 0 ? (
          <div className="p-5 text-center text-muted-dark">
            <i className="bi bi-clock-history text-muted fs-1 mb-2 d-block"></i>
            No exams have been generated yet. Go to Generate Test Result to create one.
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table gp-table align-middle">
              <thead>
                <tr>
                  <th>Exam Name</th>
                  <th>Subjects</th>
                  <th>Subjects List</th>
                  <th>Generated Date</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {exams.map((exam) => (
                  <React.Fragment key={exam.id}>
                    <tr>
                      <td><div className="fw-bold text-dark">{exam.examName}</div></td>
                      <td>
                        <span className="badge bg-primary-subtle text-primary px-2 py-1 rounded-pill fw-semibold">
                          {exam.subjectNames.length} {exam.subjectNames.length === 1 ? 'Subject' : 'Subjects'}
                        </span>
                      </td>
                      <td>
                        <div
                          className="text-muted-dark text-truncate"
                          style={{ maxWidth: '220px' }}
                          title={exam.subjectNames.join(', ')}
                        >
                          {exam.subjectNames.join(', ')}
                        </div>
                      </td>
                      <td className="small text-muted-dark">{formatDate(exam.createdAt)}</td>
                      <td className="text-end">
                        <div className="d-flex justify-content-end gap-2 flex-wrap">

                          {/* View — read-only */}
                          <button
                            onClick={() => loadExamPreview(exam, 'view')}
                            className="btn btn-outline-info btn-sm d-flex align-items-center gap-1"
                            title="View (Read-Only)"
                          >
                            <i className="bi bi-eye"></i>
                            <span>View</span>
                          </button>

                          {/* Edit */}
                          <button
                            onClick={() => loadExamPreview(exam, 'edit')}
                            className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1"
                            title="Edit Marks"
                          >
                            <i className="bi bi-pencil-square"></i>
                            <span>Edit</span>
                          </button>

                          {/* Download Excel */}
                          <button
                            onClick={() => handleDownloadExcel(exam.id, exam.examName)}
                            className="btn btn-outline-primary btn-sm d-flex align-items-center gap-1"
                            title="Download Excel"
                          >
                            <i className="bi bi-file-earmark-arrow-down"></i>
                            <span>Excel</span>
                          </button>

                          {/* Delete with inline confirm */}
                          {deleteConfirmId === exam.id ? (
                            <>
                              <span className="small text-danger align-self-center fw-semibold">Confirm?</span>
                              <button
                                onClick={() => handleDeleteExam(exam.id)}
                                className="btn btn-danger btn-sm d-flex align-items-center gap-1"
                              >
                                <i className="bi bi-check-lg"></i>
                                <span>Yes</span>
                              </button>
                              <button
                                onClick={() => setDeleteConfirmId(null)}
                                className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1"
                              >
                                <i className="bi bi-x-lg"></i>
                                <span>No</span>
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirmId(exam.id)}
                              className="btn btn-outline-danger btn-sm d-flex align-items-center gap-1"
                              title="Delete Exam"
                            >
                              <i className="bi bi-trash3"></i>
                              <span>Delete</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
    </>
  );
};

export default History;
