package com.gradepilot.repository;

import com.gradepilot.entity.EmailHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface EmailHistoryRepository extends JpaRepository<EmailHistory, Long> {
    List<EmailHistory> findAllByAdvisorIdOrderBySentAtDesc(Long advisorId);
}
