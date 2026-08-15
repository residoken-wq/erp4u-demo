import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService
  ) { }

  async validateUser(username: string, pass: string): Promise<any> {
    console.log(`[AuthService] Validating user: ${username}`);
    const user = await this.usersService.findOneByUsernameForAuth(username);

    if (user) {
      console.log(`[AuthService] Found user: ${user.id}, verifying password...`);
      const isMatch = (pass === user.password) || (await bcrypt.compare(pass, user.password));
      if (isMatch) {
        console.log(`[AuthService] Password match!`);
        const { password, ...result } = user;
        return result;
      } else {
        console.warn(`[AuthService] Password mismatch for user: ${username}`);
      }
    } else {
      console.warn(`[AuthService] User not found: ${username}`);
    }
    return null;
  }

  async login(user: any) {
    const payload = { username: user.username, sub: user.id, group_id: user.group?.id, full_name: user.full_name };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        group_id: user.group?.id,
        role_name: user.group?.name,
        // --- Trả về danh sách quyền cho Client ---
        permissions: user.group?.permissions || []
      }
    };
  }
}