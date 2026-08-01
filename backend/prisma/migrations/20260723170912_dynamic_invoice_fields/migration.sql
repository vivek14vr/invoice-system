-- AlterTable
ALTER TABLE `Client` ADD COLUMN `stateCode` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Invoice` ADD COLUMN `buyerOrderDate` DATETIME(3) NULL,
    ADD COLUMN `buyerOrderNo` VARCHAR(191) NULL,
    ADD COLUMN `consigneeAddress` TEXT NULL,
    ADD COLUMN `consigneeGstin` VARCHAR(191) NULL,
    ADD COLUMN `consigneeName` VARCHAR(191) NULL,
    ADD COLUMN `consigneeState` VARCHAR(191) NULL,
    ADD COLUMN `consigneeStateCode` VARCHAR(191) NULL,
    ADD COLUMN `deliveryNote` VARCHAR(191) NULL,
    ADD COLUMN `deliveryNoteDate` DATETIME(3) NULL,
    ADD COLUMN `destination` VARCHAR(191) NULL,
    ADD COLUMN `dispatchDocNo` VARCHAR(191) NULL,
    ADD COLUMN `dispatchedThrough` VARCHAR(191) NULL,
    ADD COLUMN `otherReferences` VARCHAR(191) NULL,
    ADD COLUMN `referenceNo` VARCHAR(191) NULL,
    ADD COLUMN `termsOfDelivery` TEXT NULL;
