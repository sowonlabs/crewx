import { Test, TestingModule } from '@nestjs/testing';
import { ContextEnhancementService } from '../../src/services/context-enhancement.service';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock fs module
vi.mock('fs');
const mockedFs = vi.mocked(fs);

describe('ContextEnhancementService', () => {
  let service: ContextEnhancementService;
  let tempDir: string;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ContextEnhancementService],
    }).compile();

    service = module.get<ContextEnhancementService>(ContextEnhancementService);
    tempDir = '/tmp/test-project';
    
    // Reset mocks
    vi.clearAllMocks();
  });

  describe('loadProjectContext', () => {
    it('should load project context from CLAUDE.md', async () => {
      const projectContent = '# Test Project\nThis is a test project.';
      
      mockedFs.existsSync.mockImplementation((filePath: any) => {
        return filePath === path.join(tempDir, 'CLAUDE.md');
      });
      
      mockedFs.readFileSync.mockReturnValue(projectContent);

      const result = await service.loadProjectContext(tempDir);

      expect(result).toContain('Test Project');
      expect(result).toContain('This is a test project');
      expect(mockedFs.readFileSync).toHaveBeenCalledWith(
        path.join(tempDir, 'CLAUDE.md'),
        'utf-8'
      );
    });

    it('should load from .claude/CLAUDE.md if main CLAUDE.md does not exist', async () => {
      const projectContent = '# Claude Dir Project\nFrom .claude directory.';
      
      mockedFs.existsSync.mockImplementation((filePath: any) => {
        return filePath === path.join(tempDir, '.claude/CLAUDE.md');
      });
      
      mockedFs.readFileSync.mockReturnValue(projectContent);

      const result = await service.loadProjectContext(tempDir);

      expect(result).toContain('Claude Dir Project');
      expect(mockedFs.readFileSync).toHaveBeenCalledWith(
        path.join(tempDir, '.claude/CLAUDE.md'),
        'utf-8'
      );
    });

    it('should return empty string if no CLAUDE.md files exist', async () => {
      mockedFs.existsSync.mockReturnValue(false);

      const result = await service.loadProjectContext(tempDir);

      expect(result).toBe('');
    });

    it('should handle read errors gracefully', async () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const result = await service.loadProjectContext(tempDir);

      expect(result).toBe('');
    });

    it('should cache results', async () => {
      const projectContent = '# Cached Project\nThis should be cached.';
      
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(projectContent);

      // First call
      const result1 = await service.loadProjectContext(tempDir);
      // Second call (should use cache)
      const result2 = await service.loadProjectContext(tempDir);

      expect(result1).toBe(result2);
      expect(mockedFs.readFileSync).toHaveBeenCalledTimes(1);
    });
  });

  describe('enhancePromptWithProjectContext', () => {
    it('should enhance prompt with project context', async () => {
      const prompt = 'Help me with this code';
      const projectContent = '# Test Project\nThis is a test project.';
      
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(projectContent);

      const result = await service.enhancePromptWithProjectContext(prompt, tempDir);

      expect(result).toContain('Test Project');
      expect(result).toContain(prompt);
      expect(result).toMatch(/---/); // Should contain separator
    });

    it('should not enhance if includeProjectContext is false', async () => {
      const prompt = 'Help me with this code';
      
      const result = await service.enhancePromptWithProjectContext(
        prompt, 
        tempDir, 
        { includeProjectContext: false }
      );

      expect(result).toBe(prompt);
      expect(mockedFs.existsSync).not.toHaveBeenCalled();
    });

    it('should truncate long project context', async () => {
      const prompt = 'Help me with this code';
      const longContent = 'x'.repeat(3000); // Long content
      
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(longContent);

      const result = await service.enhancePromptWithProjectContext(
        prompt, 
        tempDir, 
        { maxProjectContextLength: 100 }
      );

      expect(result).toContain('(truncated)');
      expect(result.length).toBeLessThan(longContent.length + prompt.length);
    });
  });

  describe('hasProjectContext', () => {
    it('should return true if CLAUDE.md exists', async () => {
      mockedFs.existsSync.mockImplementation((filePath: any) => {
        return filePath === path.join(tempDir, 'CLAUDE.md');
      });

      const result = await service.hasProjectContext(tempDir);

      expect(result).toBe(true);
    });

    it('should return false if no CLAUDE.md files exist', async () => {
      mockedFs.existsSync.mockReturnValue(false);

      const result = await service.hasProjectContext(tempDir);

      expect(result).toBe(false);
    });
  });

  describe('createSampleClaudeMd', () => {
    beforeEach(() => {
      mockedFs.mkdirSync.mockImplementation(() => undefined);
      mockedFs.writeFileSync.mockImplementation(() => undefined);
      mockedFs.existsSync.mockReturnValue(false);
    });

    it('should create sample CLAUDE.md file', async () => {
      const projectName = 'Test Project';
      
      const result = await service.createSampleClaudeMd(tempDir, projectName);

      expect(result).toBe(path.join(tempDir, '.claude/CLAUDE.md'));
      expect(mockedFs.mkdirSync).toHaveBeenCalledWith(
        path.join(tempDir, '.claude'),
        { recursive: true }
      );
      expect(mockedFs.writeFileSync).toHaveBeenCalledWith(
        path.join(tempDir, '.claude/CLAUDE.md'),
        expect.stringContaining(projectName),
        'utf-8'
      );
    });

    it('should not create .claude directory if it already exists', async () => {
      mockedFs.existsSync.mockReturnValue(true);
      
      await service.createSampleClaudeMd(tempDir);

      expect(mockedFs.mkdirSync).not.toHaveBeenCalled();
    });

    it('should handle write errors', async () => {
      mockedFs.writeFileSync.mockImplementation(() => {
        throw new Error('Write failed');
      });

      await expect(service.createSampleClaudeMd(tempDir)).rejects.toThrow('Write failed');
    });
  });

  describe('clearCache', () => {
    it('should clear the cache', async () => {
      // First, populate the cache
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue('test content');
      
      await service.loadProjectContext(tempDir);
      
      // Clear cache
      service.clearCache();
      
      // Next call should hit filesystem again
      await service.loadProjectContext(tempDir);
      
      expect(mockedFs.readFileSync).toHaveBeenCalledTimes(2);
    });
  });
});