package com.example.quizapp.controller;

import com.example.quizapp.entity.Changelog;
import com.example.quizapp.dto.ChangelogRequest;
import com.example.quizapp.repository.ChangelogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/changelogs")
@RequiredArgsConstructor
public class ChangelogController {
    private final ChangelogRepository changelogRepository;

    @GetMapping
    public List<Changelog> getChangelogs() {
        return changelogRepository.findTop20ByDeletedFalseOrderByCreateAtDesc();
    }

    @PostMapping
    public String createChangelog(@RequestBody ChangelogRequest req) {
        Changelog clog = new Changelog();
        clog.setTarget(req.getTarget());
        clog.setType(req.getType());
        clog.setContent(req.getContent());
        changelogRepository.save(clog);
        return "{\"status\": \"success\"}";
    }
}