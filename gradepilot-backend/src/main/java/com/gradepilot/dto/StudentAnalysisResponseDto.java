package com.gradepilot.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StudentAnalysisResponseDto {
    private Long id;
    private Long studentId;
    private String studentName;
    private String registerNo;
    private Long examId;
    private Double overallPercentage;
    private String strongSubjects;
    private String weakSubjects;
    private String performanceLevel;
    private String suggestions;
    private String parentSummary;
    private String parentName;
    private String parentEmail;
    private LocalDateTime createdAt;

    // Phase 4: AI Review & Approval fields
    private String editedSuggestions;
    private String editedParentSummary;
    private String editedPerformanceLevel;
    private Boolean isApproved;
    private String approvedBy;
    private LocalDateTime approvedAt;
}
