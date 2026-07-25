import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

const Register = () => {
  const [formData, setFormData] = useState({
    advisorName: '',
    department: '',
    academicYear: '',
    section: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();



  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Client-side validations
    if (
      !formData.advisorName ||
      !formData.department ||
      !formData.academicYear ||
      !formData.section ||
      !formData.email ||
      !formData.password ||
      !formData.confirmPassword
    ) {
      setError('All fields are required.');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Password and Confirm Password do not match.');
      return;
    }

    setLoading(true);
    try {
      await axios.post('http://localhost:8080/api/auth/register', formData);
      setSuccess('Account created successfully. Please sign in.');
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err) {
      if (err.response && err.response.data) {
        if (typeof err.response.data === 'string') {
          setError(err.response.data);
        } else if (err.response.data.message) {
          setError(err.response.data.message);
        } else {
          // Object containing field errors
          const fieldErrors = Object.values(err.response.data).join(' ');
          setError(fieldErrors || 'Registration failed. Please check inputs.');
        }
      } else {
        setError('Connection to backend failed. Make sure the server is running.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-bg">
      <div className="auth-card fade-in-content">
        <h1 className="auth-brand">GradePilot AI</h1>
        <p className="text-center text-muted-dark mb-4">Create Class Advisor Account</p>

        {error && (
          <div className="alert alert-danger d-flex align-items-center py-2 px-3 mb-3 border-0 rounded-3" role="alert">
            <i className="bi bi-exclamation-triangle-fill me-2"></i>
            <div className="small">{error}</div>
          </div>
        )}

        {success && (
          <div className="alert alert-success d-flex align-items-center py-2 px-3 mb-3 border-0 rounded-3" role="alert">
            <i className="bi bi-check-circle-fill me-2"></i>
            <div className="small">{success}</div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="form-label" htmlFor="advisorName">Class Advisor Name</label>
            <input
              type="text"
              id="advisorName"
              name="advisorName"
              className="form-control"
              placeholder="e.g., Prof. Rajesh Kumar"
              value={formData.advisorName}
              onChange={handleChange}
              required
            />
          </div>

          <div className="row">
            <div className="col-md-6 mb-3">
              <label className="form-label" htmlFor="department">Department Name</label>
              <input
                type="text"
                id="department"
                name="department"
                className="form-control"
                placeholder="e.g., CSE"
                value={formData.department}
                onChange={handleChange}
                required
              />
            </div>
            <div className="col-md-6 mb-3">
              <label className="form-label" htmlFor="academicYear">Academic Year</label>
              <input
                type="text"
                id="academicYear"
                name="academicYear"
                className="form-control"
                placeholder="e.g., 2025-2026"
                value={formData.academicYear}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="row">
            <div className="col-md-6 mb-3">
              <label className="form-label" htmlFor="section">Section</label>
              <input
                type="text"
                id="section"
                name="section"
                className="form-control"
                placeholder="e.g., A"
                value={formData.section}
                onChange={handleChange}
                required
              />
            </div>
            <div className="col-md-6 mb-3">
              <label className="form-label" htmlFor="email">Email Address</label>
              <input
                type="email"
                id="email"
                name="email"
                className="form-control"
                placeholder="advisor@college.edu"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="row">
            <div className="col-md-6 mb-3">
              <label className="form-label" htmlFor="password">Create Password</label>
              <input
                type="password"
                id="password"
                name="password"
                className="form-control"
                value={formData.password}
                onChange={handleChange}
                required
              />
            </div>
            <div className="col-md-6 mb-3">
              <label className="form-label" htmlFor="confirmPassword">Confirm Password</label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                className="form-control"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary w-100 mt-2 py-2.5" disabled={loading}>
            {loading ? (
              <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
            ) : null}
            Create Account
          </button>
        </form>

        <p className="text-center text-muted-dark mt-3 mb-0 small">
          Already have an account? <Link to="/login" className="text-primary fw-bold text-decoration-none">Sign In</Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
