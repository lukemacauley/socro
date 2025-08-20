# convex-backend.tf
# Add this to your existing Terraform configuration

# 1. PostgreSQL Database (Cheapest tier)
resource "azurerm_postgresql_flexible_server" "convex" {
  name                = "psql-convex-${var.project_name}-${var.environment}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  
  version                = "14"
  administrator_login    = "convexadmin"
  administrator_password = random_password.postgres_password.result
  
  # Cheapest possible tier - ~$15/month
  sku_name   = "B_Standard_B1ms"
  storage_mb = 32768
  
  # Minimal backup
  backup_retention_days        = 7
  geo_redundant_backup_enabled = false
  
  zone = "1"
}

resource "azurerm_postgresql_flexible_server_database" "convex" {
  name      = "convex"
  server_id = azurerm_postgresql_flexible_server.convex.id
}

# Allow Azure services
resource "azurerm_postgresql_flexible_server_firewall_rule" "azure" {
  name             = "AllowAzureServices"
  server_id        = azurerm_postgresql_flexible_server.convex.id
  start_ip_address = "0.0.0.0"
  end_ip_address   = "0.0.0.0"
}

# 2. Container Instance (Simpler than VM)
resource "azurerm_container_group" "convex" {
  name                = "ci-convex-${var.project_name}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  ip_address_type     = "Public"
  dns_name_label      = "convex-${var.project_name}-${var.environment}"
  os_type             = "Linux"
  
  container {
    name   = "convex-backend"
    image  = "ghcr.io/get-convex/convex-backend:latest"
    cpu    = "1"
    memory = "1.5"
    
    ports {
      port     = 3210
      protocol = "TCP"
    }
    
    environment_variables = {
      CONVEX_MODE     = "self_hosted"
      INSTANCE_NAME   = "${var.project_name}-${var.environment}"
      RUST_LOG        = "info"
    }
    
    secure_environment_variables = {
      DATABASE_URL     = "postgresql://convexadmin:${random_password.postgres_password.result}@${azurerm_postgresql_flexible_server.convex.fqdn}:5432/convex?sslmode=require"
      INSTANCE_SECRET  = random_password.convex_instance_secret.result
    }
  }
  
  tags = local.common_tags
}

# 3. Storage Account (for file uploads)
resource "azurerm_storage_account" "convex" {
  name                     = "stconvex${replace(var.project_name, "-", "")}${var.environment}"
  resource_group_name      = azurerm_resource_group.main.name
  location                 = azurerm_resource_group.main.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
  
  blob_properties {
    cors_rule {
      allowed_headers    = ["*"]
      allowed_methods    = ["GET", "PUT", "POST"]
      allowed_origins    = ["*"]  # Update with your React app URL
      exposed_headers    = ["*"]
      max_age_in_seconds = 3600
    }
  }
}

# Random passwords
resource "random_password" "postgres_password" {
  length  = 16
  special = true
}

resource "random_password" "convex_instance_secret" {
  length  = 32
  special = false
}

# Outputs
output "convex_url" {
  value = "http://${azurerm_container_group.convex.fqdn}:3210"
}

output "convex_instance_secret" {
  value     = random_password.convex_instance_secret.result
  sensitive = true
}