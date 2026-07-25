package com.gradepilot.service;

import com.gradepilot.dto.StudentDto;
import com.gradepilot.entity.ClassAdvisor;
import com.gradepilot.entity.Student;
import com.gradepilot.exception.BadRequestException;
import com.gradepilot.exception.ResourceNotFoundException;
import com.gradepilot.repository.ClassAdvisorRepository;
import com.gradepilot.repository.StudentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class StudentService {

    private final StudentRepository studentRepository;
    private final ClassAdvisorRepository classAdvisorRepository;

    private ClassAdvisor getCurrentAdvisor() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return classAdvisorRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("Class Advisor not found with email: " + email));
    }

    public List<Student> getAllStudents() {
        ClassAdvisor advisor = getCurrentAdvisor();
        return studentRepository.findAllByClassAdvisorId(advisor.getId());
    }

    public List<Student> searchStudents(String query) {
        ClassAdvisor advisor = getCurrentAdvisor();
        if (query == null || query.trim().isEmpty()) {
            return getAllStudents();
        }
        return studentRepository.searchStudents(query.trim(), advisor.getId());
    }

    public Student getStudentById(Long id) {
        ClassAdvisor advisor = getCurrentAdvisor();
        return studentRepository.findByIdAndClassAdvisorId(id, advisor.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Student not found with ID: " + id));
    }

    @Transactional
    public Student createStudent(StudentDto dto) {
        ClassAdvisor advisor = getCurrentAdvisor();
        
        // Check if student with this registerNo already exists for this advisor
        if (studentRepository.existsByRegisterNoAndClassAdvisorId(dto.getRegisterNo(), advisor.getId())) {
            throw new BadRequestException("Student with Register Number " + dto.getRegisterNo() + " already exists in your class");
        }
        
        // Also enforce global uniqueness if table constraints require it
        if (studentRepository.existsByRegisterNo(dto.getRegisterNo())) {
             throw new BadRequestException("Student with Register Number " + dto.getRegisterNo() + " already exists globally");
        }

        Student student = Student.builder()
                .registerNo(dto.getRegisterNo())
                .studentName(dto.getStudentName())
                .contactNo(dto.getContactNo())
                .email(dto.getEmail())
                .parentName(dto.getParentName())
                .parentContactNo(dto.getParentContactNo())
                .parentEmail(dto.getParentEmail())
                .classAdvisor(advisor)
                .build();

        return studentRepository.save(student);
    }

    @Transactional
    public Student updateStudent(Long id, StudentDto dto) {
        Student student = getStudentById(id);
        ClassAdvisor advisor = getCurrentAdvisor();

        if (studentRepository.existsByRegisterNoAndIdNotAndClassAdvisorId(dto.getRegisterNo(), id, advisor.getId())) {
            throw new BadRequestException("Student with Register Number " + dto.getRegisterNo() + " already exists in your class");
        }
        
        if (studentRepository.existsByRegisterNoAndIdNot(dto.getRegisterNo(), id)) {
            throw new BadRequestException("Student with Register Number " + dto.getRegisterNo() + " already exists globally");
        }

        student.setRegisterNo(dto.getRegisterNo());
        student.setStudentName(dto.getStudentName());
        student.setContactNo(dto.getContactNo());
        student.setEmail(dto.getEmail());
        student.setParentName(dto.getParentName());
        student.setParentContactNo(dto.getParentContactNo());
        student.setParentEmail(dto.getParentEmail());

        return studentRepository.save(student);
    }

    @Transactional
    public void deleteStudent(Long id) {
        Student student = getStudentById(id);
        studentRepository.delete(student);
    }
}
