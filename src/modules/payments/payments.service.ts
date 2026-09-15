import Stripe from 'stripe';
import { env } from '../../config/env';
import { prisma } from '../../config/prisma';
import { stripe } from '../../config/stripe';
import { ApiError } from '../../utils/ApiError';
import { buildPaginationMeta, toSkipTake } from '../../utils/pagination';
import type { ListPaymentsQuery } from './payments.validation';

interface AuthUser {
  id: string;
  role: 'CUSTOMER' | 'COURIER' | 'ADMIN';
}

function toStripeError(error: unknown): never {
  if (error instanceof Stripe.errors.StripeError) {
    throw ApiError.badRequest(`Payment provider error: ${error.message}`);
  }
  throw error;
}

export async function initiatePayment(customerId: string, shipmentId: string) {
  const shipment = await prisma.shipment.findFirst({
    where: { id: shipmentId, deletedAt: null, customerId },
  });
  if (!shipment) {
    throw ApiError.notFound('Shipment not found');
  }

  const existingPayment = await prisma.payment.findFirst({
    where: { shipmentId, status: 'SUCCEEDED' },
  });
  if (existingPayment) {
    throw ApiError.conflict('This shipment has already been paid for');
  }

  const amountInSmallestUnit = Math.round(Number(shipment.priceAmount) * 100);

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: shipment.currency.toLowerCase(),
            product_data: { name: `Shipment ${shipment.trackingNumber}` },
            unit_amount: amountInSmallestUnit,
          },
          quantity: 1,
        },
      ],
      metadata: { shipmentId: shipment.id, customerId },
      success_url: `${env.clientUrl}/payments/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.clientUrl}/payments/cancel`,
    });
  } catch (error) {
    toStripeError(error);
  }

  const payment = await prisma.payment.create({
    data: {
      shipmentId: shipment.id,
      customerId,
      amount: shipment.priceAmount,
      currency: shipment.currency,
      status: 'PENDING',
      stripeSessionId: session.id,
    },
  });

  return { payment, checkoutUrl: session.url };
}

export async function handleStripeWebhook(rawBody: Buffer, signature: string) {
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, env.stripeWebhookSecret);
  } catch {
    throw ApiError.badRequest('Invalid Stripe webhook signature');
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      await prisma.payment.updateMany({
        where: { stripeSessionId: session.id },
        data: {
          status: 'SUCCEEDED',
          paidAt: new Date(),
          stripePaymentIntentId:
            typeof session.payment_intent === 'string' ? session.payment_intent : null,
        },
      });
      break;
    }
    case 'checkout.session.expired': {
      const session = event.data.object as Stripe.Checkout.Session;
      await prisma.payment.updateMany({
        where: { stripeSessionId: session.id, status: 'PENDING' },
        data: { status: 'FAILED' },
      });
      break;
    }
    case 'payment_intent.payment_failed': {
      const intent = event.data.object as Stripe.PaymentIntent;
      await prisma.payment.updateMany({
        where: { stripePaymentIntentId: intent.id, status: 'PENDING' },
        data: { status: 'FAILED' },
      });
      break;
    }
    default:
      break;
  }
}

async function findAccessiblePayment(user: AuthUser, paymentId: string) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { shipment: { select: { trackingNumber: true, status: true } } },
  });

  if (!payment) {
    throw ApiError.notFound('Payment not found');
  }
  if (user.role === 'CUSTOMER' && payment.customerId !== user.id) {
    throw ApiError.notFound('Payment not found');
  }

  return payment;
}

export async function getPaymentById(user: AuthUser, paymentId: string) {
  return findAccessiblePayment(user, paymentId);
}

export async function listPayments(user: AuthUser, query: ListPaymentsQuery) {
  const where = {
    ...(user.role === 'CUSTOMER' && { customerId: user.id }),
    ...(query.status && { status: query.status }),
  };

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      include: { shipment: { select: { trackingNumber: true } } },
      orderBy: { createdAt: 'desc' },
      ...toSkipTake(query),
    }),
    prisma.payment.count({ where }),
  ]);

  return { payments, meta: buildPaginationMeta(total, query) };
}
