import { Inject, Injectable, Logger } from '@nestjs/common';
import { CliOptions } from '../cli-options';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject('CLI_OPTIONS')
    private readonly cliOptions: CliOptions,
  ) {}

  getServerKey(): string | null {
    return this.cliOptions.key || null;
  }

  isKeyConfigured(): boolean {
    return Boolean(this.getServerKey());
  }

  validateKey(token?: string | null): boolean {
    const expected = this.getServerKey();
    if (!expected) {
      // When no key is configured, treat the server as open (STDIO mode or unsecured HTTP).
      // Higher-level bootstrap should prevent HTTP mode without a key, but keep this resilient.
      return true;
    }

    if (!token) {
      this.logger.warn('Authorization attempt without token while key is configured.');
      return false;
    }

    return token === expected;
  }
}
