package com.gradepilot.service;

import com.gradepilot.config.JwtService;
import com.gradepilot.dto.AuthResponse;
import com.gradepilot.dto.LoginRequest;
import com.gradepilot.dto.RegisterRequest;
import com.gradepilot.entity.ClassAdvisor;
import com.gradepilot.exception.BadRequestException;
import com.gradepilot.repository.ClassAdvisorRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ClassAdvisorService {

    private final ClassAdvisorRepository classAdvisorRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public boolean isRegistrationEnabled() {
        return true;
    }

    @Transactional
    public AuthResponse register(RegisterRequest request) {

        if (!request.getPassword().equals(request.getConfirmPassword())) {
            throw new BadRequestException("Password and Confirm Password do not match");
        }

        if (classAdvisorRepository.existsByEmail(request.getEmail())) {
            throw new BadRequestException("Email is already in use");
        }

        ClassAdvisor advisor = ClassAdvisor.builder()
                .advisorName(request.getAdvisorName())
                .department(request.getDepartment())
                .academicYear(request.getAcademicYear())
                .section(request.getSection())
                .email(request.getEmail())
                .password(passwordEncoder.encode(request.getPassword()))
                .build();

        classAdvisorRepository.save(advisor);

        String token = jwtService.generateToken(advisor.getEmail());

        return AuthResponse.builder()
                .token(token)
                .advisorName(advisor.getAdvisorName())
                .department(advisor.getDepartment())
                .academicYear(advisor.getAcademicYear())
                .section(advisor.getSection())
                .email(advisor.getEmail())
                .build();
    }

    public AuthResponse login(LoginRequest request) {
        ClassAdvisor advisor = classAdvisorRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new BadRequestException("Invalid email or password"));

        if (!passwordEncoder.matches(request.getPassword(), advisor.getPassword())) {
            throw new BadRequestException("Invalid email or password");
        }

        String token = jwtService.generateToken(advisor.getEmail());

        return AuthResponse.builder()
                .token(token)
                .advisorName(advisor.getAdvisorName())
                .department(advisor.getDepartment())
                .academicYear(advisor.getAcademicYear())
                .section(advisor.getSection())
                .email(advisor.getEmail())
                .build();
    }
}
