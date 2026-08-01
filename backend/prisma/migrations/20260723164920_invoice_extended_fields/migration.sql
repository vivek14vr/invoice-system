/*
  Warnings:

  - Added the required column `name` to the `InvoiceItem` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `Invoice` ADD COLUMN `discountAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `discountPercent` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `invoiceGroupId` VARCHAR(191) NULL,
    ADD COLUMN `terms` TEXT NULL;

-- AlterTable
ALTER TABLE `InvoiceItem` ADD COLUMN `name` VARCHAR(191) NOT NULL,
    ADD COLUMN `taxRate` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    MODIFY `description` TEXT NULL;
