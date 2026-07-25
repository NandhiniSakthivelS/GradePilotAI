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
public class EmailHistoryResponseDto {
    private Long id;
    private Long studentId;
    private String studentName;
    private String registerNo;
    private String parentEmail;
    private Long examId;
    private String examName;
    private Long reportId;
    private LocalDateTime sentAt;
    private String deliveryStatus;
    private String failureReason;
}
