# Current Project Architecture

This file reflects the current structure of the backend and frontend in the workspace.

## Root structure

`	ext
url_shortner/
├── .git/
├── .gitignore
├── archetecture.md
├── backend/
├── frontend/
├── image.png
└── node_modules/
`

## Backend structure

`	ext
backend/
├── .env
├── .env.example
├── migrations/
│   └── 001_create_urls_table.sql
├── node_modules/
├── package-lock.json
├── package.json
├── server.js
└── src/
    ├── app.js
    ├── config/
    │   ├── config.js
    │   ├── db.js
    │   ├── index.js
    │   └── redisClient.js
    ├── controllers/
    │   └── url.controller.js
    ├── middlewares/
    │   ├── error.middleware.js
    │   ├── notFound.middleware.js
    │   ├── rateLimit.middleware.js
    │   ├── validate.middleware.js
    │   └── validateShortCode.middleware.js
    ├── repositories/
    │   └── url.repository.js
    ├── routes/
    │   └── url.routes.js
    ├── scripts/
    │   └── initDb.js
    ├── services/
    │   ├── cache.service.js
    │   └── url.service.js
    └── utils/
        ├── AppError.js
        ├── generateShortCode.js
        ├── validateShortCode.js
        └── validateUrl.js
`

### Backend files and purpose

- server.js: starts the Express server
- src/app.js: creates the app and registers routes and middleware
- src/config/config.js: loads environment variables and app config
- src/config/db.js: PostgreSQL connection setup
- src/config/redisClient.js: Redis client setup
- src/controllers/url.controller.js: handles URL creation, redirect, and stats-related requests
- src/routes/url.routes.js: defines backend API routes
- src/services/url.service.js: business logic for short URL handling
- src/services/cache.service.js: cache read/write logic for Redis
- src/repositories/url.repository.js: database queries for URL records
- src/middlewares/: validation, error handling, rate limiting, and not-found middleware
- src/utils/: helper functions such as short-code generation and URL validation
- migrations/001_create_urls_table.sql: creates the urls table in PostgreSQL

## Frontend structure

`	ext
frontend/
├── dist/
├── eslint.config.js
├── index.html
├── node_modules/
├── package-lock.json
├── package.json
├── public/
├── README.md
├── vite.config.js
└── src/
    ├── App.jsx
    ├── index.css
    ├── main.jsx
    ├── assets/
    ├── components/
    │   ├── 
    │   └── url/
    │       ├── CopyButton.jsx
    │       ├── Features.jsx
    │       ├── Footer.jsx
    │       ├── Hero.jsx
    │       ├── Navbar.jsx
    │       ├── Result.jsx
    │       ├── StatsCard.jsx
    │       └── UrlForm.jsx
    ├── layout/
    │   ├── AuthLayout.jsx
    │   ├── DashboardLayout.jsx
    │   └── MainLayout.jsx
    ├── pages/
    │   ├── 
    │   └── Home.jsx
    ├── routes/
    │   ├── AppRoutes.jsx
    │   ├── PrivateRoutes.jsx
    │   └── PublicRoutes.jsx
    └── services/
        └── urlApi.js
`

### Frontend files and purpose

- src/App.jsx: main React app component
- src/main.jsx: app entry point
- src/components/: reusable UI components for the home page, URL form, result card, and analytics views
- src/pages/: main pages such as Home and Analytics
- src/layout/: shared page layouts
- src/routes/: route wrapping and navigation setup
- src/services/urlApi.js: frontend API calls to the backend

## Request flow

`	ext
User → Frontend → Backend API → PostgreSQL/Redis
`

- The frontend collects the long URL and sends it to the backend.
- The backend validates and stores the URL.
- Redis is used for caching and rate-limit support.
- PostgreSQL stores the main URL records.








stadnated devops archtured : 





url-shortener/

├── backend/
│   ├── src/
│   ├── Dockerfile
│   ├── pom.xml
│   └── application.yml
│
├── frontend/
│   ├── src/
│   ├── Dockerfile
│   └── package.json
│
├── infrastructure/
│   ├── kubernetes/
│   │   ├── backend/
│   │   │   ├── deployment.yaml
│   │   │   ├── service.yaml
│   │   │   └── configmap.yaml
│   │   │
│   │   ├── frontend/
│   │   │   ├── deployment.yaml
│   │   │   └── service.yaml
│   │   │
│   │   ├── ingress/
│   │   │   └── ingress.yaml
│   │   │
│   │   └── namespace.yaml
│   │
│   ├── terraform/
│   │
│   └── ansible/
│
├── docker/
│   └── docker-compose.yml
│
├── monitoring/
│   ├── prometheus/
│   ├── grafana/
│   └── loki/
│
├── .github/
│   └── workflows/
│
├── README.md
└── .gitignore