# LensSuite Backend

Backend API for LensSuite, a Photo Studio Management System built with Node.js, Express, and MongoDB.

## Features

* User Authentication
* JWT Authorization
* Customer Management
* Studio Management
* Protected Routes
* MongoDB Integration
* Password Hashing
* Rate Limiting
* CORS Support

## Tech Stack

* Node.js
* Express.js
* MongoDB
* Mongoose
* JWT
* Bcrypt
* Cookie Parser
* Express Rate Limit
* Dotenv

## Project Structure

```text
Backend/
├── controllers/
├── middleware/
├── models/
├── .env
├── .gitignore
├── adminRoutes.js
├── package.json
├── server.js
```

## Installation

Clone the repository:

```bash
git clone https://github.com/lenssuite-studio/Studio-Managemant-Backend.git
```

Install dependencies:

```bash
npm install
```

Run development server:

```bash
npm run dev
```

Run production server:

```bash
npm start
```

## Environment Variables

Create a `.env` file:

```env
PORT=5000

MONGO_URI=your_mongodb_connection_string

JWT_SECRET=your_jwt_secret

CLIENT_URL=https://lenssuite.vercel.app
```

## API Modules

### Authentication

* Register User
* Login User
* Token Verification

### Customer Management

* Create Customer
* Update Customer
* Delete Customer
* View Customers

### Studio Management

* Create Studio
* Update Studio
* Delete Studio
* Activate / Deactivate Studio

## Security

* JWT Authentication
* Password Hashing (bcrypt)
* Protected Routes
* Rate Limiting
* Environment Variables Protection

## Deployment

Backend can be deployed on:

* Render
* Railway
* VPS Servers

Frontend:

https://lenssuite.vercel.app

## Author

Ismail Rabiic Deeq

GitHub:
https://github.com/ISMACIL-MAKER

## License

MIT License
