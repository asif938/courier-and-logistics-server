import type { Request, Response } from 'express';
import { sendSuccess } from '../../utils/ApiResponse';
import { catchAsync } from '../../utils/catchAsync';
import * as pricingService from './pricing.service';

export const getQuote = catchAsync(async (req: Request, res: Response) => {
  const quote = await pricingService.getPriceQuote(req.body);
  return sendSuccess(res, { data: quote });
});

export const createPricingRule = catchAsync(async (req: Request, res: Response) => {
  const rule = await pricingService.createPricingRule(req.body);
  return sendSuccess(res, {
    statusCode: 201,
    message: 'Pricing rule created successfully',
    data: { rule },
  });
});
