package com.gradepilot.controller;

import com.gradepilot.dto.*;
import com.gradepilot.service.ClassAdvisorService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final ClassAdvisorService classAdvisorService;

    @GetMapping("/register-status")
    public ResponseEntity<RegisterStatusResponse> getRegisterStatus() {
        boolean enabled = classAdvisorService.isRegistrationEnabled();
        return ResponseEntity.ok(new RegisterStatusResponse(enabled));
    }

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        AuthResponse response = classAdvisorService.register(request);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        AuthResponse response = classAdvisorService.login(request);
        return ResponseEntity.ok(response);
    }
}
