package com.example.quizapp.controller;

import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.UUID;
import java.io.IOException;

@RestController
@RequestMapping("/api/upload")
@CrossOrigin(origins = "*")
public class ImageUploadController {

    private static final String UPLOAD_DIR = "uploads/";

    @PostMapping
    public String uploadImage(@RequestParam("file") MultipartFile file) {
        try {
            Path uploadPath = Paths.get(UPLOAD_DIR);
            if (!Files.exists(uploadPath)) {
                Files.createDirectories(uploadPath); // フォルダが無ければ作る
            }
            // ランダムな文字列を付けてファイル名の被りを防ぐ
            String filename = UUID.randomUUID().toString() + "_" + file.getOriginalFilename();
            Path filePath = uploadPath.resolve(filename);
            
            Files.copy(file.getInputStream(), filePath);
            
            // 配信用のURLを返す
            String imageUrl = "http://localhost:8080/uploads/" + filename;
            return "{\"url\": \"" + imageUrl + "\"}";
        } catch (IOException e) {
            throw new RuntimeException("画像のアップロードに失敗しました", e);
        }
    }
}