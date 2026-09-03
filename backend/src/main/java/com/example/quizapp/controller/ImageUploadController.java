package com.example.quizapp.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.client.RestTemplate;

import java.io.InputStream;
import java.net.URL;
import java.net.URLConnection;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/upload")
public class ImageUploadController {

    @Value("${SUPABASE_URL:}")
    private String supabaseUrl;

    @Value("${SUPABASE_KEY:}")
    private String supabaseKey;

    private final String BUCKET_NAME = "uploads";

    @PostMapping
    public String uploadImage(@RequestParam("file") MultipartFile file) {
        try {
            String originalName = file.getOriginalFilename();
            String extension = "";
            
            // ★ 修正: 元のファイル名から「拡張子（.pngなど）」だけを抜き出す
            if (originalName != null && originalName.lastIndexOf(".") > -1) {
                extension = originalName.substring(originalName.lastIndexOf("."));
            }
            
            // ★ 修正: 日本語名を除外して、UUIDと拡張子だけで安全な名前を作る
            String filename = UUID.randomUUID().toString() + extension;
            
            String imageUrl = uploadToSupabase(file.getBytes(), filename, file.getContentType());
            return "{\"url\": \"" + imageUrl + "\"}";
        } catch (Exception e) {
            throw new RuntimeException("画像のアップロードに失敗しました", e);
        }
    }

    @PostMapping("/url")
    public String uploadImageFromUrl(@RequestBody Map<String, String> payload) {
        String targetUrl = payload.get("url");
        if (targetUrl == null || targetUrl.trim().isEmpty()) {
            throw new RuntimeException("URLが指定されていません");
        }
        try {
            String extension = ".jpg"; // デフォルト
            try {
                URL url = new URL(targetUrl);
                String path = url.getPath();
                if (path.contains(".")) {
                    extension = path.substring(path.lastIndexOf('.'));
                }
            } catch (Exception e) {
                // 無視してデフォルト拡張子を使用
            }
            
            // ★ 修正: こちらもランダム英数字＋拡張子だけにする
            String filename = UUID.randomUUID().toString() + extension;
            
            URL url = new URL(targetUrl);
            URLConnection connection = url.openConnection();
            connection.setRequestProperty("User-Agent", "Mozilla/5.0");
            connection.setConnectTimeout(5000);
            connection.setReadTimeout(5000);
            
            byte[] imageBytes;
            try (InputStream in = connection.getInputStream()) {
                imageBytes = in.readAllBytes();
            }
            
            String contentType = connection.getContentType();
            if (contentType == null) contentType = "image/jpeg";

            String imageUrl = uploadToSupabase(imageBytes, filename, contentType);
            
            return "{\"url\": \"" + imageUrl + "\"}";
        } catch (Exception e) {
            throw new RuntimeException("外部画像のダウンロード・保存に失敗しました", e);
        }
    }

    private String uploadToSupabase(byte[] fileBytes, String filename, String contentType) {
        if (supabaseUrl == null || supabaseUrl.isEmpty() || supabaseKey == null || supabaseKey.isEmpty()) {
            throw new RuntimeException("SupabaseのURLまたはキーが設定されていません");
        }

        RestTemplate restTemplate = new RestTemplate();
        String uploadEndpoint = supabaseUrl + "/storage/v1/object/" + BUCKET_NAME + "/" + filename;
        
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(supabaseKey);
        headers.setContentType(MediaType.parseMediaType(contentType));
        
        HttpEntity<byte[]> requestEntity = new HttpEntity<>(fileBytes, headers);
        
        ResponseEntity<String> response = restTemplate.exchange(uploadEndpoint, HttpMethod.POST, requestEntity, String.class);
        
        if (response.getStatusCode().is2xxSuccessful()) {
            return supabaseUrl + "/storage/v1/object/public/" + BUCKET_NAME + "/" + filename;
        } else {
            throw new RuntimeException("Supabaseへのアップロード失敗: " + response.getBody());
        }
    }
}