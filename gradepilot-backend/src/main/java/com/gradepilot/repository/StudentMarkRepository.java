package com.gradepilot.repository;

import com.gradepilot.entity.StudentMark;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface StudentMarkRepository extends JpaRepository<StudentMark, Long> {
    List<StudentMark> findByExamId(Long examId);
    void deleteByExamId(Long examId);
}
