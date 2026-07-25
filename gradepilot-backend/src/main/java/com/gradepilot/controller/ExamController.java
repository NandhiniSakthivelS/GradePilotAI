package com.gradepilot.controller;

import com.gradepilot.dto.ExamRequest;
import com.gradepilot.dto.StudentMarkDto;
import com.gradepilot.entity.Exam;
import com.gradepilot.entity.StudentMark;
import com.gradepilot.service.ExamService;
import com.gradepilot.service.ExcelService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/exams")
@RequiredArgsConstructor
public class ExamController {

    private final ExamService examService;
    private final ExcelService excelService;

    @PostMapping
    public ResponseEntity<Exam> createExam(@Valid @RequestBody ExamRequest request) {
        Exam created = examService.createExam(request);
        return ResponseEntity.ok(created);
    }

    @GetMapping
    public ResponseEntity<List<Exam>> getAllExams() {
        return ResponseEntity.ok(examService.getAllExams());
    }

    @GetMapping("/{id}")
    public ResponseEntity<Exam> getExamById(@PathVariable Long id) {
        return ResponseEntity.ok(examService.getExamById(id));
    }

    @PostMapping("/{id}/marks")
    public ResponseEntity<Map<String, String>> saveMarks(@PathVariable Long id, @RequestBody List<StudentMarkDto> markDtos) {
        examService.saveMarks(id, markDtos);
        return ResponseEntity.ok(Map.of("message", "Marks saved successfully"));
    }

    @GetMapping("/{id}/marks")
    public ResponseEntity<List<StudentMark>> getMarksForExam(@PathVariable Long id) {
        return ResponseEntity.ok(examService.getMarksForExam(id));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, String>> deleteExam(@PathVariable Long id) {
        examService.deleteExam(id);
        return ResponseEntity.ok(Map.of("message", "Exam deleted successfully"));
    }

    @GetMapping("/{id}/excel")
    public ResponseEntity<byte[]> downloadExcelForExam(@PathVariable Long id) {
        try {
            Exam exam = examService.getExamById(id);
            com.gradepilot.entity.ClassAdvisor advisor = examService.getCurrentAdvisor();
            ExamRequest request = new ExamRequest(exam.getExamName(), exam.getSubjectNames());
            byte[] excelContent = excelService.generateExamExcel(request, exam.getId(), advisor.getId());
            String safeFileName = exam.getExamName().trim().replaceAll("\\s+", "_") + "_marks.xlsx";

            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + safeFileName + "\"")
                    .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                    .body(excelContent);
        } catch (IOException e) {
            throw new RuntimeException("Error occurred while generating Excel file", e);
        }
    }

    @PostMapping("/generate-excel")
    public ResponseEntity<byte[]> generateExcel(@Valid @RequestBody ExamRequest request) {
        try {
            com.gradepilot.entity.ClassAdvisor advisor = examService.getCurrentAdvisor();
            byte[] excelContent = excelService.generateExamExcel(request, advisor.getId());
            String safeFileName = request.getExamName().trim().replaceAll("\\s+", "_") + "_marks.xlsx";

            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + safeFileName + "\"")
                    .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                    .body(excelContent);
        } catch (IOException e) {
            throw new RuntimeException("Error occurred while generating Excel file", e);
        }
    }
}
