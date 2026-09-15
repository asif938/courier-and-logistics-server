-- CreateIndex
CREATE INDEX "CourierProfile_zoneId_isAvailable_idx" ON "CourierProfile"("zoneId", "isAvailable");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");

-- CreateIndex
CREATE INDEX "Shipment_customerId_deletedAt_idx" ON "Shipment"("customerId", "deletedAt");

-- CreateIndex
CREATE INDEX "Shipment_assignedCourierId_deletedAt_idx" ON "Shipment"("assignedCourierId", "deletedAt");

