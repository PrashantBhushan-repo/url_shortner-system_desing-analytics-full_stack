
//  Business logic.


//  old one 

// import { randomUUID } from "crypto";

// import {
//   createUrl,
//   findByShortCode,
//   incrementClicks,
// } from "../repositories/url.repository.js";

// import { generateShortCode }
// from "../utils/generateShortCode.js";


//  Create URL


// export const shortenUrl =
//   async (longUrl) => {
//     const id = randomUUID();

//     const shortCode =
//       generateShortCode();

//     const url =
//       await createUrl(
//         id,
//         longUrl,
//         shortCode
//       );

//     return {
//       ...url,
//       shortUrl:
//         `${process.env.BASE_URL}/${shortCode}`,
//     };
//   };





// //   Redirect


// export const getOriginalUrl =
//   async (shortCode) => {

//     const url =
//       await findByShortCode(
//         shortCode
//       );

//     if (!url) {
//       throw new Error(
//         "URL not found"
//       );
//     }

//     await incrementClicks(
//       shortCode
//     );

//     return url.long_url;
//   };







//    new code : 




// Business Logic

import { randomUUID } from "crypto";

import {
  createUrl,
  findByShortCode,
  incrementClicks,
} from "../repositories/url.repository.js";

import { trackClickAnalytics }
from "./analytics.service.js";

import { generateShortCode }
from "../utils/generateShortCode.js";



// ========================================
// Create Short URL
// ========================================

export const shortenUrl = async (
  longUrl
) => {

  const id = randomUUID();

  const shortCode =
    generateShortCode();

  const url =
    await createUrl(
      id,
      longUrl,
      shortCode
    );

  return {

    ...url,

    shortUrl:
      `${process.env.BASE_URL}/${shortCode}`,

  };

};



// ========================================
// Redirect URL + Analytics
// ========================================

export const getOriginalUrl =
  async (
    shortCode,
    req
  ) => {

    const url =
      await findByShortCode(
        shortCode
      );

    if (!url) {

      throw new Error(
        "URL not found"
      );

    }

    // Increment click count
    await incrementClicks(
      shortCode
    );

    // Save analytics
    await trackClickAnalytics(
      req,
      url.id
    );

    return url.long_url;

  };



