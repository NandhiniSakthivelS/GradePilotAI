import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';

const GenerateTestResult = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [examName, setExamName] = useState('');
  const [numSubjects, setNumSubjects] = useState(1);
  const [subjectNames, setSubjectNames] = useState(['']);
  const [loading, setLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [toast, setToast] = useState(null);
  const [marksSaved, setMarksSaved] = useState(false);
  const [fromHistory, setFromHistory] = useState(false); // true when navigated from History
  const [aiLoading, setAiLoading] = useState(false); // AI analysis loader state

  // Student roster state
  const [students, setStudents] = useState([]);

  // Interactive spreadsheet preview data state
  const [previewData, setPreviewData] = useState(null);

  const token = localStorage.getItem('token');

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }

    // Load active students list
    axios
      .get('http://localhost:8080/api/students', {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        setStudents(res.data);

        // If navigated from History with an exam to edit, auto-open the spreadsheet
        if (location.state && location.state.editExam) {
          const { editExam } = location.state;
          setPreviewData(editExam);
          setFromHistory(true);
          setMarksSaved(true); // marks already exist in DB — show GradePilot AI immediately
          // Clear router state so refreshing doesn't re-open it
          window.history.replaceState({}, '');
        }
      })
      .catch((err) => {
        console.error('Error fetching students roster', err);
      });
  }, [token, navigate, location.state]);

  const handleNumSubjectsChange = (e) => {
    const val = parseInt(e.target.value, 10);
    if (isNaN(val) || val < 1) {
      setNumSubjects(1);
      setSubjectNames(['']);
      return;
    }

    // Cap subjects at 15 for reasonable layout sizes
    const count = Math.min(val, 15);
    setNumSubjects(count);

    // Adjust subject names array size
    setSubjectNames((prev) => {
      const copy = [...prev];
      if (copy.length < count) {
        // Add empty fields
        while (copy.length < count) {
          copy.push('');
        }
      } else if (copy.length > count) {
        // Trim fields
        copy.splice(count);
      }
      return copy;
    });
  };

  const handleSubjectNameChange = (index, value) => {
    const copy = [...subjectNames];
    copy[index] = value;
    setSubjectNames(copy);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (students.length === 0) {
      setError('Cannot generate a result sheet. Please add students first in the Student Management module.');
      return;
    }

    if (!examName.trim()) {
      setError('Exam name is required.');
      return;
    }

    // Validate that all subject names are filled
    const emptySubject = subjectNames.some((name) => !name.trim());
    if (emptySubject) {
      setError('All subject names must be filled out.');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(
        'http://localhost:8080/api/exams',
        {
          examName: examName.trim(),
          subjectNames: subjectNames.map((name) => name.trim()),
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      const createdExam = response.data;

      setSuccess('Exam result report generated and stored in history!');
      
      // Open the interactive preview inside the portal
      setPreviewData({
        id: createdExam.id,
        examName: createdExam.examName,
        subjectNames: createdExam.subjectNames,
        rows: students.map((s) => ({
          registerNo: s.registerNo,
          studentName: s.studentName,
          marks: createdExam.subjectNames.map(() => ''),
        })),
      });

      // Clear layout config fields
      setExamName('');
      setNumSubjects(1);
      setSubjectNames(['']);
    } catch (err) {
      console.error('Failed to generate Excel sheet', err);
      setError(
        err.response && err.response.data && err.response.data.message
          ? err.response.data.message
          : 'Connection failed. Make sure the server is online.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleMarkChange = (rowIndex, subjectIndex, val) => {
    setMarksSaved(false); // Hide AI analysis button until marks are saved
    setPreviewData((prev) => {
      const copy = { ...prev };
      const updatedRows = [...copy.rows];
      const updatedMarks = [...updatedRows[rowIndex].marks];
      updatedMarks[subjectIndex] = val;
      updatedRows[rowIndex] = {
        ...updatedRows[rowIndex],
        marks: updatedMarks,
      };
      copy.rows = updatedRows;
      return copy;
    });
  };

  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  const handleSaveMarks = async () => {
    if (!previewData) return;
    setSaveLoading(true);
    setError('');
    setSuccess('');
    try {
      const markDtos = [];
      previewData.rows.forEach((row) => {
        previewData.subjectNames.forEach((subject, sIdx) => {
          const markVal = row.marks[sIdx];
          markDtos.push({
            registerNo: row.registerNo,
            subjectName: subject,
            marks: markVal !== '' && markVal !== null && markVal !== undefined ? parseFloat(markVal) : null,
          });
        });
      });

      await axios.post(`http://localhost:8080/api/exams/${previewData.id}/marks`, markDtos, {
        headers: { Authorization: `Bearer ${token}` },
      });

      showToast('success', '✅ Marks saved successfully to the database!');
      setMarksSaved(true);
    } catch (err) {
      console.error('Failed to save marks', err);
      showToast('error', '❌ Failed to save marks. Please check inputs.');
    } finally {
      setSaveLoading(false);
    }
  };

  const handleCallAi = async () => {
    if (!previewData) return;
    setAiLoading(true);
    try {
      await axios.post(`http://localhost:8080/api/ai/analyze?examId=${previewData.id}`, null, {
        headers: { Authorization: `Bearer ${token}` },
      });
      navigate('/ai-analysis', { state: { examId: previewData.id } });
    } catch (err) {
      console.error("AI Analysis failed", err);
      showToast('error', '❌ AI Analysis failed. Please verify API key and student marks.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleDownloadPreviewExcel = async () => {
    if (!previewData) return;
    try {
      setLoading(true);
      const response = await axios.get(
        `http://localhost:8080/api/exams/${previewData.id}/excel`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob',
        }
      );

      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      const safeName = `${previewData.examName.replace(/\s+/g, '_')}_marks.xlsx`;
      link.download = safeName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      alert('Failed to download Excel file. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Render loading screen if GradePilot AI analysis is processing
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

  // Render Live Spreadsheet Viewer inside Portal if previewData is active
  if (previewData) {
    return (
      <div className="fade-in-content">
        {/* Floating Toast */}
        {toast && (
          <div
            style={{
              position: 'fixed', bottom: '24px', left: '24px',
              zIndex: 99999, minWidth: '320px', maxWidth: '500px',
              animation: 'fadeIn 0.3s ease-out',
            }}
            className={`alert ${toast.type === 'success' ? 'alert-success' : 'alert-danger'} d-flex align-items-center gap-2 shadow-lg border-0 rounded-3 px-4 py-3`}
            role="alert"
          >
            <i className={`bi ${toast.type === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill'} fs-5`}></i>
            <span className="fw-semibold">{toast.msg}</span>
          </div>
        )}

        <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
          <div>
            {fromHistory ? (
              <span
                className="badge d-inline-flex align-items-center gap-1 px-3 py-2 rounded-pill fw-semibold mb-2"
                style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', fontSize: '0.78rem' }}
              >
                <i className="bi bi-pencil-square"></i>
                Editing from History — {previewData.examName}
              </span>
            ) : (
              <span className="badge bg-success-subtle text-success px-3 py-2 rounded-pill fw-semibold mb-2">
                Portal Interactive Excel View
              </span>
            )}
            <h2 className="fw-bold text-dark mb-1">Spreadsheet: {previewData.examName}</h2>
            <p className="text-muted-dark mb-0">
              {fromHistory
                ? 'Editing this report from your History. Save Marks to update the database.'
                : 'Fill marks directly below. The Total column dynamically updates calculations.'}
            </p>
          </div>
          <div className="d-flex gap-2">
            <button onClick={handleDownloadPreviewExcel} className="btn btn-primary d-flex align-items-center gap-2">
              <i className="bi bi-file-earmark-arrow-down-fill"></i>
              <span>Download Excel File</span>
            </button>
            {fromHistory ? (
              <button
                onClick={() => navigate('/history')}
                className="btn btn-outline-secondary d-flex align-items-center gap-2"
              >
                <i className="bi bi-clock-history"></i>
                <span>Back to History</span>
              </button>
            ) : (
              <button onClick={() => setPreviewData(null)} className="btn btn-outline-secondary d-flex align-items-center gap-2">
                <i className="bi bi-arrow-left"></i>
                <span>Create New Exam</span>
              </button>
            )}
          </div>
        </div>

        <div className="gp-table-container shadow-sm overflow-hidden">
          <div className="table-responsive" style={{ maxHeight: '65vh' }}>
            <table className="table gp-table align-middle text-center mb-0">
              <thead>
                <tr>
                  <th className="text-start">Register Number</th>
                  <th className="text-start">Student Name</th>
                  {previewData.subjectNames.map((subject, idx) => (
                    <th key={idx}>{subject}</th>
                  ))}
                  <th>Total Marks</th>
                </tr>
              </thead>
              <tbody>
                {previewData.rows.map((row, rIdx) => {
                  const total = row.marks.reduce((sum, m) => sum + (parseFloat(m) || 0), 0);
                  return (
                    <tr key={rIdx}>
                      <td className="text-start font-monospace fw-semibold text-primary">{row.registerNo}</td>
                      <td className="text-start fw-semibold text-dark">{row.studentName}</td>
                      {row.marks.map((mark, mIdx) => (
                        <td key={mIdx}>
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
                        </td>
                      ))}
                      <td className="fw-bold text-success bg-success-subtle" style={{ fontSize: '1.05rem', width: '130px' }}>
                        {total}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Save Marks Footer Bar + GradePilot AI Button */}
        <div className="d-flex align-items-center justify-content-between mt-3 px-1">
          <p className="text-muted small mb-0">
            <i className="bi bi-info-circle me-1"></i>
            Marks are saved to the database and pre-filled in Excel exports.
          </p>
          <div className="d-flex align-items-center gap-3">
            {/* GradePilot AI button — appears after first save */}
            {marksSaved && (
              <button
                className="btn d-flex align-items-center gap-2 fw-semibold px-4"
                style={{
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  color: '#fff',
                  border: 'none',
                  boxShadow: '0 4px 14px rgba(99,102,241,0.4)',
                  borderRadius: '0.6rem',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.boxShadow='0 6px 20px rgba(99,102,241,0.5)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='0 4px 14px rgba(99,102,241,0.4)'; }}
                onClick={handleCallAi}
              >
                <i className="bi bi-stars"></i>
                <span>Call GradePilot AI</span>
              </button>
            )}
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
          </div>
        </div>
      </div>
    );
  }

  // Otherwise, render configuration inputs
  return (
    <div className="fade-in-content" style={{ maxWidth: '800px' }}>
      <div className="mb-4">
        <h2 className="fw-bold text-dark mb-1">Generate Test Result</h2>
        <p className="text-muted-dark mb-0">Create empty spreadsheet rosters mapped with SUM calculation formulas.</p>
      </div>

      {error && (
        <div className="alert alert-danger d-flex align-items-center border-0 rounded-3 py-2.5 px-3 mb-4" role="alert">
          <i className="bi bi-exclamation-triangle-fill me-2"></i>
          <div>{error}</div>
        </div>
      )}

      {success && (
        <div className="alert alert-success d-flex align-items-center border-0 rounded-3 py-2.5 px-3 mb-4" role="alert">
          <i className="bi bi-check-circle-fill me-2"></i>
          <div>{success}</div>
        </div>
      )}

      <div className="gp-card p-4">
        <form onSubmit={handleSubmit}>
          <div className="row">
            <div className="col-md-8 mb-3">
              <label className="form-label" htmlFor="examName">Exam Name *</label>
              <input
                type="text"
                id="examName"
                className="form-control"
                placeholder="e.g., Unit Test - I, Semester Exams"
                value={examName}
                onChange={(e) => setExamName(e.target.value)}
                required
              />
            </div>
            <div className="col-md-4 mb-3">
              <label className="form-label" htmlFor="numSubjects">Number of Subjects *</label>
              <input
                type="number"
                id="numSubjects"
                className="form-control"
                min="1"
                max="15"
                value={numSubjects}
                onChange={handleNumSubjectsChange}
                required
              />
              <div className="form-text small">Max 15 subjects supported</div>
            </div>
          </div>

          <hr className="my-3 text-muted" />

          <h5 className="fw-bold text-dark mb-3">Subject Details</h5>
          
          <div className="row g-3">
            {subjectNames.map((subject, index) => (
              <div className="col-md-6" key={index}>
                <label className="form-label" htmlFor={`subject-${index}`}>Subject {index + 1} Name *</label>
                <input
                  type="text"
                  id={`subject-${index}`}
                  className="form-control"
                  placeholder={`Subject ${index + 1} (e.g., Mathematics)`}
                  value={subject}
                  onChange={(e) => handleSubjectNameChange(index, e.target.value)}
                  required
                />
              </div>
            ))}
          </div>

          <div className="mt-4 pt-2">
            <button type="submit" className="btn btn-primary d-flex align-items-center gap-2" disabled={loading}>
              {loading ? (
                <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
              ) : (
                <i className="bi bi-file-earmark-arrow-down-fill"></i>
              )}
              <span>Generate Result Documentation</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default GenerateTestResult;
