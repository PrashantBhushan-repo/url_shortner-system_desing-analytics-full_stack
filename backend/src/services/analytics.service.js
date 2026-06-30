import { UAParser } from "ua-parser-js";
import { v4 as uuidv4 } from "uuid";

import { saveClickAnalytics } from "../repositories/analytics.repository.js";

export const trackClickAnalytics = async (
  req,
  urlId
) => {

  const parser = new UAParser(
    req.headers["user-agent"]
  );

  const result = parser.getResult();

  const visitorId =
    req.cookies?.visitor_id ||
    uuidv4();

  const sessionId =
    req.cookies?.session_id ||
    uuidv4();

  const analyticsData = {

    urlId,

    visitorId,

    sessionId,

    ipAddress:
      req.ip ||

      req.headers["x-forwarded-for"] ||

      "",

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

    country: null,

    state: null,

    city: null,

    latitude: null,

    longitude: null,

    timezone: null,

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

    isUnique: true,

    language:
      req.headers["accept-language"],

    screenResolution: null,

    networkType: null,

  };

  await saveClickAnalytics(
    analyticsData
  );

  return {

    visitorId,

    sessionId,

  };

};




//added :





import {

    getOverviewAnalytics

}

from "../repositories/analytics.repository.js";



export const overviewAnalytics = async () => {

    const data =

        await getOverviewAnalytics();

    return {

        totalUrls:

            Number(data.total_urls),

        totalClicks:

            Number(data.total_clicks),

        uniqueVisitors:

            Number(data.unique_visitors),

        todayClicks:

            Number(data.today_clicks),

        last24Hours:

            Number(data.last_24_hours),

        last7Days:

            Number(data.last_7_days),

        last30Days:

            Number(data.last_30_days),

        qrScans:

            Number(data.qr_scans)

    };

};