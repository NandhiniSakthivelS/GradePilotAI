import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const StudentManagement = () => {
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('ADD'); // 'ADD' or 'EDIT'
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  
  // Form states
  const [formData, setFormData] = useState({
    registerNo: '',
    studentName: '',
    contactNo: '',
    email: '',
    parentName: '',
    parentContactNo: '',
    parentEmail: '',
  });

  const [formErrors, setFormErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  const token = localStorage.getItem('token');

  const fetchStudents = async (query = '') => {
    setLoading(true);
    try {
      const url = query.trim() 
        ? `http://localhost:8080/api/students?search=${encodeURIComponent(query)}`
        : 'http://localhost:8080/api/students';
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setStudents(res.data);
    } catch (err) {
      console.error('Error fetching students', err);
      if (err.response && err.response.status === 403) {
        localStorage.removeItem('token');
        navigate('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    fetchStudents();
  }, [token, navigate]);

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchStudents(searchQuery);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    fetchStudents('');
  };

  const handleFormChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    // Clear error for this field
    if (formErrors[e.target.name]) {
      setFormErrors({
        ...formErrors,
        [e.target.name]: '',
      });
    }
  };

  const validateForm = () => {
    const errors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!formData.registerNo.trim()) errors.registerNo = 'Register number is required';
    if (!formData.studentName.trim()) errors.studentName = 'Student name is required';
    
    if (!formData.contactNo.trim()) {
      errors.contactNo = 'Contact number is required';
    }
    
    if (!formData.email.trim()) {
      errors.email = 'Email address is required';
    } else if (!emailRegex.test(formData.email)) {
      errors.email = 'Invalid email address format';
    }

    if (!formData.parentName.trim()) errors.parentName = 'Parent name is required';
    
    if (!formData.parentContactNo.trim()) {
      errors.parentContactNo = 'Parent contact number is required';
    }

    if (!formData.parentEmail.trim()) {
      errors.parentEmail = 'Parent email address is required';
    } else if (!emailRegex.test(formData.parentEmail)) {
      errors.parentEmail = 'Invalid email address format';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const openAddModal = () => {
    setModalMode('ADD');
    setFormData({
      registerNo: '',
      studentName: '',
      contactNo: '',
      email: '',
      parentName: '',
      parentContactNo: '',
      parentEmail: '',
    });
    setFormErrors({});
    setApiError('');
    setShowModal(true);
  };

  const openEditModal = (student) => {
    setModalMode('EDIT');
    setSelectedStudentId(student.id);
    setFormData({
      registerNo: student.registerNo,
      studentName: student.studentName,
      contactNo: student.contactNo,
      email: student.email,
      parentName: student.parentName,
      parentContactNo: student.parentContactNo,
      parentEmail: student.parentEmail,
    });
    setFormErrors({});
    setApiError('');
    setShowModal(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setApiError('');
    
    if (!validateForm()) return;

    try {
      if (modalMode === 'ADD') {
        await axios.post('http://localhost:8080/api/students', formData, {
          headers: { Authorization: `Bearer ${token}` },
        });
        showNotification('Student added successfully!');
      } else {
        await axios.put(`http://localhost:8080/api/students/${selectedStudentId}`, formData, {
          headers: { Authorization: `Bearer ${token}` },
        });
        showNotification('Student updated successfully!');
      }
      setShowModal(false);
      fetchStudents(searchQuery);
    } catch (err) {
      if (err.response && err.response.data) {
        setApiError(err.response.data.message || 'Operation failed. Please verify details.');
      } else {
        setApiError('Network error. Failed to save student details.');
      }
    }
  };

  const handleDeleteStudent = async (id) => {
    if (!window.confirm('Are you sure you want to delete this student record?')) return;

    try {
      await axios.delete(`http://localhost:8080/api/students/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      showNotification('Student deleted successfully!');
      fetchStudents(searchQuery);
    } catch (err) {
      alert('Failed to delete student record. Please try again.');
    }
  };

  const showNotification = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => {
      setSuccessMsg('');
    }, 4000);
  };

  return (
    <>
      {/* ── Student Modal ── */}
      {showModal && (
        <>
          {/* Dark blurred backdrop — full viewport */}
          <div className="gp-modal-backdrop" onClick={() => setShowModal(false)} />

          {/* Card centered inside content area */}
          <div className="gp-modal-area">
            <div className="gp-modal-card" onClick={e => e.stopPropagation()}>

              {/* Header */}
              <div className="px-4 pt-4 pb-2 d-flex justify-content-between align-items-center border-bottom-0">
                <div>
                  <h4 className="fw-bold text-dark mb-0">
                    {modalMode === 'ADD' ? 'Add New Student' : 'Edit Student Details'}
                  </h4>
                  <p className="text-muted small mb-0 mt-1">
                    {modalMode === 'ADD' ? 'Fill in the student profile below.' : 'Update the student record.'}
                  </p>
                </div>
                <button type="button" className="btn-close" onClick={() => setShowModal(false)} aria-label="Close" />
              </div>

              {/* Body */}
              <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
                <div className="px-4 py-3" style={{ overflowY: 'auto', flex: 1 }}>
                  {apiError && (
                    <div className="alert alert-danger d-flex align-items-center py-2 px-3 mb-3 border-0 rounded-3" role="alert">
                      <i className="bi bi-exclamation-triangle-fill me-2"></i>
                      <div className="small">{apiError}</div>
                    </div>
                  )}

                  <h6 className="text-primary fw-bold text-uppercase small mb-3" style={{ letterSpacing: '0.5px' }}>
                    Academic &amp; Contact Profile
                  </h6>

                  <div className="row g-3 mb-3">
                    <div className="col-md-6">
                      <label className="form-label" htmlFor="registerNo">Register Number *</label>
                      <input
                        type="text" id="registerNo" name="registerNo"
                        className={`form-control ${formErrors.registerNo ? 'is-invalid' : ''}`}
                        value={formData.registerNo} onChange={handleFormChange}
                        placeholder="e.g., 21CS001" required
                      />
                      {formErrors.registerNo && <div className="invalid-feedback">{formErrors.registerNo}</div>}
                    </div>
                    <div className="col-md-6">
                      <label className="form-label" htmlFor="studentName">Student Name *</label>
                      <input
                        type="text" id="studentName" name="studentName"
                        className={`form-control ${formErrors.studentName ? 'is-invalid' : ''}`}
                        value={formData.studentName} onChange={handleFormChange}
                        placeholder="Full Name" required
                      />
                      {formErrors.studentName && <div className="invalid-feedback">{formErrors.studentName}</div>}
                    </div>
                    <div className="col-md-6">
                      <label className="form-label" htmlFor="contactNo">Student Contact Number *</label>
                      <input
                        type="text" id="contactNo" name="contactNo"
                        className={`form-control ${formErrors.contactNo ? 'is-invalid' : ''}`}
                        value={formData.contactNo} onChange={handleFormChange}
                        placeholder="Mobile Number" required
                      />
                      {formErrors.contactNo && <div className="invalid-feedback">{formErrors.contactNo}</div>}
                    </div>
                    <div className="col-md-6">
                      <label className="form-label" htmlFor="email">Student Email Address *</label>
                      <input
                        type="email" id="email" name="email"
                        className={`form-control ${formErrors.email ? 'is-invalid' : ''}`}
                        value={formData.email} onChange={handleFormChange}
                        placeholder="student@college.edu" required
                      />
                      {formErrors.email && <div className="invalid-feedback">{formErrors.email}</div>}
                    </div>
                  </div>

                  <hr className="my-3 text-muted" />
                  <h6 className="text-primary fw-bold text-uppercase small mb-3" style={{ letterSpacing: '0.5px' }}>
                    Parent / Guardian Details
                  </h6>

                  <div className="row g-3">
                    <div className="col-12">
                      <label className="form-label" htmlFor="parentName">Parent / Guardian Name *</label>
                      <input
                        type="text" id="parentName" name="parentName"
                        className={`form-control ${formErrors.parentName ? 'is-invalid' : ''}`}
                        value={formData.parentName} onChange={handleFormChange}
                        placeholder="Father/Mother/Guardian Name" required
                      />
                      {formErrors.parentName && <div className="invalid-feedback">{formErrors.parentName}</div>}
                    </div>
                    <div className="col-md-6">
                      <label className="form-label" htmlFor="parentContactNo">Parent Contact Number *</label>
                      <input
                        type="text" id="parentContactNo" name="parentContactNo"
                        className={`form-control ${formErrors.parentContactNo ? 'is-invalid' : ''}`}
                        value={formData.parentContactNo} onChange={handleFormChange}
                        placeholder="Mobile Number" required
                      />
                      {formErrors.parentContactNo && <div className="invalid-feedback">{formErrors.parentContactNo}</div>}
                    </div>
                    <div className="col-md-6">
                      <label className="form-label" htmlFor="parentEmail">Parent Email Address *</label>
                      <input
                        type="email" id="parentEmail" name="parentEmail"
                        className={`form-control ${formErrors.parentEmail ? 'is-invalid' : ''}`}
                        value={formData.parentEmail} onChange={handleFormChange}
                        placeholder="parent@service.com" required
                      />
                      {formErrors.parentEmail && <div className="invalid-feedback">{formErrors.parentEmail}</div>}
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="px-4 pb-4 pt-3 d-flex justify-content-end gap-2 border-top">
                  <button type="button" className="btn btn-light border px-4 py-2" onClick={() => setShowModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary px-4 py-2">
                    {modalMode === 'ADD' ? 'Add Student' : 'Save Changes'}
                  </button>
                </div>
              </form>

            </div>
          </div>
        </>
      )}

      <div className="fade-in-content">
      {/* Upper header */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
        <div>
          <h2 className="fw-bold text-dark mb-1">Student Management</h2>
          <p className="text-muted-dark mb-0">Maintain student contact information and registry profiles.</p>
        </div>
        <button onClick={openAddModal} className="btn btn-primary d-flex align-items-center gap-2">
          <i className="bi bi-person-plus-fill"></i>
          <span>Add Student</span>
        </button>
      </div>

      {/* Success banner alert */}
      {successMsg && (
        <div className="alert alert-success d-flex align-items-center border-0 rounded-3 py-2.5 px-3 mb-4" role="alert">
          <i className="bi bi-check-circle-fill me-2 fs-5"></i>
          <div>{successMsg}</div>
        </div>
      )}

      {/* Filter and search controls */}
      <div className="bg-white p-3 rounded-4 border mb-4 shadow-sm">
        <form onSubmit={handleSearchSubmit} className="d-flex gap-2">
          <div className="position-relative flex-grow-1">
            <i className="bi bi-search position-absolute top-50 translate-middle-y start-0 ms-3 text-muted"></i>
            <input
              type="text"
              placeholder="Search student by Register Number or Name..."
              className="form-control ps-5"
              value={searchQuery}
              onChange={handleSearchChange}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="btn position-absolute top-50 end-0 translate-middle-y me-2 border-0 bg-transparent py-1 px-2"
              >
                <i className="bi bi-x-lg text-muted"></i>
              </button>
            )}
          </div>
          <button type="submit" className="btn btn-primary px-4">Search</button>
        </form>
      </div>

      {/* Roster table */}
      <div className="gp-table-container">
        {loading ? (
          <div className="p-5 text-center text-muted-dark">
            <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
            Loading student roster...
          </div>
        ) : students.length === 0 ? (
          <div className="p-5 text-center text-muted-dark">
            <i className="bi bi-people text-muted fs-1 mb-2 d-block"></i>
            No students found. Add your first student or check the search filter.
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table gp-table align-middle">
              <thead>
                <tr>
                  <th>Reg Number</th>
                  <th>Student Name</th>
                  <th>Contact info</th>
                  <th>Parent Info</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <tr key={student.id}>
                    <td className="font-monospace fw-semibold text-primary">{student.registerNo}</td>
                    <td>
                      <div className="fw-semibold text-dark">{student.studentName}</div>
                    </td>
                    <td>
                      <div className="small text-dark mb-0.5">
                        <i className="bi bi-telephone-fill text-muted me-1.5"></i>
                        {student.contactNo}
                      </div>
                      <div className="small text-muted-dark">
                        <i className="bi bi-envelope-fill text-muted me-1.5"></i>
                        {student.email}
                      </div>
                    </td>
                    <td>
                      <div className="small text-dark fw-medium mb-0.5">
                        <i className="bi bi-person-fill text-muted me-1.5"></i>
                        {student.parentName}
                      </div>
                      <div className="small text-muted-dark mb-0.5">
                        <i className="bi bi-telephone text-muted me-1.5"></i>
                        {student.parentContactNo}
                      </div>
                      <div className="small text-muted-dark">
                        <i className="bi bi-envelope text-muted me-1.5"></i>
                        {student.parentEmail}
                      </div>
                    </td>
                    <td className="text-end">
                      <div className="d-flex justify-content-end gap-2">
                        <button
                          onClick={() => openEditModal(student)}
                          className="btn btn-outline-secondary btn-sm border-0 bg-transparent py-1.5 px-2.5 rounded-3"
                          title="Edit Student"
                        >
                          <i className="bi bi-pencil-square fs-5 text-primary"></i>
                        </button>
                        <button
                          onClick={() => handleDeleteStudent(student.id)}
                          className="btn btn-outline-danger btn-sm border-0 bg-transparent py-1.5 px-2.5 rounded-3"
                          title="Delete Student"
                        >
                          <i className="bi bi-trash-fill fs-5 text-danger"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
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

export default StudentManagement;
