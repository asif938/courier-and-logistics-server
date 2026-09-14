import type { NextFunction, Request, Response } from 'express';

type AsyncHandler<Req extends Request = Request> = (
  req: Req,
  res: Response,
  next: NextFunction,
) => Promise<unknown>;

export function catchAsync<Req extends Request = Request>(handler: AsyncHandler<Req>) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req as Req, res, next).catch(next);
  };
}
