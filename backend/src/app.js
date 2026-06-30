// import express from "express";
// import cors from "cors";

// const app = express();

// app.use(cors());

// app.use(express.json());

// export default app;







import express from "express";
import cors from "cors";

import urlRoutes
from "./routes/url.routes.js";

import {
  redirectUrl,
}
from "./controllers/url.controller.js";

import {
  errorHandler,
}
from "./middlewares/error.middleware.js";

import { analyticsMiddleware } from "./middlewares/analytics.middleware.js";
import cookieParser from "cookie-parser";

import analyticsRoutes

from "./routes/analytics.routes.js";

const app = express();


app.use(cors());

app.use(express.json());
app.use(cookieParser());
app.use(analyticsMiddleware);
app.use(
  "/api/v1/urls",
  urlRoutes
);

app.use(

    "/api/analytics",

    analyticsRoutes

);

// pasted: 

app.use(
  cors({
    origin:
      "http://localhost:5173",
  })
);

app.get(
  "/:shortCode",
  redirectUrl
);

app.use(
  errorHandler
);

export default app;