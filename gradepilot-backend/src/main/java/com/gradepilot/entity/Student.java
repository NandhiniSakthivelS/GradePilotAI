package com.gradepilot.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "students")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Student {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String registerNo;

    @Column(nullable = false)
    private String studentName;

    @Column(nullable = false)
    private String contactNo;

    @Column(nullable = false)
    private String email;

    @Column(nullable = false)
    private String parentName;

    @Column(nullable = false)
    private String parentContactNo;

    @Column(nullable = false)
    private String parentEmail;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "advisor_id")
    private ClassAdvisor classAdvisor;
}
