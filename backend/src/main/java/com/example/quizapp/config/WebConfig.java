package com.example.quizapp.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {
    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        // URLが /uploads/ で始まる場合、プロジェクト直下の uploads/ フォルダを見にいく
        registry.addResourceHandler("/uploads/**")
                .addResourceLocations("file:uploads/");
    }
}