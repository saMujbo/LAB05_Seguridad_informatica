const jwksByIssuer = new Map();

async function verifyAccessToken(token, { domain, audience }) {
  if (typeof token !== 'string' || !token) throw new Error('Token faltante');
  const jose = await import('jose');
  const issuer = `https://${domain}/`;
  let jwks = jwksByIssuer.get(issuer);
  if (!jwks) {
    jwks = jose.createRemoteJWKSet(new URL('.well-known/jwks.json', issuer));
    jwksByIssuer.set(issuer, jwks);
  }
  const { payload } = await jose.jwtVerify(token, jwks, { issuer, audience });
  const name = typeof payload.name === 'string' && payload.name
    ? payload.name
    : typeof payload.email === 'string' && payload.email
      ? payload.email
      : payload.sub;
  if (typeof name !== 'string' || !name) throw new Error('Identidad inválida');
  return { name: name.slice(0, 80), sub: payload.sub };
}

module.exports = { verifyAccessToken };
