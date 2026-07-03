# FinanceSmart (Backend API)

The dedicated backend infrastructure and REST API for the FinanceSmart ecosystem.

## ⚙️ Backend Architecture

### Server & Framework
- **Node.js & Express**: A robust, scalable REST API built on Express.
- **CORS & Security**: Configured with strict CORS policies for frontend communication.
- **Rate Limiting**: Utilizes `express-rate-limit` to prevent brute-force attacks and ensure API stability.

### Database & Authentication
- **Supabase Integration**: Connects to Supabase (via `@supabase/supabase-js`) for a powerful, open-source PostgreSQL database.
- **Environment Management**: Securely handles database URIs and authentication keys using `dotenv`.