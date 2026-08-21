package com.example.quizapp.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            // 開発用にCSRF保護を無効化（API通信でブロックされないようにするため）
            .csrf(AbstractHttpConfigurer::disable)
            
            // APIのアクセス権限設定
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/auth/**").permitAll() // ログインや登録APIは誰でもアクセス可能
                // ※現在は開発中のため、一旦すべてのAPIを許可（permitAll）しています。
                // 今後、ログインユーザーのみに制限したい場合は以下を .authenticated() に変更します。
                .anyRequest().permitAll() 
            )
            
            // セッションを使わず、REST API向けのステートレス設定にする
            .sessionManagement(session -> session
                .sessionCreationPolicy(SessionCreationPolicy.STATELESS)
            );

        return http.build();
    }

    // パスワードのハッシュ化に使うBCryptのBean登録
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}