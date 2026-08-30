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

    // application.properties または 環境変数から取得
    @Value("${SUPABASE_URL:}")
    private String supabaseUrl;

    @Value("${SUPABASE_KEY:}")
    private String supabaseKey;

    // Supabaseに作成したバケット名
    private final String BUCKET_NAME = "uploads";

    @PostMapping
    public String uploadImage(@RequestParam("file") MultipartFile file) {
        try {
            String originalName = file.getOriginalFilename();
            String filename = UUID.randomUUID().toString() + "_" + originalName;
            
            // ローカル保存をやめ、直接Supabaseへアップロード
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
            String originalName = "downloaded_image.jpg";
            try {
                URL url = new URL(targetUrl);
                String path = url.getPath();
                String name = path.substring(path.lastIndexOf('/') + 1);
                if (name.contains(".")) {
                    originalName = name;
                }
            } catch (Exception e) {
                // 無視してデフォルト名を使用
            }
            
            String filename = UUID.randomUUID().toString() + "_" + originalName;
            
            // 外部URLから画像をメモリ上にダウンロード
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

            // 直接Supabaseへアップロード
            String imageUrl = uploadToSupabase(imageBytes, filename, contentType);
            
            return "{\"url\": \"" + imageUrl + "\"}";
        } catch (Exception e) {
            throw new RuntimeException("外部画像のダウンロード・保存に失敗しました", e);
        }
    }

    // Supabase StorageのAPIを叩いて画像を保存し、公開URLを返す共通メソッド
    private String uploadToSupabase(byte[] fileBytes, String filename, String contentType) {
        if (supabaseUrl == null || supabaseUrl.isEmpty() || supabaseKey == null || supabaseKey.isEmpty()) {
            throw new RuntimeException("SupabaseのURLまたはキーが設定されていません");
        }

        RestTemplate restTemplate = new RestTemplate();
        
        // アップロード用APIエンドポイント
        String uploadEndpoint = supabaseUrl + "/storage/v1/object/" + BUCKET_NAME + "/" + filename;
        
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(supabaseKey); // 認証キーをセット
        headers.setContentType(MediaType.parseMediaType(contentType));
        
        HttpEntity<byte[]> requestEntity = new HttpEntity<>(fileBytes, headers);
        
        // Supabaseへ送信
        ResponseEntity<String> response = restTemplate.exchange(uploadEndpoint, HttpMethod.POST, requestEntity, String.class);
        
        if (response.getStatusCode().is2xxSuccessful()) {
            // 成功した場合、パブリック(公開)URLを組み立てて返す
            return supabaseUrl + "/storage/v1/object/public/" + BUCKET_NAME + "/" + filename;
        } else {
            throw new RuntimeException("Supabaseへのアップロード失敗: " + response.getBody());
        }
    }
}