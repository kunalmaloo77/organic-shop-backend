#!/bin/bash
# Startup script for production deployment

echo "🚀 Starting Organic Shop Backend..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found!"
    echo "Please copy .env.example to .env and configure it."
    exit 1
fi

# Pull latest images
echo "📦 Pulling latest Docker images..."
docker-compose pull

# Build backend image
echo "🔨 Building backend image..."
docker-compose build

# Start services
echo "▶️  Starting services..."
docker-compose up -d

# Wait for services to be healthy
echo "⏳ Waiting for services to be healthy..."
sleep 10

# Check health
echo "🏥 Checking service health..."
docker-compose ps

echo "✅ Deployment complete!"
echo ""
echo "📊 Service URLs:"
echo "   Backend API: http://localhost:8080"
echo "   Health Check: http://localhost:8080/health"
echo ""
echo "📝 View logs: docker-compose logs -f"
echo "🛑 Stop services: docker-compose down"
