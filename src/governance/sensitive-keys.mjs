const SENSITIVE_KEY_NAMES = new Set([
  'name', 'displayname', 'givenname', 'surname', 'familyname', 'fullname', 'preferredname',
  'email', 'emailaddress', 'mail', 'upn', 'userprincipalname', 'username',
  'token', 'accesstoken', 'idtoken', 'refreshtoken', 'bearertoken', 'jwt', 'sessiontoken',
  'authorization', 'authorizationheader', 'proxyauthorization',
  'secret', 'clientsecret', 'apikey', 'xapikey', 'subscriptionkey',
  'password', 'passwd', 'credential', 'credentials', 'clientcredential',
  'privatekey', 'signingkey', 'sharedaccesskey', 'connectionstring',
  'samaccountname', 'objectid', 'oid', 'tid', 'tenantid', 'sub', 'guid',
  'phone', 'telephone', 'mobilephone', 'ssn', 'socialsecuritynumber',
  'dob', 'dateofbirth', 'ipaddress', 'deviceid',
]);

export function normalizeSensitiveKey(key) {
  return String(key).toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function isSensitiveKey(key) {
  return SENSITIVE_KEY_NAMES.has(normalizeSensitiveKey(key));
}

export function findSensitiveKeyPaths(value, path = '', found = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => findSensitiveKeyPaths(item, `${path}[${index}]`, found));
    return found;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      const nextPath = path ? `${path}.${key}` : key;
      if (isSensitiveKey(key)) found.push(nextPath);
      findSensitiveKeyPaths(child, nextPath, found);
    }
  }
  return found;
}

export function stripSensitiveKeys(value) {
  if (Array.isArray(value)) return value.map(stripSensitiveKeys);
  if (!value || typeof value !== 'object') return value;

  const sanitized = {};
  for (const [key, child] of Object.entries(value)) {
    if (!isSensitiveKey(key)) sanitized[key] = stripSensitiveKeys(child);
  }
  return sanitized;
}

export const _internal = { SENSITIVE_KEY_NAMES };
