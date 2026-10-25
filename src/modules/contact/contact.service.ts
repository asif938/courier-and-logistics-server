import { prisma } from '../../config/prisma';
import { recordAuditLog } from '../../utils/auditLog';
import { sendMail } from '../../utils/mailer';
import type { ContactMessageInput, UpdateContactSettingsInput } from './contact.validation';

const SETTINGS_ID = 'singleton';

const DEFAULT_SETTINGS = {
  email: 'support@parcelo.app',
  phone: '+1 (555) 010-0100',
  location: 'New York, NY',
};

export async function getContactSettings() {
  const settings = await prisma.contactSettings.findUnique({ where: { id: SETTINGS_ID } });
  return settings ?? { id: SETTINGS_ID, ...DEFAULT_SETTINGS, updatedAt: null };
}

export async function updateContactSettings(
  adminUserId: string,
  data: UpdateContactSettingsInput,
  ipAddress?: string,
) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.contactSettings.findUnique({ where: { id: SETTINGS_ID } });

    const updated = await tx.contactSettings.upsert({
      where: { id: SETTINGS_ID },
      create: { id: SETTINGS_ID, ...DEFAULT_SETTINGS, ...data },
      update: data,
    });

    await recordAuditLog(tx, {
      actorUserId: adminUserId,
      action: 'UPDATE_CONTACT_SETTINGS',
      entityType: 'ContactSettings',
      entityId: SETTINGS_ID,
      changes: {
        from: current
          ? { email: current.email, phone: current.phone, location: current.location }
          : DEFAULT_SETTINGS,
        to: data,
      },
      ipAddress,
    });

    return updated;
  });
}

export async function submitContactMessage(input: ContactMessageInput) {
  const settings = await getContactSettings();

  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN', deletedAt: null, isActive: true },
    select: { id: true },
  });

  if (admins.length > 0) {
    await prisma.notification.createMany({
      data: admins.map((admin) => ({
        userId: admin.id,
        type: 'SYSTEM' as const,
        title: `New contact message: ${input.subject}`,
        message: `${input.name} (${input.email}) wrote: ${input.message}`,
      })),
    });
  }

  const { delivered } = await sendMail({
    to: settings.email,
    subject: `[Parcelo Contact] ${input.subject}`,
    text: `From: ${input.name} <${input.email}>\n\n${input.message}`,
    replyTo: input.email,
  });

  return { emailDelivered: delivered };
}
