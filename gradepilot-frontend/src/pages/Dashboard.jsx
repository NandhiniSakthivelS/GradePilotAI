import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

const Dashboard = () => {
  const navigate = useNavigate();
  const [studentCount, setStudentCount] = useState(0);

  const advisorName = localStorage.getItem('advisorName') || 'Class Advisor';
  const department = localStorage.getItem('department') || '';
  const academicYear = localStorage.getItem('academicYear') || '';
  const section = localStorage.getItem('section') || '';

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    axios
      .get('http://localhost:8080/api/students', {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        setStudentCount(res.data.length);
      })
      .catch((err) => {
        console.error('Failed to load students statistics', err);
        if (err.response && err.response.status === 403) {
          // Token might be invalid/expired
          localStorage.removeItem('token');
          navigate('/login');
        }
      });
  }, [navigate]);

  return (
    <div className="fade-in-content">
      {/* Header welcome banner */}
      <div className="bg-white p-3.5 rounded-4 border mb-4 shadow-sm d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
        <div>
          <span className="badge bg-primary-subtle text-primary px-2.5 py-1.5 rounded-pill fw-semibold mb-2" style={{ fontSize: '0.75rem' }}>Class Advisor Portal</span>
          <h4 className="fw-bold mb-1 text-dark fs-5">Welcome back, {advisorName}!</h4>
          <p className="text-muted-dark mb-0 small">Manage your class roster and generate mark entry sheets effortlessly.</p>
        </div>
        <div className="bg-light p-2.5 rounded-3 border d-flex align-items-center gap-3">
          <div className="bg-primary text-white rounded-3 p-2 d-flex align-items-center justify-content-center" style={{ width: '40px', height: '40px' }}>
            <i className="bi bi-person-workspace fs-5"></i>
          </div>
          <div>
            <p className="text-muted-dark small mb-0 fw-medium" style={{ fontSize: '0.75rem' }}>Active Class</p>
            <p className="fw-bold mb-0 text-dark small">{department} - {section} ({academicYear})</p>
          </div>
        </div>
      </div>

      {/* Main cards */}
      <h6 className="fw-bold text-dark mb-3 text-uppercase small" style={{ letterSpacing: '0.5px' }}>Quick Navigation</h6>
      <div className="row g-4">
        {/* Student Management Card */}
        <div className="col-md-6">
          <div className="gp-card p-3.5 h-100 d-flex flex-column">
            <div className="d-flex justify-content-between align-items-start mb-3">
              <div className="dashboard-card-icon bg-primary-subtle text-primary" style={{ width: '44px', height: '44px', fontSize: '1.25rem' }}>
                <i className="bi bi-people-fill"></i>
              </div>
              <span className="badge bg-light text-dark border px-2 py-1 rounded-pill fw-semibold" style={{ fontSize: '0.75rem' }}>
                {studentCount} {studentCount === 1 ? 'Student' : 'Students'} Registered
              </span>
            </div>
            <h5 className="fw-bold text-dark mb-1.5 fs-6">Student Management</h5>
            <p className="text-muted-dark flex-grow-1 small">
              Add new students, edit existing details, search students by registry number or name, or delete students from the section roster.
            </p>
            <Link to="/students" className="btn btn-primary w-fit mt-2 py-2 px-3 small" style={{ fontSize: '0.85rem' }}>
              Manage Students <i className="bi bi-arrow-right ms-1.5"></i>
            </Link>
          </div>
        </div>

        {/* Generate Test Result Card */}
        <div className="col-md-6">
          <div className="gp-card p-3.5 h-100 d-flex flex-column">
            <div className="d-flex justify-content-between align-items-start mb-3">
              <div className="dashboard-card-icon bg-success-subtle text-success" style={{ width: '44px', height: '44px', fontSize: '1.25rem' }}>
                <i className="bi bi-file-earmark-spreadsheet-fill"></i>
              </div>
            </div>
            <h5 className="fw-bold text-dark mb-1.5 fs-6">Generate Test Result</h5>
            <p className="text-muted-dark flex-grow-1 small">
              Prepare a new examination sheet by entering the test name and subjects. Generates an Excel document pre-loaded with student rosters and calculation formulas.
            </p>
            <Link to="/generate-test" className="btn btn-primary w-fit mt-2 py-2 px-3 small" style={{ fontSize: '0.85rem' }}>
              Create Mark Sheet <i className="bi bi-arrow-right ms-1.5"></i>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
