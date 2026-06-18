(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};

  const TYPED_PLACEHOLDER_FAMILIES = new Set([
    "AZURE_RG", "CLOUD_RESOURCE", "STORAGE_ACCOUNT", "AD_GROUP", "HOSTNAME", "USERNAME", "EMAIL",
    "OTC_RESOURCE", "OPENSTACK_RESOURCE", "OPENSTACK_PROJECT_ID", "OPENSTACK_TENANT_ID", "OPENSTACK_DOMAIN_ID", "OPENSTACK_USER_ID", "OPENSTACK_RESOURCE_ID", "OBS_BUCKET", "OTC_ENDPOINT",
    "AWS_ARN", "AWS_ACCOUNT_ID", "AWS_RESOURCE_ID", "S3_BUCKET", "AWS_ENDPOINT",
    "GCP_PROJECT", "GCP_PROJECT_NUMBER", "GCP_SERVICE_ACCOUNT", "GCP_RESOURCE", "GCS_BUCKET",
    "K8S_CLUSTER", "K8S_NAMESPACE", "K8S_RESOURCE", "K8S_SECRET", "KUBECONFIG_SECRET", "CLOUD_ENDPOINT", "INTERNAL_ENDPOINT",
    "PRIVATE_IP", "PRIVATE_CIDR", "UNC_PATH", "SPN", "LDAP_DN", "FILE_SHARE", "AZURE_TENANT_ID", "AZURE_SUBSCRIPTION_ID"
  ]);

  const ENTERPRISE_PLACEHOLDER_EXACT_REGEX = new RegExp(`^\\[(?:${[...TYPED_PLACEHOLDER_FAMILIES].join("|")})_\\d+\\]$`);

  function normalizePlaceholderFamily(family) {
    return String(family || "").trim().toUpperCase();
  }

  function isTypedPlaceholderFamily(family) {
    return TYPED_PLACEHOLDER_FAMILIES.has(normalizePlaceholderFamily(family));
  }

  root.PWM.PlaceholderFamilies = {
    TYPED_PLACEHOLDER_FAMILIES,
    ENTERPRISE_PLACEHOLDER_EXACT_REGEX,
    isTypedPlaceholderFamily,
    normalizePlaceholderFamily
  };
})();
