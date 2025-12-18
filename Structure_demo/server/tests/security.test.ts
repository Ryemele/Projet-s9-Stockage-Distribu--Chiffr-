/**
 * Security Middleware Test Suite
 * 
 * Tests: Rate Limiting, Input Validation, Security Headers
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// ==================== RATE LIMITER TESTS ====================

describe('Rate Limiting', () => {
    let limiter: MockRateLimiter;

    beforeEach(() => {
        limiter = new MockRateLimiter({ windowMs: 60000, max: 10 });
    });

    describe('Basic Rate Limiting', () => {
        it('should allow requests under limit', () => {
            const ip = '192.168.1.1';

            for (let i = 0; i < 10; i++) {
                expect(limiter.check(ip).allowed).toBe(true);
            }
        });

        it('should block requests over limit', () => {
            const ip = '192.168.1.1';

            for (let i = 0; i < 10; i++) {
                limiter.check(ip);
            }

            expect(limiter.check(ip).allowed).toBe(false);
        });

        it('should track different IPs separately', () => {
            const ip1 = '192.168.1.1';
            const ip2 = '192.168.1.2';

            for (let i = 0; i < 10; i++) {
                limiter.check(ip1);
            }

            expect(limiter.check(ip1).allowed).toBe(false);
            expect(limiter.check(ip2).allowed).toBe(true);
        });

        it('should reset after window expires', async () => {
            limiter = new MockRateLimiter({ windowMs: 100, max: 5 });
            const ip = '192.168.1.1';

            for (let i = 0; i < 5; i++) {
                limiter.check(ip);
            }

            expect(limiter.check(ip).allowed).toBe(false);

            await new Promise(r => setTimeout(r, 150));

            expect(limiter.check(ip).allowed).toBe(true);
        });

        it('should return remaining count', () => {
            const ip = '192.168.1.1';

            limiter.check(ip);
            limiter.check(ip);

            const result = limiter.check(ip);
            expect(result.remaining).toBe(7);
        });
    });

    describe('Auth Rate Limiter', () => {
        it('should have stricter limits for auth endpoints', () => {
            const authLimiter = new MockRateLimiter({ windowMs: 900000, max: 5 }); // 5 per 15 min
            const ip = '192.168.1.1';

            for (let i = 0; i < 5; i++) {
                expect(authLimiter.check(ip).allowed).toBe(true);
            }

            expect(authLimiter.check(ip).allowed).toBe(false);
        });

        it('should combine IP and email for auth', () => {
            const authLimiter = new MockRateLimiter({ windowMs: 900000, max: 5 });

            // Same IP, different emails
            expect(authLimiter.check('192.168.1.1:user1@test.com').allowed).toBe(true);
            expect(authLimiter.check('192.168.1.1:user2@test.com').allowed).toBe(true);

            // Same email, different IPs
            expect(authLimiter.check('192.168.1.2:user1@test.com').allowed).toBe(true);
        });
    });

    describe('Upload Rate Limiter', () => {
        it('should allow burst uploads', () => {
            const uploadLimiter = new MockRateLimiter({ windowMs: 3600000, max: 50 }); // 50 per hour
            const userId = 'user-123';

            for (let i = 0; i < 50; i++) {
                expect(uploadLimiter.check(userId).allowed).toBe(true);
            }
        });

        it('should block excessive uploads', () => {
            const uploadLimiter = new MockRateLimiter({ windowMs: 3600000, max: 50 });
            const userId = 'user-123';

            for (let i = 0; i < 50; i++) {
                uploadLimiter.check(userId);
            }

            expect(uploadLimiter.check(userId).allowed).toBe(false);
        });
    });
});

// ==================== INPUT VALIDATION TESTS ====================

describe('Input Validation', () => {
    describe('Email Validation', () => {
        it('should accept valid emails', () => {
            const validEmails = [
                'test@example.com',
                'user.name@domain.co.uk',
                'user+tag@example.org',
                '123@numbers.com',
            ];

            validEmails.forEach(email => {
                expect(isValidEmail(email)).toBe(true);
            });
        });

        it('should reject invalid emails', () => {
            const invalidEmails = [
                'not-an-email',
                '@no-local-part.com',
                'spaces in@email.com',
                'missing@tld',
                '',
                'a'.repeat(300) + '@example.com', // Too long
            ];

            invalidEmails.forEach(email => {
                expect(isValidEmail(email)).toBe(false);
            });
        });

        it('should normalize email case', () => {
            const email = 'Test@EXAMPLE.COM';
            expect(normalizeEmail(email)).toBe('test@example.com');
        });
    });

    describe('Password Validation', () => {
        it('should accept strong passwords', () => {
            const strongPasswords = [
                'SecureP@ss123!',
                'MyStr0ng!Password',
                'C0mpl3x_P@ssw0rd',
            ];

            strongPasswords.forEach(pwd => {
                expect(validatePassword(pwd).valid).toBe(true);
            });
        });

        it('should reject weak passwords', () => {
            const weakPasswords = [
                { pwd: 'short', reason: 'length' },
                { pwd: 'nouppercase123!', reason: 'uppercase' },
                { pwd: 'NOLOWERCASE123!', reason: 'lowercase' },
                { pwd: 'NoNumbers!Only', reason: 'number' },
                { pwd: 'NoSpecialChars123', reason: 'special' },
            ];

            weakPasswords.forEach(({ pwd, reason }) => {
                const result = validatePassword(pwd);
                expect(result.valid).toBe(false);
                expect(result.errors).toContain(reason);
            });
        });

        it('should reject common passwords', () => {
            const commonPasswords = [
                'Password123!',
                'Qwerty123!@#',
                'Admin@12345',
            ];

            commonPasswords.forEach(pwd => {
                const result = validatePassword(pwd, { checkCommon: true });
                expect(result.valid).toBe(false);
            });
        });
    });

    describe('File Name Validation', () => {
        it('should accept valid file names', () => {
            const validNames = [
                'document.pdf',
                'my-file_v2.txt',
                'report 2023.xlsx',
                '日本語ファイル.doc',
            ];

            validNames.forEach(name => {
                expect(isValidFileName(name)).toBe(true);
            });
        });

        it('should reject dangerous file names', () => {
            const dangerousNames = [
                '../../../etc/passwd',
                'file\0name.txt', // Null byte
                'con.txt', // Windows reserved
                'file<script>.txt', // XSS attempt
                '.htaccess',
                '',
                'a'.repeat(300), // Too long
            ];

            dangerousNames.forEach(name => {
                expect(isValidFileName(name)).toBe(false);
            });
        });

        it('should sanitize file names', () => {
            expect(sanitizeFileName('../dangerous/path.txt')).toBe('dangerous_path.txt');
            expect(sanitizeFileName('file<script>.txt')).toBe('filescript.txt');
        });
    });

    describe('UUID Validation', () => {
        it('should accept valid UUIDs', () => {
            const validUUIDs = [
                '550e8400-e29b-41d4-a716-446655440000',
                'f47ac10b-58cc-4372-a567-0e02b2c3d479',
            ];

            validUUIDs.forEach(uuid => {
                expect(isValidUUID(uuid)).toBe(true);
            });
        });

        it('should reject invalid UUIDs', () => {
            const invalidUUIDs = [
                'not-a-uuid',
                '550e8400-e29b-41d4-a716-44665544000', // Too short
                '550e8400-e29b-41d4-a716-4466554400001', // Too long
                '550e8400-e29b-41d4-g716-446655440000', // Invalid char
            ];

            invalidUUIDs.forEach(uuid => {
                expect(isValidUUID(uuid)).toBe(false);
            });
        });
    });

    describe('Request Sanitization', () => {
        it('should remove null bytes', () => {
            const malicious = 'test\0value';
            expect(sanitizeInput(malicious)).toBe('testvalue');
        });

        it('should escape HTML entities', () => {
            const xss = '<script>alert("xss")</script>';
            const sanitized = sanitizeInput(xss);
            expect(sanitized).not.toContain('<script>');
        });

        it('should handle deeply nested objects', () => {
            const nested = {
                level1: {
                    level2: {
                        level3: '<script>evil</script>',
                    },
                },
            };

            const sanitized = sanitizeObject(nested);
            expect(sanitized.level1.level2.level3).not.toContain('<script>');
        });

        it('should preserve safe data', () => {
            const safe = {
                name: 'John Doe',
                count: 42,
                active: true,
                tags: ['a', 'b', 'c'],
            };

            const sanitized = sanitizeObject(safe);
            expect(sanitized).toEqual(safe);
        });
    });
});

// ==================== SECURITY HEADERS TESTS ====================

describe('Security Headers', () => {
    describe('Content Security Policy', () => {
        it('should set strict CSP', () => {
            const csp = getCSPHeader();

            expect(csp).toContain("default-src 'self'");
            expect(csp).toContain("script-src 'self'");
            expect(csp).toContain("object-src 'none'");
        });

        it('should allow inline styles with nonce', () => {
            const nonce = generateNonce();
            const csp = getCSPHeader({ styleNonce: nonce });

            expect(csp).toContain(`style-src 'self' 'nonce-${nonce}'`);
        });
    });

    describe('HSTS', () => {
        it('should set max-age', () => {
            const hsts = getHSTSHeader();
            expect(hsts).toContain('max-age=31536000');
        });

        it('should include subdomains', () => {
            const hsts = getHSTSHeader();
            expect(hsts).toContain('includeSubDomains');
        });
    });

    describe('CORS', () => {
        it('should allow configured origins', () => {
            const allowedOrigins = ['https://example.com', 'https://app.example.com'];

            expect(checkCORS('https://example.com', allowedOrigins)).toBe(true);
            expect(checkCORS('https://app.example.com', allowedOrigins)).toBe(true);
        });

        it('should block unconfigured origins', () => {
            const allowedOrigins = ['https://example.com'];

            expect(checkCORS('https://evil.com', allowedOrigins)).toBe(false);
            expect(checkCORS('http://example.com', allowedOrigins)).toBe(false); // HTTP vs HTTPS
        });

        it('should handle null origin', () => {
            const allowedOrigins = ['https://example.com'];
            expect(checkCORS(null, allowedOrigins)).toBe(false);
        });
    });
});

// ==================== IP FILTERING TESTS ====================

describe('IP Filtering', () => {
    describe('Blacklist', () => {
        it('should block blacklisted IPs', () => {
            const blacklist = ['1.2.3.4', '5.6.7.8'];

            expect(ipAllowed('1.2.3.4', { blacklist })).toBe(false);
            expect(ipAllowed('5.6.7.8', { blacklist })).toBe(false);
        });

        it('should allow non-blacklisted IPs', () => {
            const blacklist = ['1.2.3.4'];

            expect(ipAllowed('9.10.11.12', { blacklist })).toBe(true);
        });
    });

    describe('Whitelist', () => {
        it('should only allow whitelisted IPs', () => {
            const whitelist = ['192.168.1.1', '192.168.1.2'];

            expect(ipAllowed('192.168.1.1', { whitelist })).toBe(true);
            expect(ipAllowed('192.168.1.3', { whitelist })).toBe(false);
        });
    });

    describe('CIDR Ranges', () => {
        it('should match CIDR ranges', () => {
            const whitelist = ['192.168.1.0/24'];

            expect(ipAllowed('192.168.1.100', { whitelist })).toBe(true);
            expect(ipAllowed('192.168.2.1', { whitelist })).toBe(false);
        });
    });
});

// ==================== MOCK IMPLEMENTATIONS ====================

class MockRateLimiter {
    private requests: Map<string, { count: number; firstRequest: number }> = new Map();

    constructor(private config: { windowMs: number; max: number }) { }

    check(key: string): { allowed: boolean; remaining: number; resetAt: number } {
        const now = Date.now();
        const record = this.requests.get(key);

        if (!record || now - record.firstRequest > this.config.windowMs) {
            this.requests.set(key, { count: 1, firstRequest: now });
            return { allowed: true, remaining: this.config.max - 1, resetAt: now + this.config.windowMs };
        }

        record.count++;
        const allowed = record.count <= this.config.max;
        return {
            allowed,
            remaining: Math.max(0, this.config.max - record.count),
            resetAt: record.firstRequest + this.config.windowMs,
        };
    }
}

function isValidEmail(email: string): boolean {
    if (!email || email.length > 254) return false;
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
}

function normalizeEmail(email: string): string {
    return email.toLowerCase().trim();
}

function validatePassword(password: string, options?: { checkCommon?: boolean }): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (password.length < 12) errors.push('length');
    if (!/[A-Z]/.test(password)) errors.push('uppercase');
    if (!/[a-z]/.test(password)) errors.push('lowercase');
    if (!/[0-9]/.test(password)) errors.push('number');
    if (!/[^A-Za-z0-9]/.test(password)) errors.push('special');

    if (options?.checkCommon) {
        const common = ['password', 'qwerty', 'admin', '123456'];
        if (common.some(c => password.toLowerCase().includes(c))) {
            errors.push('common');
        }
    }

    return { valid: errors.length === 0, errors };
}

function isValidFileName(name: string): boolean {
    if (!name || name.length > 255) return false;
    if (name.includes('\0')) return false;
    if (name.startsWith('.')) return false;
    if (/[<>:"\\/|?*]/.test(name)) return false;
    if (/^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/i.test(name.split('.')[0])) return false;
    if (name.includes('..')) return false;
    return true;
}

function sanitizeFileName(name: string): string {
    return name
        .replace(/\.\.\//g, '')  // Remove parent directory traversal
        .replace(/[<>:"|?*]/g, '') // Remove invalid chars
        .replace(/\//g, '_')      // Replace forward slash with underscore
        .replace(/\\/g, '_')      // Replace backslash with underscore
        .replace(/^\./, '');      // Remove leading dot
}

function isValidUUID(uuid: string): boolean {
    const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return regex.test(uuid);
}

function sanitizeInput(input: string): string {
    return input.replace(/\0/g, '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function sanitizeObject(obj: any): any {
    if (typeof obj === 'string') return sanitizeInput(obj);
    if (Array.isArray(obj)) return obj.map(sanitizeObject);
    if (obj && typeof obj === 'object') {
        return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, sanitizeObject(v)]));
    }
    return obj;
}

function getCSPHeader(options?: { styleNonce?: string }): string {
    let csp = "default-src 'self'; script-src 'self'; object-src 'none';";
    if (options?.styleNonce) {
        csp += ` style-src 'self' 'nonce-${options.styleNonce}';`;
    }
    return csp;
}

function generateNonce(): string {
    return Buffer.from(Math.random().toString()).toString('base64').slice(0, 16);
}

function getHSTSHeader(): string {
    return 'max-age=31536000; includeSubDomains; preload';
}

function checkCORS(origin: string | null, allowed: string[]): boolean {
    if (!origin) return false;
    return allowed.includes(origin);
}

function ipAllowed(ip: string, rules: { blacklist?: string[]; whitelist?: string[] }): boolean {
    if (rules.blacklist?.includes(ip)) return false;
    if (rules.whitelist) {
        return rules.whitelist.some(w => {
            if (w.includes('/')) {
                // CIDR check (simplified)
                const [network, bits] = w.split('/');
                const networkParts = network.split('.').map(Number);
                const ipParts = ip.split('.').map(Number);
                const mask = parseInt(bits);
                // Simplified: just check first octets
                return networkParts.slice(0, Math.floor(mask / 8)).join('.') ===
                    ipParts.slice(0, Math.floor(mask / 8)).join('.');
            }
            return w === ip;
        });
    }
    return true;
}
