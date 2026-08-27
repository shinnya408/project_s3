package com.example.quizapp.controller;

import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.UUID;
import java.util.Map;
import java.io.IOException;
import java.io.InputStream;
import java.net.URL;
import java.net.URLConnection;

@RestController
@RequestMapping("/api/upload")
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

    // ★ 追加：外部URLから画像をダウンロードして内部に保存するAPI
    @PostMapping("/url")
    public String uploadImageFromUrl(@RequestBody Map<String, String> payload) {
        String targetUrl = payload.get("url");
        if (targetUrl == null || targetUrl.trim().isEmpty()) {
            throw new RuntimeException("URLが指定されていません");
        }
        try {
            Path uploadPath = Paths.get(UPLOAD_DIR);
            if (!Files.exists(uploadPath)) {
                Files.createDirectories(uploadPath);
            }
            
            String originalName = "downloaded_image.jpg";
            try {
                URL url = new URL(targetUrl);
                String path = url.getPath();
                String name = path.substring(path.lastIndexOf('/') + 1);
                if (name.contains(".")) {
                    originalName = name;
                }
            } catch (Exception e) {
                // URLからファイル名が取れなかった場合はデフォルト名
            }
            
            String filename = UUID.randomUUID().toString() + "_" + originalName;
            Path filePath = uploadPath.resolve(filename);
            
            URL url = new URL(targetUrl);
            URLConnection connection = url.openConnection();
            // 外部サイトのブロック（403 Forbiddenなど）を回避するためにブラウザのフリをする
            connection.setRequestProperty("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)");
            connection.setConnectTimeout(5000);
            connection.setReadTimeout(5000);
            
            try (InputStream in = connection.getInputStream()) {
                Files.copy(in, filePath);
            }
            
            // 配信用のURLを返す
            String imageUrl = "http://localhost:8080/uploads/" + filename;
            return "{\"url\": \"" + imageUrl + "\"}";
        } catch (Exception e) {
            throw new RuntimeException("画像のダウンロードに失敗しました", e);
        }
    }
}