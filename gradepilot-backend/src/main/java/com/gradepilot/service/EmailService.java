package com.gradepilot.service;

import com.gradepilot.dto.BulkEmailResponseDto;
import com.gradepilot.dto.EmailHistoryResponseDto;
import com.gradepilot.entity.*;
import com.gradepilot.exception.BadRequestException;
import com.gradepilot.exception.ResourceNotFoundException;
import com.gradepilot.repository.EmailHistoryRepository;
import com.gradepilot.repository.ExamRepository;
import com.gradepilot.repository.StudentAnalysisRepository;
import com.gradepilot.repository.StudentRepository;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class EmailService {

    private static final Logger log = LoggerFactory.getLogger(EmailService.class);

    private final JavaMailSender mailSender;
    private final EmailHistoryRepository emailHistoryRepository;
    private final StudentRepository studentRepository;
    private final ExamRepository examRepository;
    private final StudentAnalysisRepository studentAnalysisRepository;
    private final AiAnalysisService aiAnalysisService;

    /**
     * Sends the generated academic report PDF to a student's parent.
     */
    @Transactional
    public EmailHistoryResponseDto sendParentEmail(Long analysisId) {
        ClassAdvisor advisor = aiAnalysisService.getCurrentAdvisor();

        // 1. Fetch analysis details
        StudentAnalysis analysis = studentAnalysisRepository.findById(analysisId)
                .orElseThrow(() -> new ResourceNotFoundException("Student Analysis not found: " + analysisId));

        // 2. Fetch student and exam details
        Student student = studentRepository.findById(analysis.getStudentId())
                .orElseThrow(() -> new ResourceNotFoundException("Student not found: " + analysis.getStudentId()));

        Exam exam = examRepository.findById(analysis.getExamId())
                .orElseThrow(() -> new ResourceNotFoundException("Exam not found: " + analysis.getExamId()));

        // 3. Security Check: advisor can only email reports of their own class/students
        if (!student.getClassAdvisor().getId().equals(advisor.getId())) {
            throw new BadRequestException("Access denied: This student does not belong to your class.");
        }

        // 3a. Approval Check: only allow sending email for approved reports
        if (!Boolean.TRUE.equals(analysis.getIsApproved())) {
            throw new BadRequestException("Cannot send email: The academic report for " + student.getStudentName() + " has not been approved yet. Please approve the report before sending it to the parent.");
        }

        // 4. Retrieve already generated PDF report (reusing existing data, no Gemini call)
        byte[] pdfBytes = aiAnalysisService.generateStudentReportPdf(analysisId);

        String parentEmail = student.getParentEmail();
        if (parentEmail == null || parentEmail.trim().isEmpty()) {
            throw new BadRequestException("Parent email is not configured for student: " + student.getStudentName());
        }

        // 5. Compose and Send Email
        String subject = "Academic Performance Report - " + exam.getExamName();
        String body = composeEmailBody(exam.getExamName());

        String deliveryStatus = "SUCCESS";
        String failureReason = null;

        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setTo(parentEmail);
            helper.setSubject(subject);
            helper.setText(body, false); // plain text body

            // Attach PDF
            String attachmentName = "Academic_Report_" + student.getStudentName().replace(" ", "_") + ".pdf";
            helper.addAttachment(attachmentName, new ByteArrayResource(pdfBytes));

            mailSender.send(message);
            log.info("Successfully sent academic report email to {} for student {}", parentEmail, student.getStudentName());
        } catch (Exception e) {
            log.error("Failed to send academic report email to {} for student {}: {}", parentEmail, student.getStudentName(), e.getMessage(), e);
            deliveryStatus = "FAILURE";
            failureReason = e.getMessage();
            if (failureReason != null && failureReason.length() > 255) {
                failureReason = failureReason.substring(0, 255);
            }
        }

        // 6. Store Email History
        EmailHistory history = EmailHistory.builder()
                .student(student)
                .exam(exam)
                .report(analysis)
                .advisor(advisor)
                .recipientEmail(parentEmail)
                .sentAt(LocalDateTime.now())
                .deliveryStatus(deliveryStatus)
                .failureReason(failureReason)
                .build();

        emailHistoryRepository.save(history);

        if ("FAILURE".equals(deliveryStatus)) {
            throw new RuntimeException("Failed to send email: " + (failureReason != null ? failureReason : "SMTP configuration error"));
        }

        return mapToDto(history);
    }

    /**
     * Resends a report from a prior email history log.
     */
    @Transactional
    public EmailHistoryResponseDto resendEmail(Long historyId) {
        ClassAdvisor advisor = aiAnalysisService.getCurrentAdvisor();

        // 1. Fetch historical record
        EmailHistory previousHistory = emailHistoryRepository.findById(historyId)
                .orElseThrow(() -> new ResourceNotFoundException("Email History not found: " + historyId));

        // 2. Security Check
        if (!previousHistory.getAdvisor().getId().equals(advisor.getId())) {
            throw new BadRequestException("Access denied: You do not have permission to resend this report.");
        }

        // 3. Generate PDF and send again (reusing report metadata)
        Long analysisId = previousHistory.getReport().getId();
        byte[] pdfBytes = aiAnalysisService.generateStudentReportPdf(analysisId);

        Student student = previousHistory.getStudent();
        Exam exam = previousHistory.getExam();
        String parentEmail = student.getParentEmail();

        String subject = "Academic Performance Report - " + exam.getExamName();
        String body = composeEmailBody(exam.getExamName());

        String deliveryStatus = "SUCCESS";
        String failureReason = null;

        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setTo(parentEmail);
            helper.setSubject(subject);
            helper.setText(body, false);

            String attachmentName = "Academic_Report_" + student.getStudentName().replace(" ", "_") + ".pdf";
            helper.addAttachment(attachmentName, new ByteArrayResource(pdfBytes));

            mailSender.send(message);
            log.info("Successfully resent academic report email to {} for student {}", parentEmail, student.getStudentName());
        } catch (Exception e) {
            log.error("Failed to resend academic report email to {} for student {}: {}", parentEmail, student.getStudentName(), e.getMessage(), e);
            deliveryStatus = "FAILURE";
            failureReason = e.getMessage();
            if (failureReason != null && failureReason.length() > 255) {
                failureReason = failureReason.substring(0, 255);
            }
        }

        // 4. Create a NEW Email History record
        EmailHistory newHistory = EmailHistory.builder()
                .student(student)
                .exam(exam)
                .report(previousHistory.getReport())
                .advisor(advisor)
                .recipientEmail(parentEmail)
                .sentAt(LocalDateTime.now())
                .deliveryStatus(deliveryStatus)
                .failureReason(failureReason)
                .build();

        emailHistoryRepository.save(newHistory);

        if ("FAILURE".equals(deliveryStatus)) {
            throw new RuntimeException("Failed to resend email: " + (failureReason != null ? failureReason : "SMTP configuration error"));
        }

        return mapToDto(newHistory);
    }

    /**
     * Retrieves all parent email communication logs for the authenticated advisor.
     */
    @Transactional(readOnly = true)
    public List<EmailHistoryResponseDto> getEmailHistory() {
        ClassAdvisor advisor = aiAnalysisService.getCurrentAdvisor();
        return emailHistoryRepository.findAllByAdvisorIdOrderBySentAtDesc(advisor.getId())
                .stream()
                .map(this::mapToDto)
                .collect(Collectors.toList());
    }

    /**
     * Sends academic report PDFs to ALL parents for a given exam.
     * Every student's report must be approved before any email is dispatched.
     * One EmailHistory record is created per student regardless of success/failure.
     */
    @Transactional
    public BulkEmailResponseDto sendBulkParentEmails(Long examId) {
        ClassAdvisor advisor = aiAnalysisService.getCurrentAdvisor();

        // 1. Verify advisor owns this exam
        Exam exam = examRepository.findByIdAndClassAdvisorId(examId, advisor.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Exam not found or access denied: " + examId));

        // 2. Load all analysis records for this exam
        List<StudentAnalysis> analysisList = studentAnalysisRepository.findByExamId(examId);
        if (analysisList.isEmpty()) {
            throw new BadRequestException("No AI analysis records found for this exam. Run AI Analysis first.");
        }

        // 3. Guard: all students must be approved
        long pendingCount = analysisList.stream()
                .filter(a -> !Boolean.TRUE.equals(a.getIsApproved()))
                .count();
        if (pendingCount > 0) {
            throw new BadRequestException(
                    "Cannot send emails: " + pendingCount + " student report(s) are still pending approval. "
                    + "Please approve all reports before sending parent emails.");
        }

        // 4. Send one email per student, track results individually
        List<BulkEmailResponseDto.BulkEmailResultItem> results = new ArrayList<>();
        int successCount = 0;
        int failureCount = 0;
        LocalDateTime now = LocalDateTime.now();

        for (StudentAnalysis analysis : analysisList) {
            Student student = studentRepository.findById(analysis.getStudentId()).orElse(null);
            if (student == null) {
                results.add(BulkEmailResponseDto.BulkEmailResultItem.builder()
                        .studentId(analysis.getStudentId())
                        .studentName("Unknown")
                        .registerNo("N/A")
                        .parentEmail("N/A")
                        .status("FAILURE")
                        .failureReason("Student record not found for ID: " + analysis.getStudentId())
                        .build());
                failureCount++;
                continue;
            }

            // Security: only email students belonging to this advisor
            if (!student.getClassAdvisor().getId().equals(advisor.getId())) {
                results.add(BulkEmailResponseDto.BulkEmailResultItem.builder()
                        .studentId(student.getId())
                        .studentName(student.getStudentName())
                        .registerNo(student.getRegisterNo())
                        .parentEmail(student.getParentEmail())
                        .status("FAILURE")
                        .failureReason("Access denied: student does not belong to your class.")
                        .build());
                failureCount++;
                continue;
            }

            String parentEmail = student.getParentEmail();
            if (parentEmail == null || parentEmail.trim().isEmpty()) {
                results.add(BulkEmailResponseDto.BulkEmailResultItem.builder()
                        .studentId(student.getId())
                        .studentName(student.getStudentName())
                        .registerNo(student.getRegisterNo())
                        .parentEmail("—")
                        .status("FAILURE")
                        .failureReason("Parent email is not configured for this student.")
                        .build());
                failureCount++;
                continue;
            }

            // Generate PDF from existing data — no Gemini call
            String deliveryStatus = "SUCCESS";
            String failureReason = null;

            try {
                byte[] pdfBytes = aiAnalysisService.generateStudentReportPdf(analysis.getId());
                String subject = "Academic Performance Report - " + exam.getExamName();
                String body = composeEmailBody(exam.getExamName());

                MimeMessage message = mailSender.createMimeMessage();
                MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
                helper.setTo(parentEmail);
                helper.setSubject(subject);
                helper.setText(body, false);
                String attachmentName = "Academic_Report_" + student.getStudentName().replace(" ", "_") + ".pdf";
                helper.addAttachment(attachmentName, new ByteArrayResource(pdfBytes));
                mailSender.send(message);
                log.info("[Bulk] Sent report to {} for student {}", parentEmail, student.getStudentName());
            } catch (Exception e) {
                log.error("[Bulk] Failed to send report to {} for student {}: {}",
                        parentEmail, student.getStudentName(), e.getMessage(), e);
                deliveryStatus = "FAILURE";
                failureReason = e.getMessage();
                if (failureReason != null && failureReason.length() > 255) {
                    failureReason = failureReason.substring(0, 255);
                }
            }

            // Save individual EmailHistory row
            EmailHistory history = EmailHistory.builder()
                    .student(student)
                    .exam(exam)
                    .report(analysis)
                    .advisor(advisor)
                    .recipientEmail(parentEmail)
                    .sentAt(now)
                    .deliveryStatus(deliveryStatus)
                    .failureReason(failureReason)
                    .build();
            emailHistoryRepository.save(history);

            if ("SUCCESS".equals(deliveryStatus)) {
                successCount++;
            } else {
                failureCount++;
            }

            results.add(BulkEmailResponseDto.BulkEmailResultItem.builder()
                    .studentId(student.getId())
                    .studentName(student.getStudentName())
                    .registerNo(student.getRegisterNo())
                    .parentEmail(parentEmail)
                    .status(deliveryStatus)
                    .failureReason(failureReason)
                    .build());
        }

        return BulkEmailResponseDto.builder()
                .examId(examId)
                .examName(exam.getExamName())
                .totalStudents(analysisList.size())
                .successCount(successCount)
                .failureCount(failureCount)
                .results(results)
                .build();
    }

    private String composeEmailBody(String examName) {
        return "Dear Parent,\n\n" +
                "Greetings from V.S.B. Engineering College.\n\n" +
                "Please find attached the Academic Performance Report of your ward.\n\n" +
                "The attached report contains:\n" +
                "• Subject-wise Marks\n" +
                "• Overall Percentage\n" +
                "• AI Performance Analysis\n" +
                "• Strong Subjects\n" +
                "• Weak Subjects\n" +
                "• Improvement Suggestions\n" +
                "• Parent Academic Summary\n\n" +
                "If you have any questions regarding your ward's academic performance, please contact the Class Advisor.\n\n" +
                "Regards,\n" +
                "Class Advisor\n" +
                "V.S.B. Engineering College\n" +
                "Generated by GradePilot AI";
    }

    private EmailHistoryResponseDto mapToDto(EmailHistory h) {
        return EmailHistoryResponseDto.builder()
                .id(h.getId())
                .studentId(h.getStudent().getId())
                .studentName(h.getStudent().getStudentName())
                .registerNo(h.getStudent().getRegisterNo())
                .parentEmail(h.getRecipientEmail())
                .examId(h.getExam().getId())
                .examName(h.getExam().getExamName())
                .reportId(h.getReport().getId())
                .sentAt(h.getSentAt())
                .deliveryStatus(h.getDeliveryStatus())
                .failureReason(h.getFailureReason())
                .build();
    }
}
