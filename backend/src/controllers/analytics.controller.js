import {

    overviewAnalytics

}

from "../services/analytics.service.js";



export const getOverview = async (

    req,

    res,

    next

) => {

    try {

        const analytics =

            await overviewAnalytics();

        return res.status(200).json({

            success: true,

            data: analytics

        });

    }

    catch (error) {

        next(error);

    }

};