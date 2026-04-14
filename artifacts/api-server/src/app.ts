import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());

// Stripe webhook must receive the raw body for signature verification
app.use("/api/stripe/webhook", express.raw({ type: "application/json" }));

// Increase limit for chat file uploads (base64 encoded, so 50MB file ≈ 70MB JSON)
app.use("/api/uploads", express.json({ limit: "75mb" }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "75mb" }));

app.use("/api", router);

export default app;
