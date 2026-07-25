package com.gradepilot.repository;

import com.gradepilot.entity.Student;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface StudentRepository extends JpaRepository<Student, Long> {
    List<Student> findAllByClassAdvisorId(Long advisorId);
    Optional<Student> findByIdAndClassAdvisorId(Long id, Long advisorId);
    Optional<Student> findByRegisterNoAndClassAdvisorId(String registerNo, Long advisorId);
    boolean existsByRegisterNoAndClassAdvisorId(String registerNo, Long advisorId);
    boolean existsByRegisterNoAndIdNotAndClassAdvisorId(String registerNo, Long id, Long advisorId);
    
    // Check globally to keep registry number unique across all advisors if required by database
    boolean existsByRegisterNo(String registerNo);
    boolean existsByRegisterNoAndIdNot(String registerNo, Long id);

    @Query("SELECT s FROM Student s WHERE s.classAdvisor.id = :advisorId AND (" +
           "LOWER(s.registerNo) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           "LOWER(s.studentName) LIKE LOWER(CONCAT('%', :query, '%')))")
    List<Student> searchStudents(@Param("query") String query, @Param("advisorId") Long advisorId);
}
