package com.gradepilot.repository;

import com.gradepilot.entity.Exam;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ExamRepository extends JpaRepository<Exam, Long> {
    List<Exam> findAllByClassAdvisorId(Long advisorId);
    Optional<Exam> findByIdAndClassAdvisorId(Long id, Long advisorId);
}
