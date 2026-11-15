# Northstar Market

Northstar Market is a basic full-stack e-commerce website built with Express.js, SQLite, HTML, CSS, and vanilla JavaScript.

The project includes a product catalog, product detail pages, a shopping cart, user authentication, and order processing.

## Features

- Product listings with category filters
- Product details page
- Shopping cart with quantity controls
- Cart persistence using browser `localStorage`
- User registration and login
- Password hashing with `bcryptjs`
- Session-based authentication
- Checkout with shipping address
- Order history for logged-in users
- SQLite database for products, users, orders, and order items
- Responsive layout for desktop and mobile screens

## Technologies

- HTML5
- CSS3
- JavaScript
- Node.js
- Express.js
- SQLite with `better-sqlite3`
- `express-session`
- `bcryptjs`

## Getting started

### Requirements

- Node.js 18 or newer
- npm

### Installation

Clone the repository and install the dependencies:

```bash
git clone https://github.com/24211a05eb/codealpha_tasks.git
cd codealpha_tasks
npm install
```

### Run the application

Start the server:

```bash
npm start
```

Open the application in your browser:

```text
http://localhost:3000
```

For development, use Node's watch mode:

```bash
npm run dev
```

## Database

The application automatically creates a SQLite database named `store.db` when the server starts.

The database contains these tables:

- `products` — catalog products
- `users` — registered users
- `orders` — customer orders
- `order_items` — products included in each order

The first server start automatically seeds six sample products.

`store.db` is excluded from Git using `.gitignore`.

## Project structure

```text
codealpha_tasks/
├── public/
│   ├── app.js
│   ├── index.html
│   ├── product.html
│   └── styles.css
├── .gitignore
├── package-lock.json
├── package.json
├── README.md
└── server.js
```

## API routes

### Products

```text
GET /api/products
GET /api/products/:id
```

### Authentication

```text
GET  /api/me
POST /api/register
POST /api/login
POST /api/logout
```

### Orders

```text
GET  /api/orders
POST /api/orders
```

Orders require an authenticated user session.

## Environment variables

The application works with defaults for local development. You can optionally configure:

```text
PORT=3000
SESSION_SECRET=replace-with-a-secure-secret
```

For production, always use a strong `SESSION_SECRET` and a production session store instead of the default in-memory session store.

## Notes

This project is intended as a learning/demo e-commerce application. It does not process real payments and should be extended with payment provider integration, validation, security hardening, and production database/session infrastructure before deployment.
