import type { Request, Response } from 'express';
import type { AuthenticatedRequest } from '../../types/express';
import { ApiError } from '../../utils/ApiError';
import { sendSuccess } from '../../utils/ApiResponse';
import { catchAsync } from '../../utils/catchAsync';
import * as paymentsService from './payments.service';
import type { InitiatePaymentInput, ListPaymentsQuery } from './payments.validation';

export const initiatePayment = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const { shipmentId } = req.body as InitiatePaymentInput;
  const { payment, checkoutUrl } = await paymentsService.initiatePayment(req.user.id, shipmentId);
  return sendSuccess(res, {
    statusCode: 201,
    message: 'Payment session created successfully',
    data: { payment, checkoutUrl },
  });
});

export const stripeWebhook = catchAsync(async (req: Request, res: Response) => {
  const signature = req.headers['stripe-signature'];
  if (typeof signature !== 'string') {
    throw ApiError.badRequest('Missing Stripe signature header');
  }
  await paymentsService.handleStripeWebhook(req.body as Buffer, signature);
  return sendSuccess(res, { message: 'Webhook processed successfully' });
});

export const getPayment = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const payment = await paymentsService.getPaymentById(req.user, req.params.id as string);
  return sendSuccess(res, { data: { payment } });
});

export const listPayments = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const query = req.validatedQuery as unknown as ListPaymentsQuery;
  const { payments, meta } = await paymentsService.listPayments(req.user, query);
  return sendSuccess(res, { data: { payments, meta } });
});
