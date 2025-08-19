# versions.tf
terraform {
  required_version = ">= 1.5.0"
  
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.85.0"
    }
  }
}

# providers.tf
provider "azurerm" {
  features {}
    skip_provider_registration = true 
}

# variables.tf
variable "project_name" {
  description = "Project name for resource naming"
  type        = string
  default     = "legalai"
}

variable "environment" {
  description = "Environment (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "location" {
  description = "Azure region for resources"
  type        = string
  default     = "East US 2"  # Static Web Apps have limited regions
}