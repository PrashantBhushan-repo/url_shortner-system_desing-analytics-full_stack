import express from "express";

import {

    getOverview

}

from "../controllers/analytics.controller.js";

const router = express.Router();

router.get(

    "/overview",

    getOverview

);

export default router;