package com.gradepilot.controller;

import com.gradepilot.dto.ReviewUpdateRequest;
import com.gradepilot.dto.StudentAnalysisResponseDto;
import com.gradepilot.entity.Exam;
import com.gradepilot.service.AiAnalysisService;
import com.gradepilot.service.ExamService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestClientResponseException;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
public class AiController {

    private static final Logger log = LoggerFactory.getLogger(AiController.class);

    private final AiAnalysisService aiAnalysisService;
    private final ExamService examService;

    @PostMapping("/analyze")
    public ResponseEntity<?> analyzeExam(@RequestParam Long examId) {
        try {
            List<StudentAnalysisResponseDto> analysis = aiAnalysisService.performAiAnalysis(examId);
            return ResponseEntity.ok(analysis);
        } catch (Exception e) {
            // Find root/nested RestClientResponseException
            Throwable cause = e;
            while (cause != null && !(cause instanceof RestClientResponseException)) {
                cause = cause.getCause();
            }

            if (cause instanceof RestClientResponseException) {
                RestClientResponseException rcre = (RestClientResponseException) cause;
                log.error("AI Analysis failed due to Gemini API error. Status: {}, Response: {}", 
                        rcre.getStatusCode(), rcre.getResponseBodyAsString(), e);
                
                try {
                    java.io.StringWriter sw = new java.io.StringWriter();
                    java.io.PrintWriter pw = new java.io.PrintWriter(sw);
                    e.printStackTrace(pw);
                    java.nio.file.Files.writeString(
                        java.nio.file.Paths.get("ai-error.txt"),
                        "Status: " + rcre.getStatusCode() + "\nResponse: " + rcre.getResponseBodyAsString() + "\n\nStacktrace:\n" + sw.toString()
                    );
                } catch (Exception ex) {
                    log.error("Failed to write to ai-error.txt", ex);
                }

                return ResponseEntity.status(rcre.getStatusCode())
                        .contentType(MediaType.APPLICATION_JSON)
                        .body(rcre.getResponseBodyAsString());
            }

            log.error("AI Analysis failed with internal error", e);
            try {
                java.io.StringWriter sw = new java.io.StringWriter();
                java.io.PrintWriter pw = new java.io.PrintWriter(sw);
                e.printStackTrace(pw);
                java.nio.file.Files.writeString(
                    java.nio.file.Paths.get("ai-error.txt"),
                    e.toString() + "\n\nStacktrace:\n" + sw.toString()
                );
            } catch (Exception ex) {
                log.error("Failed to write to ai-error.txt", ex);
            }
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/exams/{examId}/analysis")
    public ResponseEntity<Map<String, Object>> getAnalysisSummary(@PathVariable Long examId) {
        // Retrieve the exam and confirm ownership/validity
        Exam exam = examService.getExamById(examId);
        
        List<StudentAnalysisResponseDto> individualAnalysis = aiAnalysisService.getExistingAnalysis(examId);

        int totalStudents = individualAnalysis.size();
        double classAverage = 0.0;
        double highestPercentage = 0.0;
        double lowestPercentage = 100.0;
        int excellentCount = 0;
        int needImprovementCount = 0;

        if (totalStudents > 0) {
            double sum = 0.0;
            for (StudentAnalysisResponseDto dto : individualAnalysis) {
                double pct = dto.getOverallPercentage();
                sum += pct;
                if (pct > highestPercentage) highestPercentage = pct;
                if (pct < lowestPercentage) lowestPercentage = pct;
                if (pct >= 85.0) excellentCount++;
                if (pct < 50.0) needImprovementCount++;
            }
            classAverage = sum / totalStudents;
        } else {
            lowestPercentage = 0.0;
        }

        Map<String, Object> summary = new HashMap<>();
        summary.put("examName", exam.getExamName());
        summary.put("totalStudents", totalStudents);
        summary.put("classAverage", Double.parseDouble(String.format("%.2f", classAverage)));
        summary.put("highestPercentage", Double.parseDouble(String.format("%.2f", highestPercentage)));
        summary.put("lowestPercentage", Double.parseDouble(String.format("%.2f", lowestPercentage)));
        summary.put("excellentCount", excellentCount);
        summary.put("needImprovementCount", needImprovementCount);
        summary.put("studentsAnalysis", individualAnalysis);

        return ResponseEntity.ok(summary);
    }

    // ── Phase 4: AI Review & Approval Endpoints ──────────────────────────────

    /**
     * Save advisor edits to an individual student's AI analysis.
     * PATCH /api/ai/analysis/{analysisId}/review
     */
    @PatchMapping("/analysis/{analysisId}/review")
    public ResponseEntity<StudentAnalysisResponseDto> updateReview(
            @PathVariable Long analysisId,
            @RequestBody ReviewUpdateRequest req) {
        StudentAnalysisResponseDto updated = aiAnalysisService.updateReview(
                analysisId,
                req.getEditedSuggestions(),
                req.getEditedParentSummary(),
                req.getEditedPerformanceLevel());
        return ResponseEntity.ok(updated);
    }

    /**
     * Approve an individual student analysis.
     * POST /api/ai/analysis/{analysisId}/approve
     */
    @PostMapping("/analysis/{analysisId}/approve")
    public ResponseEntity<StudentAnalysisResponseDto> approveAnalysis(@PathVariable Long analysisId) {
        return ResponseEntity.ok(aiAnalysisService.approveAnalysis(analysisId));
    }

    /**
     * Approve all student analyses for a given exam in one click.
     * POST /api/ai/exams/{examId}/approve-all
     */
    @PostMapping("/exams/{examId}/approve-all")
    public ResponseEntity<Map<String, String>> approveAll(@PathVariable Long examId) {
        aiAnalysisService.approveAllForExam(examId);
        return ResponseEntity.ok(Map.of("message", "All analyses approved for exam " + examId));
    }

    /**
     * Generate and download a PDF report for a single student analysis.
     * GET /api/ai/analysis/{analysisId}/report
     */
    @GetMapping("/analysis/{analysisId}/report")
    public ResponseEntity<byte[]> generateStudentReport(@PathVariable Long analysisId) {
        byte[] pdf = aiAnalysisService.generateStudentReportPdf(analysisId);
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);
        headers.setContentDispositionFormData("attachment", "student_report_" + analysisId + ".pdf");
        return ResponseEntity.ok().headers(headers).body(pdf);
    }

    /**
     * Generate and download a combined class PDF report for all approved students in an exam.
     * GET /api/ai/exams/{examId}/report
     */
    @GetMapping("/exams/{examId}/report")
    public ResponseEntity<byte[]> generateClassReport(@PathVariable Long examId) {
        byte[] pdf = aiAnalysisService.generateClassReportPdf(examId);
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);
        headers.setContentDispositionFormData("attachment", "class_report_exam_" + examId + ".pdf");
        return ResponseEntity.ok().headers(headers).body(pdf);
    }
}
