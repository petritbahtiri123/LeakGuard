(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};
  root.PWM.DetectionContextRegexes = {
    INFRA_CONTEXT_REGEX: /\b(?:resource\s*group|azure|cloud|tenant|subscription|vnet|subnet|private\s*endpoint|storage\s*account|azure\s*files|file\s*share|smb|kerberos|hostname|computername|device\s*name|server|fqdn|rdp|ssh|winrm|intune|entra|ad|ldap)\b/i,
    PROVIDER_CONTEXT_REGEX: /\b(?:azure|aws|amazon\s+web\s+services|gcp|google\s+cloud|otc|open\s+telekom\s+cloud|t\s*cloud\s+public|t-systems\s+cloud|openstack|kubernetes|k8s|kubeconfig|project|tenant|domain|arn|iam|account|obs|ecs|evs|vpc|cce|rds|elb|s3|gcs|bucket)\b/i,
    IDENTITY_CONTEXT_REGEX: /\b(?:user|username|login|owner|created\s+by|assigned\s+to|upn|samaccountname|email|entra|ad|ldap|identity|account)\b/i
  };
})();
