package com.gradepilot.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "student_analysis", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"student_id", "exam_id"})
})
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StudentAnalysis {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "student_id", nullable = false)
    private Long studentId;

    @Column(name = "exam_id", nullable = false)
    private Long examId;

    @Column(name = "overall_percentage", nullable = false)
    private Double overallPercentage;

    @Column(name = "strong_subjects")
    private String strongSubjects;

    @Column(name = "weak_subjects")
    private String weakSubjects;

    @Column(name = "performance_level")
    private String performanceLevel;

    @Column(name = "suggestions", columnDefinition = "TEXT")
    private String suggestions;

    @Column(name = "parent_summary", columnDefinition = "TEXT")
    private String parentSummary;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    // ── Phase 4: AI Review & Approval Fields ──────────────────────────────────

    @Column(name = "edited_suggestions", columnDefinition = "TEXT")
    private String editedSuggestions;

    @Column(name = "edited_parent_summary", columnDefinition = "TEXT")
    private String editedParentSummary;

    @Column(name = "edited_performance_level")
    private String editedPerformanceLevel;

    @Column(name = "is_approved", nullable = false)
    @Builder.Default
    private Boolean isApproved = false;

    @Column(name = "approved_by")
    private String approvedBy;

    @Column(name = "approved_at")
    private LocalDateTime approvedAt;
}
