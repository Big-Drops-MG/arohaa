terraform {
  required_version = ">= 1.5.0"

  backend "s3" {
    bucket         = "arohaa-terraform-state-442042553666"
    key            = "production/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "arohaa-terraform-locks"
    encrypt        = true
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}
