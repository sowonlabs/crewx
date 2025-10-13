import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from '../services/auth.service';

@Injectable()
export class BearerAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    // Allow open access when key is not configured (e.g., STDIO transport)
    if (!this.authService.isKeyConfigured()) {
      return true;
    }

    const authHeader = request.headers['authorization'] || request.headers['Authorization'];

    if (!authHeader || typeof authHeader !== 'string') {
      throw new UnauthorizedException('Missing Authorization header');
    }

    const prefix = 'Bearer ';
    if (!authHeader.startsWith(prefix)) {
      throw new UnauthorizedException('Authorization header must use Bearer token');
    }

    const token = authHeader.slice(prefix.length).trim();
    if (!token || !this.authService.validateKey(token)) {
      throw new UnauthorizedException('Invalid MCP server key');
    }

    return true;
  }
}
