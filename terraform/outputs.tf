# outputs.tf
output "static_web_app_url" {
  value       = "https://${azurerm_static_site.react_app.default_host_name}"
  description = "URL of your React app"
}

output "static_web_app_deployment_token" {
  value       = azurerm_static_site.react_app.api_key
  description = "Deployment token for CI/CD (keep this secret!)"
  sensitive   = true
}

output "resource_group_name" {
  value       = azurerm_resource_group.main.name
  description = "Resource group name"
}

output "application_insights_key" {
  value       = azurerm_application_insights.main.instrumentation_key
  description = "App Insights key for React app monitoring"
  sensitive   = true
}

output "application_insights_connection_string" {
  value       = azurerm_application_insights.main.connection_string
  description = "App Insights connection string"
  sensitive   = true
}