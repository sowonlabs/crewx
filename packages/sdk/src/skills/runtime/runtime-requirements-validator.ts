/**
 * Runtime Requirements Validator Implementation
 * Validates that the current environment meets skill runtime requirements
 *
 * WBS-17 Phase 1: SkillRuntime Design
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import { RuntimeRequirementsValidator, RuntimeInfo } from '../../types/skill-runtime.types';

const execAsync = promisify(exec);

/**
 * Runtime Requirements Validator
 * Checks if the current environment meets skill runtime requirements
 */
export class SystemRuntimeValidator implements RuntimeRequirementsValidator {
  
  /**
   * Validate Python version requirement
   */
  async validatePython(requirement: string): Promise<boolean> {
    try {
      const result = await execAsync('python3 --version 2>&1 || python --version 2>&1');
      const versionOutput = (result.stdout.trim() || result.stderr.trim()) as string;
      
      const versionMatch = versionOutput.match(/Python (\d+\.\d+\.\d+)/);
      if (!versionMatch?.[1]) {
        return false;
      }

      const currentVersion = versionMatch[1];
      return this.compareVersions(currentVersion, requirement);
      
    } catch (error) {
      console.warn('Python not found or version check failed:', error);
      return false;
    }
  }

  /**
   * Validate Node.js version requirement
   */
  async validateNode(requirement: string): Promise<boolean> {
    try {
      const result = await execAsync('node --version');
      const versionOutput = result.stdout.trim();
      
      // Node version output is like "v18.17.0"
      const versionMatch = versionOutput.match(/v(\d+\.\d+\.\d+)/);
      if (!versionMatch?.[1]) {
        return false;
      }

      const currentVersion = versionMatch[1];
      return this.compareVersions(currentVersion, requirement);
      
    } catch (error) {
      console.warn('Node.js not found or version check failed:', error);
      return false;
    }
  }

  /**
   * Validate Docker availability
   */
  async validateDocker(): Promise<boolean> {
    try {
      const result = await execAsync('docker --version');
      return result.stdout.trim().length > 0;
      
    } catch (error) {
      console.warn('Docker not found or not accessible:', error);
      return false;
    }
  }

  /**
   * Validate memory requirement
   */
  async validateMemory(requirement: string): Promise<boolean> {
    try {
      const requiredMemory = this.parseMemoryRequirement(requirement);
      const availableMemory = os.totalmem();
      
      return availableMemory >= requiredMemory;
      
    } catch (error) {
      console.warn('Memory validation failed:', error);
      return false;
    }
  }

  /**
   * Get current runtime info
   */
  async getCurrentRuntime(): Promise<RuntimeInfo> {
    const runtime: RuntimeInfo = {
      memory: {
        total: os.totalmem(),
        available: os.freemem()
      }
    };

    // Check Python
    try {
      const result = await execAsync('python3 --version 2>&1 || python --version 2>&1');
      const versionOutput = (result.stdout.trim() || result.stderr.trim()) as string;
      const versionMatch = versionOutput.match(/Python (\d+\.\d+\.\d+)/);
      
      if (versionMatch) {
        runtime.python = {
          version: versionMatch[1] || 'unknown',
          available: true
        };
      } else {
        runtime.python = {
          version: 'unknown',
          available: false
        };
      }
    } catch {
      runtime.python = {
        version: 'unknown',
        available: false
      };
    }

    // Check Node.js
    try {
      const result = await execAsync('node --version');
      const versionOutput = result.stdout.trim();
      const versionMatch = versionOutput.match(/v(\d+\.\d+\.\d+)/);
      
      if (versionMatch) {
        runtime.node = {
          version: versionMatch[1] || 'unknown',
          available: true
        };
      } else {
        runtime.node = {
          version: 'unknown',
          available: false
        };
      }
    } catch {
      runtime.node = {
        version: 'unknown',
        available: false
      };
    }

    // Check Docker
    try {
      const result = await execAsync('docker --version');
      const versionOutput = result.stdout.trim();
      const versionMatch = versionOutput.match(/Docker version (\d+\.\d+\.\d+)/);
      
      if (versionMatch) {
        runtime.docker = {
          version: versionMatch[1] || 'unknown',
          available: true
        };
      } else {
        runtime.docker = {
          version: 'unknown',
          available: false
        };
      }
    } catch {
      runtime.docker = {
        version: 'unknown',
        available: false
      };
    }

    return runtime;
  }

