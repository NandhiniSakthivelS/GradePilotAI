package com.gradepilot.controller;

import com.gradepilot.dto.BulkEmailResponseDto;
import com.gradepilot.dto.EmailHistoryResponseDto;
import com.gradepilot.service.EmailService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/email")
@RequiredArgsConstructor
public class EmailController {

    private final EmailService emailService;

    @PostMapping("/send/{analysisId}")
    public ResponseEntity<?> sendParentEmail(@PathVariable Long analysisId) {
        try {
            EmailHistoryResponseDto response = emailService.sendParentEmail(analysisId);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/resend/{historyId}")
    public ResponseEntity<?> resendEmail(@PathVariable Long historyId) {
        try {
            EmailHistoryResponseDto response = emailService.resendEmail(historyId);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/history")
    public ResponseEntity<?> getEmailHistory() {
        try {
            List<EmailHistoryResponseDto> history = emailService.getEmailHistory();
            return ResponseEntity.ok(history);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Sends academic report PDFs to ALL parents for the given exam in one action.
     * All student reports must be approved before any email is dispatched.
     * POST /api/email/send-bulk/{examId}
     */
    @PostMapping("/send-bulk/{examId}")
    public ResponseEntity<?> sendBulkParentEmails(@PathVariable Long examId) {
        try {
            BulkEmailResponseDto response = emailService.sendBulkParentEmails(examId);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
