#!/bin/bash

# Read environment variables
source .env

# Get the project ref from URL
PROJECT_REF="wvughhbrpnxvbkgalkwv"

echo "🗄️  Deploying database schema to Supabase..."
echo "📍 Project: $PROJECT_REF"

# Use Supabase API to execute SQL
# Note: This requires the service_role key for DDL operations
# For now, let's output instructions

echo ""
echo "✋ Direct SQL execution requires service_role key (security reasons)"
echo ""
echo "📋 Two options to deploy:"
echo ""
echo "Option 1: Use Supabase Dashboard (Recommended)"
echo "  1. Go to: https://supabase.com/dashboard/project/$PROJECT_REF/sql/new"
echo "  2. Copy contents from: supabase/schema.sql"
echo "  3. Click 'Run'"
echo ""
echo "Option 2: Use psql with Session Pool"
echo "  Get your database password from Supabase Dashboard > Settings > Database"
echo "  Then run:"
echo "  PGPASSWORD='YOUR_PASSWORD' psql -h aws-0-ap-south-1.pooler.supabase.com -p 6543 -U postgres.$PROJECT_REF -d postgres -f supabase/schema.sql"
echo ""
