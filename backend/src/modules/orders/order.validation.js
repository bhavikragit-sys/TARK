import { z } from "zod";

export const createOrderSchema = z
  .object({
    symbol: z
      .string()
      .trim()
      .min(1, "Stock symbol is required")
      .max(20, "Stock symbol is too long")
      .regex(/^[A-Za-z0-9.-]+$/, "Invalid stock symbol")
      .transform((value) => value.toUpperCase()),

    side: z.enum(["BUY", "SELL"], {
      message: "Side must be BUY or SELL",
    }),

    quantity: z
      .number()
      .int("Quantity must be a whole number")
      .min(1, "Quantity must be at least 1")
      .max(1000000, "Quantity exceeds the permitted limit"),

    orderType: z
      .enum(["MARKET"], {
        message: "Only MARKET orders are currently supported",
      })
      .default("MARKET"),
  })
  .strict();   //Rejects unexpected fields rather than silently accepting them.
