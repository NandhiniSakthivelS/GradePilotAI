package com.gradepilot.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BulkEmailResponseDto {

    private Long examId;
    private String examName;

    private int totalStudents;
    private int successCount;
    private int failureCount;

    /** One entry per student — SUCCESS or FAILURE. */
    private List<BulkEmailResultItem> results;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class BulkEmailResultItem {
        private Long studentId;
        private String studentName;
        private String registerNo;
        private String parentEmail;
        private String status;       // "SUCCESS" | "FAILURE"
        private String failureReason;
    }
}
