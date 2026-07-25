package com.gradepilot.service;

import com.gradepilot.dto.ExamRequest;
import com.gradepilot.entity.Student;
import com.gradepilot.entity.StudentMark;
import com.gradepilot.repository.StudentRepository;
import com.gradepilot.repository.StudentMarkRepository;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Comparator;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ExcelService {

    private final StudentRepository studentRepository;
    private final StudentMarkRepository studentMarkRepository;

    public byte[] generateExamExcel(ExamRequest request, Long advisorId) throws IOException {
        return generateExamExcel(request, null, advisorId);
    }

    public byte[] generateExamExcel(ExamRequest request, Long examId, Long advisorId) throws IOException {
        List<Student> students = studentRepository.findAllByClassAdvisorId(advisorId);
        students.sort(Comparator.comparing(Student::getRegisterNo));

        List<StudentMark> savedMarks = examId != null ? studentMarkRepository.findByExamId(examId) : null;

        try (Workbook workbook = new XSSFWorkbook()) {
            // Clean sheet name (remove characters Excel doesn't allow: \ , / , ? , * , [ , ] )
            String sheetName = request.getExamName().replaceAll("[\\\\/?*\\[\\]]", " ");
            if (sheetName.length() > 31) {
                sheetName = sheetName.substring(0, 31);
            }
            Sheet sheet = workbook.createSheet(sheetName);

            // Create styles
            Font headerFont = workbook.createFont();
            headerFont.setBold(true);
            headerFont.setColor(IndexedColors.WHITE.getIndex());
            headerFont.setFontHeightInPoints((short) 11);

            CellStyle headerCellStyle = workbook.createCellStyle();
            headerCellStyle.setFont(headerFont);
            headerCellStyle.setFillForegroundColor(IndexedColors.DARK_BLUE.getIndex());
            headerCellStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            headerCellStyle.setAlignment(HorizontalAlignment.CENTER);
            headerCellStyle.setVerticalAlignment(VerticalAlignment.CENTER);
            headerCellStyle.setBorderTop(BorderStyle.THIN);
            headerCellStyle.setBorderBottom(BorderStyle.THIN);
            headerCellStyle.setBorderLeft(BorderStyle.THIN);
            headerCellStyle.setBorderRight(BorderStyle.THIN);

            Font boldFont = workbook.createFont();
            boldFont.setBold(true);

            CellStyle totalCellStyle = workbook.createCellStyle();
            totalCellStyle.setFont(boldFont);
            totalCellStyle.setAlignment(HorizontalAlignment.CENTER);
            totalCellStyle.setBorderTop(BorderStyle.THIN);
            totalCellStyle.setBorderBottom(BorderStyle.THIN);
            totalCellStyle.setBorderLeft(BorderStyle.THIN);
            totalCellStyle.setBorderRight(BorderStyle.THIN);
            totalCellStyle.setFillForegroundColor(IndexedColors.LIGHT_TURQUOISE.getIndex());
            totalCellStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);

            CellStyle borderCellStyle = workbook.createCellStyle();
            borderCellStyle.setBorderTop(BorderStyle.THIN);
            borderCellStyle.setBorderBottom(BorderStyle.THIN);
            borderCellStyle.setBorderLeft(BorderStyle.THIN);
            borderCellStyle.setBorderRight(BorderStyle.THIN);
            borderCellStyle.setAlignment(HorizontalAlignment.CENTER);

            CellStyle nameCellStyle = workbook.createCellStyle();
            nameCellStyle.setBorderTop(BorderStyle.THIN);
            nameCellStyle.setBorderBottom(BorderStyle.THIN);
            nameCellStyle.setBorderLeft(BorderStyle.THIN);
            nameCellStyle.setBorderRight(BorderStyle.THIN);
            nameCellStyle.setAlignment(HorizontalAlignment.LEFT);

            // Row 0: Headers
            Row headerRow = sheet.createRow(0);
            headerRow.setHeightInPoints(24);

            Cell cell0 = headerRow.createCell(0);
            cell0.setCellValue("Register Number");
            cell0.setCellStyle(headerCellStyle);

            Cell cell1 = headerRow.createCell(1);
            cell1.setCellValue("Student Name");
            cell1.setCellStyle(headerCellStyle);

            int colIndex = 2;
            List<String> subjects = request.getSubjectNames();
            for (String subject : subjects) {
                Cell subCell = headerRow.createCell(colIndex++);
                subCell.setCellValue(subject);
                subCell.setCellStyle(headerCellStyle);
            }

            Cell totalHeaderCell = headerRow.createCell(colIndex);
            totalHeaderCell.setCellValue("Total Marks");
            totalHeaderCell.setCellStyle(headerCellStyle);

            // Populate Student Data
            int rowIndex = 1;
            for (Student student : students) {
                Row row = sheet.createRow(rowIndex++);
                row.setHeightInPoints(18);

                Cell rNoCell = row.createCell(0);
                rNoCell.setCellValue(student.getRegisterNo());
                rNoCell.setCellStyle(borderCellStyle);

                Cell nameCell = row.createCell(1);
                nameCell.setCellValue(student.getStudentName());
                nameCell.setCellStyle(nameCellStyle);

                // Populate subject columns
                for (int i = 0; i < subjects.size(); i++) {
                    String subject = subjects.get(i);
                    Cell markCell = row.createCell(2 + i);
                    markCell.setCellStyle(borderCellStyle);

                    // Check if marks are saved in database
                    if (savedMarks != null) {
                        String regNo = student.getRegisterNo();
                        String subName = subject;
                        savedMarks.stream()
                                .filter(sm -> sm.getRegisterNo().equalsIgnoreCase(regNo) && sm.getSubjectName().equalsIgnoreCase(subName))
                                .findFirst()
                                .ifPresent(sm -> {
                                    if (sm.getMarks() != null) {
                                        markCell.setCellValue(sm.getMarks());
                                    }
                                });
                    }
                }

                // Total Marks SUM Formula
                // Formula format: SUM(StartCell:EndCell) e.g. SUM(C2:E2)
                int excelRow = row.getRowNum() + 1; // 1-indexed for Excel formulas
                String startCol = getColLetter(2);  // Column C
                String endCol = getColLetter(2 + subjects.size() - 1);

                Cell totalCell = row.createCell(2 + subjects.size());
                totalCell.setCellFormula("SUM(" + startCol + excelRow + ":" + endCol + excelRow + ")");
                totalCell.setCellStyle(totalCellStyle);
            }

            // Auto-size columns
            for (int i = 0; i <= 2 + subjects.size(); i++) {
                sheet.autoSizeColumn(i);
                // Add padding
                int currentWidth = sheet.getColumnWidth(i);
                sheet.setColumnWidth(i, currentWidth + 1000);
            }

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            workbook.write(out);
            return out.toByteArray();
        }
    }

    private String getColLetter(int col) {
        StringBuilder sb = new StringBuilder();
        while (col >= 0) {
            sb.insert(0, (char) ('A' + (col % 26)));
            col = (col / 26) - 1;
        }
        return sb.toString();
    }
}
