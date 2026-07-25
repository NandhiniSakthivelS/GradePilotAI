package com.gradepilot.repository;

import com.gradepilot.entity.ClassAdvisor;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ClassAdvisorRepository extends JpaRepository<ClassAdvisor, Long> {
    Optional<ClassAdvisor> findByEmail(String email);
    boolean existsByEmail(String email);
}
