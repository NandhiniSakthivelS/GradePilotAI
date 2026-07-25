package com.gradepilot.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "student_marks", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"exam_id", "register_no", "subject_name"})
})
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StudentMark {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "exam_id", nullable = false)
    private Long examId;

    @Column(name = "register_no", nullable = false)
    private String registerNo;

    @Column(name = "subject_name", nullable = false)
    private String subjectName;

    @Column(name = "marks")
    private Double marks; // Can be null if empty
}
