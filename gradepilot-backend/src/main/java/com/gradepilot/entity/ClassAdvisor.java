package com.gradepilot.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "class_advisors")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ClassAdvisor {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String advisorName;

    @Column(nullable = false)
    private String department;

    @Column(nullable = false)
    private String academicYear;

    @Column(nullable = false)
    private String section;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(nullable = false)
    private String password;
}
