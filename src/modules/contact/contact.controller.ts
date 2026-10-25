import type { Request, Response } from 'express';
import type { AuthenticatedRequest } from '../../types/express';
import { sendSuccess } from '../../utils/ApiResponse';
import { catchAsync } from '../../utils/catchAsync';
import * as contactService from './contact.service';

export const getSettings = catchAsync(async (_req: Request, res: Response) => {
  const settings = await contactService.getContactSettings();
  return sendSuccess(res, { data: { settings } });
});

export const updateSettings = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const settings = await contactService.updateContactSettings(req.user.id, req.body, req.ip);
  return sendSuccess(res, { message: 'Contact settings updated successfully', data: { settings } });
});

export const submitMessage = catchAsync(async (req: Request, res: Response) => {
  const result = await contactService.submitContactMessage(req.body);
  return sendSuccess(res, {
    statusCode: 201,
    message: 'Message sent successfully',
    data: result,
  });
});
