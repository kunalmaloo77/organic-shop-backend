import rateLimit from "express-rate-limit";
import { errorResponse } from "../utils/response.js";

export const authRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // Limit each IP to 20 requests per `window` (here, per 15 minutes)
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    handler: (req, res, next, options) => {
        res.status(options.statusCode).json(
            errorResponse("Too many requests, please try again later.", [
                {
                    code: "RATE_LIMIT_EXCEEDED",
                    detail: "Too many login/signup attempts from this IP",
                },
            ])
        );
    },
});
