/*
  Warnings:

  - Added the required column `firstName` to the `Client` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `Client` ADD COLUMN `addressLine2` VARCHAR(191) NULL,
    ADD COLUMN `company` VARCHAR(191) NULL,
    ADD COLUMN `country` VARCHAR(191) NULL DEFAULT 'IN',
    ADD COLUMN `firstName` VARCHAR(191) NOT NULL,
    ADD COLUMN `lastName` VARCHAR(191) NULL,
    ADD COLUMN `mobile` VARCHAR(191) NULL,
    ADD COLUMN `postalCode` VARCHAR(191) NULL,
    ADD COLUMN `state` VARCHAR(191) NULL,
    ADD COLUMN `taxCodePan` VARCHAR(191) NULL,
    ADD COLUMN `vatGstNumber` VARCHAR(191) NULL,
    ADD COLUMN `website` VARCHAR(191) NULL;
