package com.gradepilot.service;

import com.gradepilot.dto.ExamRequest;
import com.gradepilot.dto.StudentMarkDto;
import com.gradepilot.entity.ClassAdvisor;
import com.gradepilot.entity.Exam;
import com.gradepilot.entity.StudentMark;
import com.gradepilot.exception.ResourceNotFoundException;
import com.gradepilot.repository.ClassAdvisorRepository;
import com.gradepilot.repository.ExamRepository;
import com.gradepilot.repository.StudentMarkRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ExamService {

    private final ExamRepository examRepository;
    private final StudentMarkRepository studentMarkRepository;
    private final ClassAdvisorRepository classAdvisorRepository;

    public ClassAdvisor getCurrentAdvisor() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return classAdvisorRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("Class Advisor not found with email: " + email));
    }

    @Transactional
    public Exam createExam(ExamRequest request) {
        ClassAdvisor advisor = getCurrentAdvisor();
        Exam exam = Exam.builder()
                .examName(request.getExamName().trim())
                .subjectNames(request.getSubjectNames().stream().map(String::trim).toList())
                .createdAt(LocalDateTime.now())
                .classAdvisor(advisor)
                .build();
        return examRepository.save(exam);
    }

    public List<Exam> getAllExams() {
        ClassAdvisor advisor = getCurrentAdvisor();
        return examRepository.findAllByClassAdvisorId(advisor.getId());
    }

    public Exam getExamById(Long id) {
        ClassAdvisor advisor = getCurrentAdvisor();
        return examRepository.findByIdAndClassAdvisorId(id, advisor.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Exam not found with ID: " + id));
    }

    @Transactional
    public void saveMarks(Long examId, List<StudentMarkDto> markDtos) {
        // Will throw ResourceNotFoundException if it belongs to another advisor
        Exam exam = getExamById(examId);

        // Overwrite existing marks by deleting them first
        studentMarkRepository.deleteByExamId(examId);
        studentMarkRepository.flush();

        List<StudentMark> marks = markDtos.stream().map(dto -> StudentMark.builder()
                .examId(examId)
                .registerNo(dto.getRegisterNo())
                .subjectName(dto.getSubjectName())
                .marks(dto.getMarks())
                .build()).toList();

        studentMarkRepository.saveAll(marks);
    }

    public List<StudentMark> getMarksForExam(Long examId) {
        // Will throw ResourceNotFoundException if it belongs to another advisor
        Exam exam = getExamById(examId);
        return studentMarkRepository.findByExamId(examId);
    }

    @Transactional
    public void deleteExam(Long examId) {
        // Will throw ResourceNotFoundException if it belongs to another advisor
        Exam exam = getExamById(examId);
        studentMarkRepository.deleteByExamId(examId);
        examRepository.delete(exam);
    }
}
