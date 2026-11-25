import { generateKeyPairSync } from 'node:crypto';

/**
 * Prints a fresh VAPID key pair for Web Push, ready to paste into apps/api/.env.
 * Public key: the uncompressed P-256 point (0x04 || x || y); private key: d. Both base64url.
 */
export function generateVapidKeys(): { publicKey: string; privateKey: string } {
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const pub = publicKey.export({ format: 'jwk' });
  const priv = privateKey.export({ format: 'jwk' });
  const point = Buffer.concat([
    Buffer.from([0x04]),
    Buffer.from(pub.x!, 'base64url'),
    Buffer.from(pub.y!, 'base64url'),
  ]);
  return { publicKey: point.toString('base64url'), privateKey: priv.d! };
}

if (process.argv[1] === import.meta.filename) {
  const keys = generateVapidKeys();
  console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}\nVAPID_PRIVATE_KEY=${keys.privateKey}`);
}
