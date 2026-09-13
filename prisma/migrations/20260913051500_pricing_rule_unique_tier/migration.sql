-- CreateIndex
CREATE UNIQUE INDEX "PricingRule_originZoneId_destinationZoneId_serviceType_minW_key" ON "PricingRule"("originZoneId", "destinationZoneId", "serviceType", "minWeightKg");

