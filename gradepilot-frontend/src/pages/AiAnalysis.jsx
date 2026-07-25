import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';

const AiAnalysis = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  const [exams, setExams] = useState([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [analysisData, setAnalysisData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // 1. Initial Load: fetch exams and resolve default selected exam
  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    fetchExams();
  }, [token]);

  const fetchExams = async () => {
    try {
      const res = await axios.get('http://localhost:8080/api/exams', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setExams(res.data);

      // If redirected from History with state
      if (location.state && location.state.examId) {
        setSelectedExamId(location.state.examId);
        fetchAnalysis(location.state.examId);
      } else if (res.data.length > 0) {
        setSelectedExamId(res.data[0].id);
        fetchAnalysis(res.data[0].id);
      }
    } catch (err) {
      console.error('Failed to load exams list', err);
      setErrorMsg('Failed to load exams.');
    }
  };

  const fetchAnalysis = async (examId) => {
    if (!examId) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await axios.get(`http://localhost:8080/api/ai/exams/${examId}/analysis`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAnalysisData(res.data);
    } catch (err) {
      console.error('Failed to fetch analysis', err);
      setAnalysisData(null);
      setErrorMsg('No AI Analysis found for this exam yet. Please click the Analyze button below to generate insights.');
    } finally {
      setLoading(false);
    }
  };

  const handleExamChange = (e) => {
    const id = e.target.value;
    setSelectedExamId(id);
    if (id) {
      fetchAnalysis(id);
    } else {
      setAnalysisData(null);
    }
  };

  const triggerNewAnalysis = async () => {
    if (!selectedExamId) return;
    setAiLoading(true);
    setErrorMsg('');
    try {
      await axios.post(`http://localhost:8080/api/ai/analyze?examId=${selectedExamId}`, null, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchAnalysis(selectedExamId);
    } catch (err) {
      console.error('AI Analysis trigger failed', err);
      setErrorMsg('AI Analysis failed. Please verify that your Gemini API key is configured correctly in application.properties and student marks are saved.');
    } finally {
      setAiLoading(false);
    }
  };

  // Performance Badge styling helper
  const getPerformanceBadgeClass = (level) => {
    const lvl = level ? level.toLowerCase() : '';
    if (lvl.includes('excellent')) return 'bg-success text-white';
    if (lvl.includes('very good') || lvl.includes('good')) return 'bg-info text-white';
    return 'bg-danger text-white';
  };

  if (aiLoading) {
    return (
      <div className="d-flex flex-column align-items-center justify-content-center" style={{ minHeight: '80vh', width: '100%' }}>
        <div className="text-center">
          <div className="spinner-border text-primary mb-4" role="status" style={{ width: '3.5rem', height: '3.5rem' }}>
            <span className="visually-hidden">Loading...</span>
          </div>
          <h4 className="fw-bold mb-2">🤖 GradePilot AI is analyzing student performance...</h4>
          <p className="text-muted-light">Please wait. Processing qualitative analysis via Google Gemini API...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in-content">
      {/* Title & Selector Toolbar */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
        <div>
          <h2 className="fw-bold text-dark mb-1">🤖 GradePilot AI Analysis</h2>
          <p className="text-muted-dark mb-0">
            Generate and view qualitative academic summaries, strong/weak subjects, and action recommendations.
          </p>
        </div>
        <div className="d-flex align-items-center gap-2 flex-wrap">
          {analysisData && (
            <button
              className="btn btn-success btn-sm"
              onClick={() => navigate('/ai-review')}
              id="go-to-review-btn"
            >
              📋 Review &amp; Approve
            </button>
          )}
          <div className="d-flex align-items-center gap-2" style={{ minWidth: '220px' }}>
            <label className="text-muted-light small fw-semibold text-nowrap mb-0 me-2">Exam:</label>
            <select
              className="form-select"
              value={selectedExamId}
              onChange={handleExamChange}
              disabled={loading}
            >
              {exams.map((exam) => (
                <option key={exam.id} value={exam.id}>
                  {exam.examName}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="alert alert-info border-0 rounded-3 mb-4 d-flex align-items-center justify-content-between p-3.5">
          <div className="d-flex align-items-center gap-2">
            <i className="bi bi-info-circle-fill fs-5"></i>
            <span className="small fw-medium">{errorMsg}</span>
          </div>
          {selectedExamId && !analysisData && (
            <button className="btn btn-primary btn-sm py-1.5 px-3" onClick={triggerNewAnalysis}>
              🤖 Trigger AI Analysis
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className="p-5 text-center text-muted-dark">
          <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
          Loading analysis summary...
        </div>
      ) : analysisData ? (
        <div>
          {/* Class Analytics Summary Cards */}
          <div className="row g-3 mb-4">
            <div className="col-6 col-md-3">
              <div className="gp-card p-3 h-100">
                <p className="text-muted-light small fw-medium mb-1">Class Average</p>
                <h3 className="fw-bold text-dark mb-0">{analysisData.classAverage}%</h3>
              </div>
            </div>
            <div className="col-6 col-md-3">
              <div className="gp-card p-3 h-100">
                <p className="text-muted-light small fw-medium mb-1">Highest Score</p>
                <h3 className="fw-bold text-success mb-0">{analysisData.highestPercentage}%</h3>
              </div>
            </div>
            <div className="col-6 col-md-3">
              <div className="gp-card p-3 h-100">
                <p className="text-muted-light small fw-medium mb-1">Excellent Students</p>
                <h3 className="fw-bold text-primary mb-0">{analysisData.excellentCount}</h3>
              </div>
            </div>
            <div className="col-6 col-md-3">
              <div className="gp-card p-3 h-100">
                <p className="text-muted-light small fw-medium mb-1">Needs Improvement</p>
                <h3 className="fw-bold text-danger mb-0">{analysisData.needImprovementCount}</h3>
              </div>
            </div>
          </div>

          <h5 className="fw-bold text-dark mb-3">Individual Student Performance</h5>

          {/* Student Cards Grid */}
          <div className="row g-4">
            {analysisData.studentsAnalysis.map((student) => (
              <div className="col-md-6 col-lg-4" key={student.id}>
                <div className="gp-card p-3.5 h-100 d-flex flex-column" style={{ border: '1px solid #e0f2fe' }}>
                  <div className="d-flex justify-content-between align-items-start mb-2.5">
                    <div>
                      <h6 className="fw-bold text-dark mb-0.5">{student.studentName}</h6>
                      <span className="text-muted-light small font-monospace">{student.registerNo}</span>
                    </div>
                    <span className="badge bg-primary-subtle text-primary rounded-pill px-2.5 py-1.5 fw-bold" style={{ fontSize: '0.85rem' }}>
                      {student.overallPercentage}%
                    </span>
                  </div>

                  <hr className="my-2" style={{ borderColor: '#f1f5f9' }} />

                  {/* Strong/Weak Subjects */}
                  <div className="mb-2.5">
                    <p className="small mb-1 text-dark">
                      <strong className="text-success"><i className="bi bi-chevron-up me-1"></i>Strong:</strong> {student.strongSubjects}
                    </p>
                    <p className="small mb-0 text-dark">
                      <strong className="text-danger"><i className="bi bi-chevron-down me-1"></i>Weak:</strong> {student.weakSubjects}
                    </p>
                  </div>

                  {/* Performance Level */}
                  <div className="mb-3 d-flex align-items-center gap-2">
                    <span className="text-muted-light small fw-medium">Performance:</span>
                    <span className={`badge px-2 py-1 rounded-pill ${getPerformanceBadgeClass(student.performanceLevel)}`}>
                      {student.performanceLevel}
                    </span>
                  </div>

                  {/* Suggestions Box */}
                  <div className="bg-light p-2.5 rounded-3 border mb-3 flex-grow-1">
                    <p className="text-muted-light small fw-bold mb-1 text-uppercase" style={{ fontSize: '0.7rem', letterSpacing: '0.5px' }}>
                      🤖 AI Suggestions
                    </p>
                    <p className="text-dark small mb-0 font-italic" style={{ lineHeight: '1.4' }}>
                      "{student.suggestions}"
                    </p>
                  </div>

                  {/* Parent-Friendly Academic Summary */}
                  <div className="p-2 border-top">
                    <p className="text-muted-light small fw-bold mb-1 text-uppercase" style={{ fontSize: '0.7rem', letterSpacing: '0.5px' }}>
                      👪 Parent Summary
                    </p>
                    <p className="text-muted-light small mb-0" style={{ lineHeight: '1.45', fontSize: '0.82rem' }}>
                      {student.parentSummary}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {/* Quick Actions Bar */}
          <div className="d-flex gap-2 mt-4 pt-3 border-top flex-wrap align-items-center">
            <button
              className="btn btn-outline-primary btn-sm"
              onClick={triggerNewAnalysis}
              disabled={!selectedExamId}
              id="re-analyze-btn"
            >
              🔄 Re-analyze
            </button>
            <button
              className="btn btn-success btn-sm"
              onClick={() => navigate('/ai-review')}
              id="go-to-review-bottom-btn"
            >
              📋 Review &amp; Approve Reports
            </button>
          </div>
        </div>
      ) : (
        <div className="text-center p-5 text-muted-dark bg-light rounded-4 border">
          <i className="bi bi-robot fs-1 text-muted mb-2 d-block"></i>
          Select an exam or generate one to see qualitative performance analysis.
        </div>
      )}
    </div>
  );
};

export default AiAnalysis;
