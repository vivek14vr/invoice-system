-- AlterTable
ALTER TABLE `Product` ADD COLUMN `description` TEXT NULL,
    ADD COLUMN `purchasePrice` DECIMAL(12, 2) NOT NULL DEFAULT 0;
