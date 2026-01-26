# Organic Shop Backend

The **Organic Shop Backend** is a robust, scalable e-commerce server built with Node.js and Express. It manages products, user accounts, orders, and administrative tasks, providing a solid foundation for an organic products marketplace.

## 🚀 Key Features

- **Authentication & Security**: 
  - JWT-based authentication.
  - Google OAuth 2.0 integration.
  - Rate limiting for API protection.
  - Secure password hashing with bcrypt.
- **Product Management**:
  - Full CRUD operations for products.
  - Category-based filtering and related product suggestions.
  - Image handling via AWS S3.
- **Order & Payments**:
  - Integration with **Razorpay** for secure payments.
  - Webhook support for real-time payment verification.
  - Order history and status tracking.
- **Admin Dashboard**:
  - Performance statistics and analytics.
  - Complete control over product inventory and user orders.
- **Performance**:
  - Redis integration for caching and high-performance rate limiting.

## 🛠️ Tech Stack

- **Runtime**: Node.js (v22+)
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Caching/Rate Limiting**: Redis
- **Cloud Storage**: AWS S3 (for product images)
- **Payment Gateway**: Razorpay
- **Authentication**: Passport.js, Google OAuth, JWT
- **DevOps**: Docker, Docker Compose

## 📁 Project Structure

```text
.
├── api/             # App entry point (app.js)
├── controller/      # Business logic for routes
├── middleware/      # Auth, rate limiting, and error handling
├── model/           # Mongoose schemas/models
├── routes/          # API route definitions
├── utils/           # Helper functions (S3, Redis, etc.)
├── Dockerfile       # Containerization setup
└── DOCKER.md        # Detailed setup & Docker instructions
```

## 🛠️ Getting Started

To get the project up and running locally or in production, please follow the instructions in the [DOCKER.md](./DOCKER.md) file.

### Quick Summary:
1.  Configure your environment variables in `.env`.
2.  Run `docker-compose up` to start the backend, MongoDB, and Redis.
3.  Access the API at `http://localhost:8080`.

## 📜 API Documentation (Highlights)

- **Auth**: `POST /auth/login`, `GET /auth/google`
- **Products**: `GET /product`, `GET /product/:id`
- **Orders**: `POST /order` (includes Razorpay integration)
- **Admin**: `GET /admin/stats`, `POST /admin/create-product`

---

## 🏗️ Future Enhancements

- [ ] Add logging service (ELK stack or Loki).
- [ ] Add monitoring (Prometheus + Grafana).
- [ ] Implement CI/CD pipeline.
- [ ] Add unit and integration tests.
