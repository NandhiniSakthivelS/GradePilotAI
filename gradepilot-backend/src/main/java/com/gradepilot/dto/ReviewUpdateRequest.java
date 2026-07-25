package com.gradepilot.dto;

import lombok.Data;

@Data
public class ReviewUpdateRequest {
    private Long analysisId;
    private String editedSuggestions;
    private String editedParentSummary;
    private String editedPerformanceLevel;
}
