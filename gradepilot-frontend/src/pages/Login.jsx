import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [regEnabled, setRegEnabled] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // If we have a token already, go to dashboard
    if (localStorage.getItem('token')) {
      navigate('/dashboard');
      return;
    }
  }, [navigate]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.email || !formData.password) {
      setError('Both email and password are required.');
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post('http://localhost:8080/api/auth/login', formData);
      const { token, advisorName, department, academicYear, section, email } = res.data;

      // Save credentials in localStorage
      localStorage.setItem('token', token);
      localStorage.setItem('advisorName', advisorName);
      localStorage.setItem('department', department);
      localStorage.setItem('academicYear', academicYear);
      localStorage.setItem('section', section);
      localStorage.setItem('email', email);

      navigate('/dashboard');
    } catch (err) {
      if (err.response && err.response.data) {
        setError(err.response.data.message || 'Invalid email or password.');
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
        <p className="text-center text-muted-dark mb-4">Class Advisor Sign In</p>

        {error && (
          <div className="alert alert-danger d-flex align-items-center py-2 px-3 mb-3 border-0 rounded-3" role="alert">
            <i className="bi bi-exclamation-triangle-fill me-2"></i>
            <div className="small">{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-3">
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

          <div className="mb-4">
            <label className="form-label" htmlFor="password">Password</label>
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

          <button type="submit" className="btn btn-primary w-100 py-2.5" disabled={loading}>
            {loading ? (
              <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
            ) : null}
            Sign In
          </button>
        </form>

        <p className="text-center text-muted-dark mt-3 mb-0 small">
          Don't have an account? <Link to="/register" className="text-primary fw-bold text-decoration-none">Create Account</Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
