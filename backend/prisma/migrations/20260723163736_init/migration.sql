-- CreateTable
CREATE TABLE `Client` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `address` TEXT NULL,
    `city` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'Active',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Product` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `sku` VARCHAR(191) NULL,
    `price` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Product_sku_key`(`sku`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Invoice` (
    `id` VARCHAR(191) NOT NULL,
    `invoiceNumber` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `issueDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `dueDate` DATETIME(3) NULL,
    `status` ENUM('DRAFT', 'SENT', 'PAID', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `taxRate` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `subtotal` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `taxAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `total` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Invoice_invoiceNumber_key`(`invoiceNumber`),
    INDEX `Invoice_clientId_idx`(`clientId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InvoiceItem` (
    `id` VARCHAR(191) NOT NULL,
    `invoiceId` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `quantity` DECIMAL(12, 2) NOT NULL DEFAULT 1,
    `unitPrice` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `amount` DECIMAL(12, 2) NOT NULL DEFAULT 0,

    INDEX `InvoiceItem_invoiceId_idx`(`invoiceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Quotation` (
    `id` VARCHAR(191) NOT NULL,
    `quoteNumber` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `issueDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `validUntil` DATETIME(3) NULL,
    `status` ENUM('DRAFT', 'SENT', 'VIEWED', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'DRAFT',
    `taxRate` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `subtotal` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `taxAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `total` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Quotation_quoteNumber_key`(`quoteNumber`),
    INDEX `Quotation_clientId_idx`(`clientId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `QuoteItem` (
    `id` VARCHAR(191) NOT NULL,
    `quoteId` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `quantity` DECIMAL(12, 2) NOT NULL DEFAULT 1,
    `unitPrice` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `amount` DECIMAL(12, 2) NOT NULL DEFAULT 0,

    INDEX `QuoteItem_quoteId_idx`(`quoteId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Payment` (
    `id` VARCHAR(191) NOT NULL,
    `invoiceId` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `method` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `paidAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Payment_invoiceId_idx`(`invoiceId`),
    INDEX `Payment_clientId_idx`(`clientId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TaxRate` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `rate` DECIMAL(5, 2) NOT NULL,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PaymentMethod` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `PaymentMethod_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InvoiceGroup` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `template` VARCHAR(191) NOT NULL,
    `nextId` INTEGER NOT NULL DEFAULT 1,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Setting` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `value` TEXT NOT NULL,

    UNIQUE INDEX `Setting_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Invoice` ADD CONSTRAINT `Invoice_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InvoiceItem` ADD CONSTRAINT `InvoiceItem_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `Invoice`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Quotation` ADD CONSTRAINT `Quotation_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuoteItem` ADD CONSTRAINT `QuoteItem_quoteId_fkey` FOREIGN KEY (`quoteId`) REFERENCES `Quotation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `Invoice`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
