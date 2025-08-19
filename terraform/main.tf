# main.tf
# Resource Group
resource "azurerm_resource_group" "main" {
  name     = "rg-${var.project_name}-${var.environment}-react"
  location = var.location
  
  tags = {
    Project     = var.project_name
    Environment = var.environment
    Component   = "frontend"
    ManagedBy   = "Terraform"
  }
}

# Static Web App for React
resource "azurerm_static_site" "react_app" {
  name                = "stapp-${var.project_name}-${var.environment}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  sku_tier            = "Free"  # Can upgrade to "Standard" later for custom domains
  sku_size            = "Free"
  
  tags = {
    Project     = var.project_name
    Environment = var.environment
    Framework   = "React"
  }
}

# Application Insights for monitoring (optional but recommended)
resource "azurerm_application_insights" "main" {
  name                = "appi-${var.project_name}-${var.environment}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  application_type    = "web"
  
  tags = {
    Project     = var.project_name
    Environment = var.environment
  }
}