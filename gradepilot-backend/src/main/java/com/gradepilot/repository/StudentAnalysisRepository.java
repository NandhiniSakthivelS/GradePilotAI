package com.gradepilot.repository;

import com.gradepilot.entity.StudentAnalysis;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface StudentAnalysisRepository extends JpaRepository<StudentAnalysis, Long> {
    List<StudentAnalysis> findByExamId(Long examId);
    Optional<StudentAnalysis> findByStudentIdAndExamId(Long studentId, Long examId);
    void deleteByExamId(Long examId);
}
