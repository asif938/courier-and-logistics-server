import type { Request, Response } from 'express';
import type { AuthenticatedRequest } from '../../types/express';
import { sendSuccess } from '../../utils/ApiResponse';
import { catchAsync } from '../../utils/catchAsync';
import * as pricingService from './pricing.service';

export const getQuote = catchAsync(async (req: Request, res: Response) => {
  const quote = await pricingService.getPriceQuote(req.body);
  return sendSuccess(res, { data: quote });
});

export const createPricingRule = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const rule = await pricingService.createPricingRule(req.user.id, req.body, req.ip);
  return sendSuccess(res, {
    statusCode: 201,
    message: 'Pricing rule created successfully',
    data: { rule },
  });
});
