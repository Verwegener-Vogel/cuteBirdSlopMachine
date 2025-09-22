/**
 * JWT utilities for secure video access tokens
 * Uses Web Crypto API for signing/verification
 */

interface JWTPayload {
  videoId?: string;
  action: 'download' | 'stream';
  exp: number; // Expiration timestamp
  iat: number; // Issued at timestamp
}

export class JWT {
  private static async getKey(secret: string): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    return await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign', 'verify']
    );
  }

  private static base64urlEscape(str: string): string {
    return str.replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  private static base64urlUnescape(str: string): string {
    str += (4 - str.length % 4) % 4 === 2 ? '==' : (4 - str.length % 4) % 4 === 3 ? '=' : '';
    return str.replace(/-/g, '+').replace(/_/g, '/');
  }

  static async sign(payload: JWTPayload, secret: string): Promise<string> {
    const header = {
      alg: 'HS256',
      typ: 'JWT'
    };

    const encodedHeader = this.base64urlEscape(btoa(JSON.stringify(header)));
    const encodedPayload = this.base64urlEscape(btoa(JSON.stringify(payload)));
    const data = `${encodedHeader}.${encodedPayload}`;

    const key = await this.getKey(secret);
    const signature = await crypto.subtle.sign(
      'HMAC',
      key,
      new TextEncoder().encode(data)
    );

    const encodedSignature = this.base64urlEscape(
      btoa(String.fromCharCode(...new Uint8Array(signature)))
    );

    return `${data}.${encodedSignature}`;
  }

  static async verify(token: string, secret: string): Promise<JWTPayload | null> {
    try {
      const [header, payload, signature] = token.split('.');
      if (!header || !payload || !signature) {
        return null;
      }

      const data = `${header}.${payload}`;
      const key = await this.getKey(secret);

      const signatureBuffer = Uint8Array.from(
        atob(this.base64urlUnescape(signature)),
        c => c.charCodeAt(0)
      );

      const valid = await crypto.subtle.verify(
        'HMAC',
        key,
        signatureBuffer,
        new TextEncoder().encode(data)
      );

      if (!valid) {
        return null;
      }

      const decodedPayload = JSON.parse(atob(this.base64urlUnescape(payload)));

      // Check expiration
      if (decodedPayload.exp && decodedPayload.exp < Math.floor(Date.now() / 1000)) {
        return null;
      }

      return decodedPayload;
    } catch (error) {
      console.error('JWT verification failed:', error);
      return null;
    }
  }

  static createToken(videoId: string | undefined, action: 'download' | 'stream', secret: string, expiryMinutes: number = 15): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const payload: JWTPayload = {
      videoId,
      action,
      iat: now,
      exp: now + (expiryMinutes * 60)
    };
    return this.sign(payload, secret);
  }
}