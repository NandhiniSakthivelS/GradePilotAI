import React from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';

const Layout = () => {
  const navigate = useNavigate();
  
  // Retrieve advisor profile details from localStorage
  const advisorName = localStorage.getItem('advisorName') || 'Advisor';
  const department = localStorage.getItem('department') || '';
  const academicYear = localStorage.getItem('academicYear') || '';
  const section = localStorage.getItem('section') || '';

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('advisorName');
    localStorage.removeItem('department');
    localStorage.removeItem('academicYear');
    localStorage.removeItem('section');
    localStorage.removeItem('email');
    navigate('/login');
  };

  return (
    <div className="dashboard-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="bg-primary text-white p-2 rounded-3 d-flex align-items-center justify-content-center" style={{ width: '40px', height: '40px', flexShrink: 0 }}>
            <i className="bi bi-compass-fill fs-5"></i>
          </div>
          <span className="sidebar-logo-text">GradePilot AI</span>
        </div>

        <nav className="sidebar-menu">
          <NavLink to="/dashboard" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <i className="bi bi-grid-1x2-fill"></i>
            <span>Dashboard</span>
          </NavLink>
          <NavLink to="/students" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <i className="bi bi-people-fill"></i>
            <span>Students</span>
          </NavLink>
          <NavLink to="/generate-test" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <i className="bi bi-file-earmark-spreadsheet-fill"></i>
            <span>Generate Test Result</span>
          </NavLink>
          <NavLink to="/history" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <i className="bi bi-clock-history"></i>
            <span>History</span>
          </NavLink>
          <NavLink to="/ai-analysis" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <i className="bi bi-robot"></i>
            <span>AI Analysis</span>
          </NavLink>
          <NavLink to="/ai-review" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <i className="bi bi-clipboard2-check-fill"></i>
            <span>AI Review</span>
          </NavLink>
          <NavLink to="/email-history" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <i className="bi bi-envelope-paper-fill"></i>
            <span>Email History</span>
          </NavLink>
          
          <button onClick={handleLogout} className="sidebar-link border-0 bg-transparent text-start w-100 mt-auto">
            <i className="bi bi-box-arrow-right text-danger"></i>
            <span className="text-danger">Logout</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="advisor-info-box">
            <p className="mb-0 text-white fw-bold text-truncate" title={advisorName}>{advisorName}</p>
            <p className="mb-0 text-muted-light small text-truncate">
              {department} - {section}
            </p>
            <p className="mb-0 text-muted-light small font-monospace" style={{ fontSize: '0.75rem' }}>
              AY: {academicYear}
            </p>
          </div>
        </div>
      </aside>

      {/* Main Panel */}
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
