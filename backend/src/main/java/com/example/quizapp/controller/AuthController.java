package com.example.quizapp.controller;

import com.example.quizapp.entity.User;
import com.example.quizapp.repository.UserRepository;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.Optional;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
public class AuthController {

    private final UserRepository userRepository;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    // ① 新規登録
    @PostMapping("/register")
    @Transactional
    public AuthResponse register(@RequestBody RegisterRequest req) {
        if (userRepository.findByEmail(req.getEmail()).isPresent()) {
            return new AuthResponse(false, "このメールアドレスは既に登録されています。", null, null, null);
        }

        User user = new User();
        user.setUsername(req.getUsername());
        user.setEmail(req.getEmail());
        user.setPasswordHash(passwordEncoder.encode(req.getPassword()));
        // 新規作成時はデフォルトでUSER権限が設定される
        
        userRepository.save(user);
        
        // ★ 修正：role (user.getRole()) を追加して返す
        return new AuthResponse(true, "登録が完了しました。", user.getId(), user.getUsername(), user.getRole());
    }

    // ② ログイン
    @PostMapping("/login")
    public AuthResponse login(@RequestBody LoginRequest req) {
        Optional<User> userOpt = userRepository.findByEmail(req.getEmail());
        
        if (userOpt.isPresent()) {
            User user = userOpt.get();
            if (passwordEncoder.matches(req.getPassword(), user.getPasswordHash())) {
                // ★ 修正：role (user.getRole()) を追加して返す
                return new AuthResponse(true, "ログイン成功", user.getId(), user.getUsername(), user.getRole());
            }
        }
        return new AuthResponse(false, "メールアドレスまたはパスワードが間違っています。", null, null, null);
    }

    // ③ パスワードリセット
    @PostMapping("/reset-password")
    @Transactional
    public AuthResponse resetPassword(@RequestBody ResetPasswordRequest req) {
        Optional<User> userOpt = userRepository.findByEmailAndUsername(req.getEmail(), req.getUsername());
        
        if (userOpt.isPresent()) {
            User user = userOpt.get();
            user.setPasswordHash(passwordEncoder.encode(req.getNewPassword()));
            userRepository.save(user);
        }
        
        return new AuthResponse(true, "パスワードリセット処理が完了しました。", null, null, null);
    }
}

// ===== DTOクラス =====
@Data
class RegisterRequest {
    private String username;
    private String email;
    private String password;
}

@Data
class LoginRequest {
    private String email;
    private String password;
}

@Data
class ResetPasswordRequest {
    private String email;
    private String username;
    private String newPassword;
}

@Data
class AuthResponse {
    private boolean success;
    private String message;
    private Long userId;
    private String username;
    private String role; // ★ 追加

    public AuthResponse(boolean success, String message, Long userId, String username, String role) {
        this.success = success;
        this.message = message;
        this.userId = userId;
        this.username = username;
        this.role = role;
    }
}