  // ===== Private Helper Methods =====

  /**
   * Compare version strings
   * Supports semantic versioning with operators like >=, >, <=, <, ==
   */
  private compareVersions(current: string, requirement: string): boolean {
    // Parse requirement operator
    const match = requirement.match(/^([><=!]+)\s*(\d+\.\d+\.\d+)$/);
    if (!match) {
      // Default to exact match if no operator
      return current === requirement;
    }

    const operator = match[1];
    const requiredVersion = match[2] || '';

    const currentParts = current.split('.').map(Number);
    const requiredParts = requiredVersion.split('.').map(Number);

    const comparison = this.compareVersionArrays(currentParts, requiredParts);

    switch (operator) {
      case '>=':
        return comparison >= 0;
      case '>':
        return comparison > 0;
      case '<=':
        return comparison <= 0;
      case '<':
        return comparison < 0;
      case '==':
      case '=':
        return comparison === 0;
      default:
        throw new Error(`Unsupported version operator: ${operator}`);
    }
  }

  /**
   * Compare two version arrays
   * Returns: 1 if a > b, -1 if a < b, 0 if equal
   */
  private compareVersionArrays(a: number[], b: number[]): number {
    const maxLength = Math.max(a.length, b.length);
    
    for (let i = 0; i < maxLength; i++) {
      const aPart = a[i] || 0;
      const bPart = b[i] || 0;
      
      if (aPart > bPart) return 1;
      if (aPart < bPart) return -1;
    }
    
    return 0;
  }

  /**
   * Parse memory requirement string
   * Supports formats like: "4GB", "2GB", "512MB"
   */
  private parseMemoryRequirement(requirement: string): number {
    const match = requirement.match(/^(\d+(?:\.\d+)?)\s*(GB|MB|KB|B)$/i);
    if (!match) {
      throw new Error(`Invalid memory requirement format: ${requirement}`);
    }

    const value = parseFloat(match[1] || '0');
    const unit = (match[2] || '').toUpperCase();

    const multipliers = {
      'B': 1,
      'KB': 1024,
      'MB': 1024 * 1024,
      'GB': 1024 * 1024 * 1024
    };

    return Math.floor(value * multipliers[unit as keyof typeof multipliers]);
  }
}

/**
 * Mock Runtime Validator for Testing
 * Provides predictable results for unit tests
 */
export class MockRuntimeValidator implements RuntimeRequirementsValidator {
  private mockResults: Map<string, boolean> = new Map();
  private mockRuntime: RuntimeInfo;

  constructor(mockResults?: Record<string, boolean>) {
    if (mockResults) {
      Object.entries(mockResults).forEach(([key, value]) => {
        this.mockResults.set(key, value);
      });
    }

    this.mockRuntime = {
      python: {
        version: '3.11.0',
        available: this.mockResults.get('python') ?? true
      },
      node: {
        version: '18.17.0',
        available: this.mockResults.get('node') ?? true
      },
      docker: {
        version: '24.0.0',
        available: this.mockResults.get('docker') ?? true
      },
      memory: {
        total: 16 * 1024 * 1024 * 1024, // 16GB
        available: 8 * 1024 * 1024 * 1024  // 8GB
      }
    };
  }

  async validatePython(requirement: string): Promise<boolean> {
    return this.mockResults.get('python') ?? true;
  }

  async validateNode(requirement: string): Promise<boolean> {
    return this.mockResults.get('node') ?? true;
  }

  async validateDocker(): Promise<boolean> {
    return this.mockResults.get('docker') ?? true;
  }

  async validateMemory(requirement: string): Promise<boolean> {
    return this.mockResults.get('memory') ?? true;
  }

  async getCurrentRuntime(): Promise<RuntimeInfo> {
    return { ...this.mockRuntime };
  }

  // Methods for test configuration
  setMockResult(component: string, result: boolean): void {
    this.mockResults.set(component, result);
  }

  setMockRuntime(runtime: Partial<RuntimeInfo>): void {
    this.mockRuntime = { ...this.mockRuntime, ...runtime };
  }
}