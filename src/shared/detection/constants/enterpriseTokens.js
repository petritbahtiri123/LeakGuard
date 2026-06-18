(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};
  root.PWM.DetectionConstants = root.PWM.DetectionConstants || {};
  Object.assign(root.PWM.DetectionConstants, {
    ENTERPRISE_ENV_TOKENS: new Set(["prod", "prd", "production", "dev", "development", "test", "tst", "qa", "uat", "stage", "staging", "stg", "int", "integration", "sandbox", "sbx", "preprod", "ppd", "nonprod"]),
    ENTERPRISE_LOCATION_TOKENS: new Set(["eu", "weu", "neu", "de", "uk", "us", "ch", "in", "kos", "ber", "fra", "mun", "lon", "zur", "pri", "westeurope", "northeurope", "eastus", "westus", "centralus", "uksouth", "germanywestcentral", "switzerlandnorth", "eu-central-1", "eu-west-1", "us-east-1", "us-west-2", "eu-de", "eu-nl"]),
    ENTERPRISE_SERVICE_TOKENS: new Set(["vpc", "vnet", "subnet", "snet", "sg", "nsg", "firewall", "fw", "route", "rt", "peer", "peering", "endpoint", "private-endpoint", "network", "identity", "sec", "security", "files", "file", "storage", "backup", "aks", "sql", "app", "core", "shared", "hub", "spoke", "dns", "pe", "pep", "kv", "keyvault", "snet", "pl", "rt", "peer", "sss", "share", "nic", "nsg", "logic", "aa", "vm", "appgw", "law", "db", "bastion", "jump", "ecs", "ec2", "compute", "server", "instance", "volume", "disk", "evs", "ebs", "bucket", "obs", "s3", "blob", "rds", "database", "eks", "gke", "cce", "cluster", "k8s", "elb", "alb", "nlb", "lb", "gateway", "zone", "kms", "iam", "role", "policy", "secret", "vault", "eip", "keypair", "image", "flavor", "nat", "vpn"]),
    CLOUD_RESOURCE_PREFIXES: new Set(["rg", "st", "vnet", "snet", "pep", "pl", "rt", "peer", "sss", "share", "kv", "nic", "nsg", "logic", "aa", "vm", "aks", "appgw", "law", "sql", "db", "dns", "bastion"]),
    HOST_ROLE_TOKENS: new Set(["dc", "srv", "sql", "fs", "file", "print", "jump", "bastion", "vpn", "rdp", "ssh", "aks", "vm", "web", "app", "db"])
  });
})();
