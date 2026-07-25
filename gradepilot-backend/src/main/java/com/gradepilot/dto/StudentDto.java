package com.gradepilot.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StudentDto {

    private Long id;

    @NotBlank(message = "Register number is required")
    private String registerNo;

    @NotBlank(message = "Student name is required")
    private String studentName;

    @NotBlank(message = "Contact number is required")
    private String contactNo;

    @NotBlank(message = "Email is required")
    @Email(message = "Invalid email format")
    private String email;

    @NotBlank(message = "Parent name is required")
    private String parentName;

    @NotBlank(message = "Parent contact number is required")
    private String parentContactNo;

    @NotBlank(message = "Parent email is required")
    @Email(message = "Invalid parent email format")
    private String parentEmail;
}
