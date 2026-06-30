import { UAParser } from "ua-parser-js";
import { v4 as uuidv4 } from "uuid";

export const analyticsMiddleware = (req, res, next) => {

    const parser = new UAParser(req.headers["user-agent"]);

    const result = parser.getResult();

    req.analytics = {

        visitorId:
            req.cookies?.visitor_id ||
            uuidv4(),

        sessionId:
            req.cookies?.session_id ||
            uuidv4(),

        ipAddress:
            req.headers["x-forwarded-for"] ||
            req.socket.remoteAddress ||
            req.ip,

        browser:
            result.browser.name || "Unknown",

        browserVersion:
            result.browser.version || "",

        operatingSystem:
            result.os.name || "Unknown",

        osVersion:
            result.os.version || "",

        deviceType:
            result.device.type || "Desktop",

        deviceName:
            result.device.model || "",

        platform:
            result.device.vendor || "",

        userAgent:
            req.headers["user-agent"],

        language:
            req.headers["accept-language"] || "",

        referrer:
            req.headers.referer || "Direct",

        refererHost:
            req.headers.host || "",

        utmSource:
            req.query.utm_source || null,

        utmMedium:
            req.query.utm_medium || null,

        utmCampaign:
            req.query.utm_campaign || null,

        isQrScan:
            req.query.qr === "true",

        country: null,

        state: null,

        city: null,

        latitude: null,

        longitude: null,

        timezone: null,

        screenResolution: null,

        networkType: null,

        isUnique: true

    };

    next();

};