package com.gradepilot.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.gradepilot.dto.StudentAnalysisResponseDto;
import com.gradepilot.entity.ClassAdvisor;
import com.gradepilot.entity.Exam;
import com.gradepilot.entity.Student;
import com.gradepilot.entity.StudentAnalysis;
import com.gradepilot.entity.StudentMark;
import com.gradepilot.exception.ResourceNotFoundException;
import com.gradepilot.repository.ClassAdvisorRepository;
import com.gradepilot.repository.ExamRepository;
import com.gradepilot.repository.StudentAnalysisRepository;
import com.gradepilot.repository.StudentMarkRepository;
import com.gradepilot.repository.StudentRepository;
import com.itextpdf.io.font.constants.StandardFonts;
import com.itextpdf.kernel.colors.ColorConstants;
import com.itextpdf.kernel.colors.DeviceRgb;
import com.itextpdf.kernel.font.PdfFont;
import com.itextpdf.kernel.font.PdfFontFactory;
import com.itextpdf.kernel.pdf.PdfDocument;
import com.itextpdf.kernel.pdf.PdfWriter;
import com.itextpdf.layout.Document;
import com.itextpdf.layout.borders.Border;
import com.itextpdf.layout.element.Cell;
import com.itextpdf.layout.element.Paragraph;
import com.itextpdf.layout.element.Table;
import com.itextpdf.layout.properties.HorizontalAlignment;
import com.itextpdf.layout.properties.TextAlignment;
import com.itextpdf.layout.properties.UnitValue;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AiAnalysisService {

    private final ExamRepository examRepository;
    private final StudentRepository studentRepository;
    private final StudentMarkRepository studentMarkRepository;
    private final StudentAnalysisRepository studentAnalysisRepository;
    private final ClassAdvisorRepository classAdvisorRepository;
    private final GeminiService geminiService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public ClassAdvisor getCurrentAdvisor() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return classAdvisorRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("Class Advisor not found with email: " + email));
    }

    @Transactional
    public List<StudentAnalysisResponseDto> performAiAnalysis(Long examId) {
        ClassAdvisor advisor = getCurrentAdvisor();

        // 1. Verify exam ownership
        Exam exam = examRepository.findByIdAndClassAdvisorId(examId, advisor.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Exam not found with ID: " + examId));

        // 2. Load all students under this advisor
        List<Student> students = studentRepository.findAllByClassAdvisorId(advisor.getId());
        if (students.isEmpty()) {
            throw new RuntimeException("No students registered for this class. Add students before analyzing.");
        }

        // 3. Load all student marks for this exam
        List<StudentMark> marksList = studentMarkRepository.findByExamId(examId);

        // Map register number -> Subject Name -> Mark
        Map<String, Map<String, Double>> marksMap = new HashMap<>();
        for (StudentMark mark : marksList) {
            String regNo = mark.getRegisterNo().toLowerCase();
            marksMap.putIfAbsent(regNo, new HashMap<>());
            marksMap.get(regNo).put(mark.getSubjectName().toLowerCase(), mark.getMarks());
        }

        // 4. Perform deterministic mathematical calculations on the backend (Java)
        List<Map<String, Object>> calculatedStudentsList = new ArrayList<>();
        Map<String, Double> studentPercentages = new HashMap<>();

        for (Student student : students) {
            String regNoKey = student.getRegisterNo().toLowerCase();
            Map<String, Double> studentMarks = marksMap.getOrDefault(regNoKey, new HashMap<>());

            double totalMarks = 0.0;
            int subjectsCount = exam.getSubjectNames().size();
            Map<String, Double> subjectPercentages = new HashMap<>();

            for (String subject : exam.getSubjectNames()) {
                Double mark = studentMarks.get(subject.toLowerCase());
                double score = (mark != null) ? mark : 0.0;
                totalMarks += score;
                // Subject percentage (since max marks per subject is 100)
                subjectPercentages.put(subject, score);
            }

            double overallPercentage = (subjectsCount > 0) ? (totalMarks / subjectsCount) : 0.0;
            studentPercentages.put(student.getRegisterNo(), overallPercentage);

            // Structure data for Gemini Prompt
            Map<String, Object> details = new HashMap<>();
            details.put("registerNo", student.getRegisterNo());
            details.put("studentName", student.getStudentName());
            details.put("totalMarks", totalMarks);
            details.put("overallPercentage", String.format("%.2f", overallPercentage) + "%");
            details.put("subjectMarks", subjectPercentages);

            calculatedStudentsList.add(details);
        }

        // 5. Construct prompt instructing Gemini to only perform qualitative analysis
        String studentsJsonInput;
        try {
            studentsJsonInput = objectMapper.writeValueAsString(calculatedStudentsList);
        } catch (Exception e) {
            throw new RuntimeException("Failed to serialize student data for prompt", e);
        }

        String prompt = "You are GradePilot AI, an expert academic analysis assistant.\n" +
                "Evaluate the performance of this class based on their scores. Do not calculate percentages, total marks, or averages (these are already pre-calculated by Java on the backend).\n" +
                "Generate ONLY qualitative insights for each student. Avoid markdown backticks, prefixing, or code blocks.\n\n" +
                "Exam: " + exam.getExamName() + "\n" +
                "Subjects list: " + String.join(", ", exam.getSubjectNames()) + "\n\n" +
                "Class Performance Data:\n" +
                studentsJsonInput + "\n\n" +
                "Return a strict JSON array of objects matching this schema precisely:\n" +
                "[\n" +
                "  {\n" +
                "    \"registerNo\": \"(matching the registration number from inputs)\",\n" +
                "    \"strongSubjects\": \"(comma separated list of subjects where marks >= 80. If none, write 'None')\",\n" +
                "    \"weakSubjects\": \"(comma separated list of subjects where marks < 50. If none, write 'None')\",\n" +
                "    \"performanceLevel\": \"(Excellent [>=85] / Very Good [75-84] / Good [50-74] / Needs Improvement [<50] matching the overallPercentage)\",\n" +
                "    \"suggestions\": \"(1-2 specific suggestions for performance enhancement)\",\n" +
                "    \"parentSummary\": \"(A supportive, parent-friendly summary: e.g., 'Your ward Arun Kumar has secured 87% in Internal Assessment-I. He has performed exceptionally well in Python and Operating Systems, while additional attention is recommended in TOC. Overall performance is excellent and encouraging.')\"\n" +
                "  }\n" +
                "]";

        // 6. Invoke Gemini Service
        String rawResponse = geminiService.generateContent(prompt);

        // 7. Parse the qualitative analysis array
        List<QualitativeAnalysisNode> rawAnalysisList;
        try {
            rawAnalysisList = objectMapper.readValue(rawResponse, new TypeReference<List<QualitativeAnalysisNode>>() {});
        } catch (Exception e) {
            throw new RuntimeException("Failed to parse AI analysis json: " + e.getMessage() + "\nRaw response was:\n" + rawResponse, e);
        }

        Map<String, QualitativeAnalysisNode> analysisMap = rawAnalysisList.stream()
                .collect(Collectors.toMap(
                        node -> node.getRegisterNo().toLowerCase().trim(),
                        node -> node,
                        (existing, replacement) -> existing
                ));

        List<StudentAnalysisResponseDto> dtos = new ArrayList<>();

        // 8. Save/Overwrite results in database and construct DTOs
        for (Student student : students) {
            String regKey = student.getRegisterNo().toLowerCase().trim();
            QualitativeAnalysisNode aiResult = analysisMap.get(regKey);

            String strong = (aiResult != null) ? aiResult.getStrongSubjects() : "None";
            String weak = (aiResult != null) ? aiResult.getWeakSubjects() : "None";
            String perfLevel = (aiResult != null) ? aiResult.getPerformanceLevel() : "Good";
            String sugg = (aiResult != null) ? aiResult.getSuggestions() : "Continue steady preparation.";
            String summary = (aiResult != null) ? aiResult.getParentSummary() : "Student has completed the test.";

            Double computedPercentage = studentPercentages.get(student.getRegisterNo());
            if (computedPercentage == null) computedPercentage = 0.0;

            // Check if record exists
            StudentAnalysis analysis = studentAnalysisRepository
                    .findByStudentIdAndExamId(student.getId(), examId)
                    .orElse(new StudentAnalysis());

            analysis.setStudentId(student.getId());
            analysis.setExamId(examId);
            analysis.setOverallPercentage(computedPercentage);
            analysis.setStrongSubjects(strong);
            analysis.setWeakSubjects(weak);
            analysis.setPerformanceLevel(perfLevel);
            analysis.setSuggestions(sugg);
            analysis.setParentSummary(summary);
            analysis.setCreatedAt(LocalDateTime.now());

            studentAnalysisRepository.save(analysis);

            dtos.add(StudentAnalysisResponseDto.builder()
                    .id(analysis.getId())
                    .studentId(student.getId())
                    .studentName(student.getStudentName())
                    .registerNo(student.getRegisterNo())
                    .examId(examId)
                    .overallPercentage(computedPercentage)
                    .strongSubjects(strong)
                    .weakSubjects(weak)
                    .performanceLevel(perfLevel)
                    .suggestions(sugg)
                    .parentSummary(summary)
                    .parentName(student.getParentName())
                    .parentEmail(student.getParentEmail())
                    .createdAt(analysis.getCreatedAt())
                    .editedSuggestions(analysis.getEditedSuggestions())
                    .editedParentSummary(analysis.getEditedParentSummary())
                    .editedPerformanceLevel(analysis.getEditedPerformanceLevel())
                    .isApproved(analysis.getIsApproved())
                    .approvedBy(analysis.getApprovedBy())
                    .approvedAt(analysis.getApprovedAt())
                    .build());
        }

        return dtos;
    }

    public List<StudentAnalysisResponseDto> getExistingAnalysis(Long examId) {
        ClassAdvisor advisor = getCurrentAdvisor();

        // Verify exam ownership
        Exam exam = examRepository.findByIdAndClassAdvisorId(examId, advisor.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Exam not found with ID: " + examId));

        List<Student> students = studentRepository.findAllByClassAdvisorId(advisor.getId());
        Map<Long, Student> studentMap = students.stream()
                .collect(Collectors.toMap(Student::getId, s -> s));

        List<StudentAnalysis> analysisList = studentAnalysisRepository.findByExamId(examId);

        return analysisList.stream()
                .filter(a -> studentMap.containsKey(a.getStudentId()))
                .map(a -> {
                    Student s = studentMap.get(a.getStudentId());
                    return StudentAnalysisResponseDto.builder()
                            .id(a.getId())
                            .studentId(s.getId())
                            .studentName(s.getStudentName())
                            .registerNo(s.getRegisterNo())
                            .examId(examId)
                            .overallPercentage(a.getOverallPercentage())
                            .strongSubjects(a.getStrongSubjects())
                            .weakSubjects(a.getWeakSubjects())
                            .performanceLevel(a.getPerformanceLevel())
                            .suggestions(a.getSuggestions())
                            .parentSummary(a.getParentSummary())
                            .parentName(s.getParentName())
                            .parentEmail(s.getParentEmail())
                            .createdAt(a.getCreatedAt())
                            .editedSuggestions(a.getEditedSuggestions())
                            .editedParentSummary(a.getEditedParentSummary())
                            .editedPerformanceLevel(a.getEditedPerformanceLevel())
                            .isApproved(a.getIsApproved())
                            .approvedBy(a.getApprovedBy())
                            .approvedAt(a.getApprovedAt())
                            .build();
                }).toList();
    }

    @Transactional
    public StudentAnalysisResponseDto updateReview(Long analysisId, String editedSuggestions,
                                                    String editedParentSummary, String editedPerformanceLevel) {
        ClassAdvisor advisor = getCurrentAdvisor();
        StudentAnalysis analysis = studentAnalysisRepository.findById(analysisId)
                .orElseThrow(() -> new ResourceNotFoundException("Analysis record not found: " + analysisId));

        // Verify advisor owns the exam
        examRepository.findByIdAndClassAdvisorId(analysis.getExamId(), advisor.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Access denied to analysis: " + analysisId));

        if (editedSuggestions != null) analysis.setEditedSuggestions(editedSuggestions);
        if (editedParentSummary != null) analysis.setEditedParentSummary(editedParentSummary);
        if (editedPerformanceLevel != null) analysis.setEditedPerformanceLevel(editedPerformanceLevel);
        // Reset approval when content is edited
        analysis.setIsApproved(false);
        analysis.setApprovedBy(null);
        analysis.setApprovedAt(null);

        studentAnalysisRepository.save(analysis);

        Student s = studentRepository.findById(analysis.getStudentId())
                .orElseThrow(() -> new ResourceNotFoundException("Student not found"));

        return buildDto(analysis, s);
    }

    @Transactional
    public StudentAnalysisResponseDto approveAnalysis(Long analysisId) {
        ClassAdvisor advisor = getCurrentAdvisor();
        StudentAnalysis analysis = studentAnalysisRepository.findById(analysisId)
                .orElseThrow(() -> new ResourceNotFoundException("Analysis record not found: " + analysisId));

        examRepository.findByIdAndClassAdvisorId(analysis.getExamId(), advisor.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Access denied to analysis: " + analysisId));

        analysis.setIsApproved(true);
        analysis.setApprovedBy(advisor.getAdvisorName());
        analysis.setApprovedAt(LocalDateTime.now());
        studentAnalysisRepository.save(analysis);

        Student s = studentRepository.findById(analysis.getStudentId())
                .orElseThrow(() -> new ResourceNotFoundException("Student not found"));

        return buildDto(analysis, s);
    }

    @Transactional
    public void approveAllForExam(Long examId) {
        ClassAdvisor advisor = getCurrentAdvisor();
        examRepository.findByIdAndClassAdvisorId(examId, advisor.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Exam not found or access denied: " + examId));

        List<StudentAnalysis> analysisList = studentAnalysisRepository.findByExamId(examId);
        LocalDateTime now = LocalDateTime.now();
        for (StudentAnalysis a : analysisList) {
            a.setIsApproved(true);
            a.setApprovedBy(advisor.getAdvisorName());
            a.setApprovedAt(now);
        }
        studentAnalysisRepository.saveAll(analysisList);
    }

    private StudentAnalysisResponseDto buildDto(StudentAnalysis a, Student s) {
        return StudentAnalysisResponseDto.builder()
                .id(a.getId())
                .studentId(s.getId())
                .studentName(s.getStudentName())
                .registerNo(s.getRegisterNo())
                .examId(a.getExamId())
                .overallPercentage(a.getOverallPercentage())
                .strongSubjects(a.getStrongSubjects())
                .weakSubjects(a.getWeakSubjects())
                .performanceLevel(a.getPerformanceLevel())
                .suggestions(a.getSuggestions())
                .parentSummary(a.getParentSummary())
                .parentName(s.getParentName())
                .parentEmail(s.getParentEmail())
                .createdAt(a.getCreatedAt())
                .editedSuggestions(a.getEditedSuggestions())
                .editedParentSummary(a.getEditedParentSummary())
                .editedPerformanceLevel(a.getEditedPerformanceLevel())
                .isApproved(a.getIsApproved())
                .approvedBy(a.getApprovedBy())
                .approvedAt(a.getApprovedAt())
                .build();
    }

    // ── Phase 4: PDF Report Generation ──────────────────────────────────────

    /**
     * Generates a single-student academic PDF report.
     */
    public byte[] generateStudentReportPdf(Long analysisId) {
        ClassAdvisor advisor = getCurrentAdvisor();
        StudentAnalysis analysis = studentAnalysisRepository.findById(analysisId)
                .orElseThrow(() -> new ResourceNotFoundException("Analysis not found: " + analysisId));
        examRepository.findByIdAndClassAdvisorId(analysis.getExamId(), advisor.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Access denied"));
        Exam exam = examRepository.findById(analysis.getExamId()).orElseThrow();
        Student student = studentRepository.findById(analysis.getStudentId()).orElseThrow();

        return buildSingleStudentPdf(analysis, student, exam, advisor);
    }

    /**
     * Generates a class-wide PDF report combining all approved student analyses.
     */
    public byte[] generateClassReportPdf(Long examId) {
        ClassAdvisor advisor = getCurrentAdvisor();
        examRepository.findByIdAndClassAdvisorId(examId, advisor.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Exam not found or access denied: " + examId));
        Exam exam = examRepository.findById(examId).orElseThrow();

        List<StudentAnalysis> analysisList = studentAnalysisRepository.findByExamId(examId);
        Map<Long, Student> studentMap = studentRepository.findAllByClassAdvisorId(advisor.getId())
                .stream().collect(Collectors.toMap(Student::getId, s -> s));

        return buildClassReportPdf(analysisList, studentMap, exam, advisor);
    }

    // ── PDF Builder Helpers ──────────────────────────────────────────────────

    private byte[] buildSingleStudentPdf(StudentAnalysis a, Student student, Exam exam, ClassAdvisor advisor) {
        try (ByteArrayOutputStream baos = new ByteArrayOutputStream()) {
            PdfDocument pdf = new PdfDocument(new PdfWriter(baos));
            Document doc = new Document(pdf);
            PdfFont bold = PdfFontFactory.createFont(StandardFonts.HELVETICA_BOLD);
            PdfFont regular = PdfFontFactory.createFont(StandardFonts.HELVETICA);
            DeviceRgb primaryColor = new DeviceRgb(30, 64, 175);   // Deep blue
            DeviceRgb accentColor = new DeviceRgb(16, 185, 129);   // Emerald
            DeviceRgb bgGray = new DeviceRgb(248, 250, 252);

            // Header Banner
            Table headerTable = new Table(UnitValue.createPercentArray(new float[]{1})).useAllAvailableWidth();
            Cell headerCell = new Cell()
                    .setBackgroundColor(primaryColor)
                    .setPadding(14)
                    .setBorder(Border.NO_BORDER);
            headerCell.add(new Paragraph("GradePilot AI")
                    .setFont(bold).setFontSize(20).setFontColor(ColorConstants.WHITE));
            headerCell.add(new Paragraph("Academic Performance Report")
                    .setFont(regular).setFontSize(12).setFontColor(new DeviceRgb(199, 210, 254)));
            headerTable.addCell(headerCell);
            doc.add(headerTable);
            doc.add(new Paragraph(" ").setMarginBottom(6));

            // Advisor & Exam Info
            addInfoRow(doc, bold, regular, "Class Advisor", advisor.getAdvisorName());
            addInfoRow(doc, bold, regular, "Department", advisor.getDepartment() + " – Section " + advisor.getSection());
            addInfoRow(doc, bold, regular, "Academic Year", advisor.getAcademicYear());
            addInfoRow(doc, bold, regular, "Exam", exam.getExamName());
            addInfoRow(doc, bold, regular, "Generated On", LocalDateTime.now().format(DateTimeFormatter.ofPattern("dd-MM-yyyy HH:mm")));
            doc.add(new Paragraph(" ").setMarginBottom(4));

            // Student Info Section
            addSectionHeader(doc, bold, primaryColor, "Student Information");
            addInfoRow(doc, bold, regular, "Name", student.getStudentName());
            addInfoRow(doc, bold, regular, "Register No.", student.getRegisterNo());
            addInfoRow(doc, bold, regular, "Overall Percentage", String.format("%.2f%%", a.getOverallPercentage()));

            String perfLevel = (a.getEditedPerformanceLevel() != null) ? a.getEditedPerformanceLevel() : a.getPerformanceLevel();
            addInfoRow(doc, bold, regular, "Performance Level", perfLevel != null ? perfLevel : "-");
            doc.add(new Paragraph(" ").setMarginBottom(4));

            // Subject-Wise Highlights
            addSectionHeader(doc, bold, primaryColor, "Subject-Wise Highlights");
            addInfoRow(doc, bold, regular, "\u2728 Strong Subjects", a.getStrongSubjects() != null ? a.getStrongSubjects() : "None");
            addInfoRow(doc, bold, regular, "\u26A0 Weak Subjects", a.getWeakSubjects() != null ? a.getWeakSubjects() : "None");
            doc.add(new Paragraph(" ").setMarginBottom(4));

            // AI Suggestions
            addSectionHeader(doc, bold, accentColor, "\uD83E\uDD16 AI Suggestions");
            String suggestions = (a.getEditedSuggestions() != null && !a.getEditedSuggestions().isBlank())
                    ? a.getEditedSuggestions() : a.getSuggestions();
            doc.add(new Paragraph(suggestions != null ? suggestions : "-")
                    .setFont(regular).setFontSize(11).setMarginLeft(10).setMarginBottom(8));

            // Parent Summary
            addSectionHeader(doc, bold, accentColor, "\uD83D\uDC68\u200D\uD83D\uDC69\u200D\uD83D\uDC67 Parent Communication Summary");
            String parentSummary = (a.getEditedParentSummary() != null && !a.getEditedParentSummary().isBlank())
                    ? a.getEditedParentSummary() : a.getParentSummary();
            Table summaryBox = new Table(UnitValue.createPercentArray(new float[]{1})).useAllAvailableWidth();
            Cell summaryCell = new Cell().setBackgroundColor(bgGray).setPadding(10).setBorder(Border.NO_BORDER);
            summaryCell.add(new Paragraph(parentSummary != null ? parentSummary : "-")
                    .setFont(regular).setFontSize(11).setItalic());
            summaryBox.addCell(summaryCell);
            doc.add(summaryBox);
            doc.add(new Paragraph(" ").setMarginBottom(8));

            // Approval Status
            if (Boolean.TRUE.equals(a.getIsApproved())) {
                addSectionHeader(doc, bold, new DeviceRgb(21, 128, 61), "\u2705 Report Approved");
                addInfoRow(doc, bold, regular, "Approved By", a.getApprovedBy());
                if (a.getApprovedAt() != null) {
                    addInfoRow(doc, bold, regular, "Approved On", a.getApprovedAt().format(DateTimeFormatter.ofPattern("dd-MM-yyyy HH:mm")));
                }
            }

            // Footer
            doc.add(new Paragraph(" "));
            doc.add(new Paragraph("This report is generated by GradePilot AI and reviewed by the Class Advisor. | Confidential")
                    .setFont(regular).setFontSize(8).setFontColor(new DeviceRgb(148, 163, 184))
                    .setTextAlignment(TextAlignment.CENTER));

            doc.close();
            return baos.toByteArray();
        } catch (IOException e) {
            throw new RuntimeException("Failed to generate PDF report", e);
        }
    }

    private byte[] buildClassReportPdf(List<StudentAnalysis> analysisList, Map<Long, Student> studentMap,
                                        Exam exam, ClassAdvisor advisor) {
        try (ByteArrayOutputStream baos = new ByteArrayOutputStream()) {
            PdfDocument pdf = new PdfDocument(new PdfWriter(baos));
            Document doc = new Document(pdf);
            PdfFont bold = PdfFontFactory.createFont(StandardFonts.HELVETICA_BOLD);
            PdfFont regular = PdfFontFactory.createFont(StandardFonts.HELVETICA);
            DeviceRgb primaryColor = new DeviceRgb(30, 64, 175);
            DeviceRgb accentColor = new DeviceRgb(16, 185, 129);
            DeviceRgb bgGray = new DeviceRgb(248, 250, 252);

            // Header
            Table headerTable = new Table(UnitValue.createPercentArray(new float[]{1})).useAllAvailableWidth();
            Cell headerCell = new Cell().setBackgroundColor(primaryColor).setPadding(14).setBorder(Border.NO_BORDER);
            headerCell.add(new Paragraph("GradePilot AI – Class Academic Report")
                    .setFont(bold).setFontSize(18).setFontColor(ColorConstants.WHITE));
            headerCell.add(new Paragraph(exam.getExamName())
                    .setFont(regular).setFontSize(12).setFontColor(new DeviceRgb(199, 210, 254)));
            headerTable.addCell(headerCell);
            doc.add(headerTable);
            doc.add(new Paragraph(" ").setMarginBottom(4));

            addInfoRow(doc, bold, regular, "Class Advisor", advisor.getAdvisorName());
            addInfoRow(doc, bold, regular, "Department", advisor.getDepartment() + " – Section " + advisor.getSection());
            addInfoRow(doc, bold, regular, "Academic Year", advisor.getAcademicYear());
            addInfoRow(doc, bold, regular, "Generated On", LocalDateTime.now().format(DateTimeFormatter.ofPattern("dd-MM-yyyy HH:mm")));
            doc.add(new Paragraph(" ").setMarginBottom(6));

            // Summary Table
            addSectionHeader(doc, bold, primaryColor, "Class Performance Summary");
            Table summaryTable = new Table(UnitValue.createPercentArray(new float[]{3, 2, 2, 2, 2})).useAllAvailableWidth();
            for (String h : new String[]{"Student Name", "Reg. No.", "Percentage", "Performance", "Approved"}) {
                summaryTable.addHeaderCell(new Cell().setBackgroundColor(primaryColor).setBorder(Border.NO_BORDER)
                        .add(new Paragraph(h).setFont(bold).setFontColor(ColorConstants.WHITE).setFontSize(10)));
            }
            boolean alt = false;
            for (StudentAnalysis a : analysisList) {
                Student s = studentMap.get(a.getStudentId());
                if (s == null) continue;
                DeviceRgb rowColor = alt ? bgGray : new DeviceRgb(255, 255, 255);
                alt = !alt;
                String perf = (a.getEditedPerformanceLevel() != null) ? a.getEditedPerformanceLevel() : a.getPerformanceLevel();
                summaryTable.addCell(styleCell(s.getStudentName(), regular, rowColor));
                summaryTable.addCell(styleCell(s.getRegisterNo(), regular, rowColor));
                summaryTable.addCell(styleCell(String.format("%.2f%%", a.getOverallPercentage()), regular, rowColor));
                summaryTable.addCell(styleCell(perf != null ? perf : "-", regular, rowColor));
                summaryTable.addCell(styleCell(Boolean.TRUE.equals(a.getIsApproved()) ? "\u2705" : "Pending", regular, rowColor));
            }
            doc.add(summaryTable);
            doc.add(new Paragraph(" ").setMarginBottom(8));

            // Individual Student Sections
            addSectionHeader(doc, bold, primaryColor, "Individual Student Reports");
            for (StudentAnalysis a : analysisList) {
                Student s = studentMap.get(a.getStudentId());
                if (s == null) continue;
                doc.add(new Paragraph(s.getStudentName() + " ("+s.getRegisterNo()+") – " +
                        String.format("%.2f%%", a.getOverallPercentage()))
                        .setFont(bold).setFontSize(11).setFontColor(primaryColor).setMarginTop(10));

                String suggestions = (a.getEditedSuggestions() != null && !a.getEditedSuggestions().isBlank())
                        ? a.getEditedSuggestions() : a.getSuggestions();
                String parentSummary = (a.getEditedParentSummary() != null && !a.getEditedParentSummary().isBlank())
                        ? a.getEditedParentSummary() : a.getParentSummary();

                Table studentBox = new Table(UnitValue.createPercentArray(new float[]{1})).useAllAvailableWidth();
                Cell cell = new Cell().setBackgroundColor(bgGray).setPadding(8).setBorder(Border.NO_BORDER);
                cell.add(new Paragraph("Strong: " + (a.getStrongSubjects() != null ? a.getStrongSubjects() : "None"))
                        .setFont(regular).setFontSize(10).setFontColor(new DeviceRgb(21, 128, 61)));
                cell.add(new Paragraph("Weak: " + (a.getWeakSubjects() != null ? a.getWeakSubjects() : "None"))
                        .setFont(regular).setFontSize(10).setFontColor(new DeviceRgb(185, 28, 28)));
                cell.add(new Paragraph("AI Suggestions: " + (suggestions != null ? suggestions : "-"))
                        .setFont(regular).setFontSize(10).setMarginTop(4));
                cell.add(new Paragraph("Parent Summary: " + (parentSummary != null ? parentSummary : "-"))
                        .setFont(regular).setFontSize(10).setItalic().setMarginTop(4));
                studentBox.addCell(cell);
                doc.add(studentBox);
            }

            // Footer
            doc.add(new Paragraph(" "));
            doc.add(new Paragraph("Generated by GradePilot AI | Reviewed by Class Advisor | Confidential")
                    .setFont(regular).setFontSize(8).setFontColor(new DeviceRgb(148, 163, 184))
                    .setTextAlignment(TextAlignment.CENTER));

            doc.close();
            return baos.toByteArray();
        } catch (IOException e) {
            throw new RuntimeException("Failed to generate class report PDF", e);
        }
    }

    private void addSectionHeader(Document doc, PdfFont bold, DeviceRgb color, String title) {
        doc.add(new Paragraph(title)
                .setFont(bold).setFontSize(12).setFontColor(color)
                .setMarginTop(8).setMarginBottom(4));
    }

    private void addInfoRow(Document doc, PdfFont bold, PdfFont regular, String label, String value) {
        doc.add(new Paragraph(label + ": ")
                .setFont(bold).setFontSize(10).setMarginBottom(0)
                .add(new com.itextpdf.layout.element.Text(value != null ? value : "-").setFont(regular)));
    }

    private Cell styleCell(String text, PdfFont font, DeviceRgb bg) {
        return new Cell().setBackgroundColor(bg).setBorder(Border.NO_BORDER)
                .add(new Paragraph(text).setFont(font).setFontSize(10));
    }

    @Data
    public static class QualitativeAnalysisNode {
        private String registerNo;
        private String strongSubjects;
        private String weakSubjects;
        private String performanceLevel;
        private String suggestions;
        private String parentSummary;
    }
}
