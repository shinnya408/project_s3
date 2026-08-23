package com.example.quizapp.controller;

import com.example.quizapp.entity.User;
import com.example.quizapp.repository.QuestionAnswerHistoryRepository;
import com.example.quizapp.repository.UserRepository;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserRepository userRepository;
    private final QuestionAnswerHistoryRepository historyRepository;

    // 全ユーザー一覧の取得（ADMINとMANAGERのみ）
    @GetMapping
    public List<UserDto> getAllUsers(@RequestHeader("X-User-Role") String role) {
        if (!"ADMIN".equals(role) && !"MANAGER".equals(role)) {
            throw new RuntimeException("権限がありません");
        }
        return userRepository.findAll().stream()
                .map(u -> new UserDto(u.getId(), u.getUsername(), u.getEmail(), u.getRole()))
                .collect(Collectors.toList());
    }

    // 権限の変更（ADMINのみ）
    @PutMapping("/{id}/role")
    @Transactional
    public String updateRole(
            @PathVariable Long id, 
            @RequestBody RoleUpdateRequest req, 
            @RequestHeader("X-User-Role") String role) {
        
        if (!"ADMIN".equals(role)) throw new RuntimeException("権限がありません");
        
        User user = userRepository.findById(id).orElseThrow();
        user.setRole(req.getRole());
        userRepository.save(user);
        return "{\"status\":\"success\"}";
    }

    // ユーザーの完全削除（ADMINのみ）
    @DeleteMapping("/{id}")
    @Transactional
    public String deleteUser(@PathVariable Long id, @RequestHeader("X-User-Role") String role) {
        if (!"ADMIN".equals(role)) throw new RuntimeException("権限がありません");
        
        // ユーザーが残した解答履歴なども一括削除（外部キー制約エラー回避のため）
        historyRepository.deleteByUserId(id);
        userRepository.deleteById(id);
        return "{\"status\":\"success\"}";
    }
}

// ===== DTO =====
@Data
class UserDto {
    private Long id;
    private String username;
    private String email;
    private String role;

    public UserDto(Long id, String username, String email, String role) {
        this.id = id; this.username = username; this.email = email; this.role = role;
    }
}

@Data
class RoleUpdateRequest {
    private String role;
}