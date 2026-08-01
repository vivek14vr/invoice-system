import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClientsModule } from './clients/clients.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { InvoicesModule } from './invoices/invoices.module';
import { PaymentsModule } from './payments/payments.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProductsModule } from './products/products.module';
import { QuotationsModule } from './quotations/quotations.module';
import { SettingsModule } from './settings/settings.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    DashboardModule,
    ClientsModule,
    InvoicesModule,
    QuotationsModule,
    ProductsModule,
    PaymentsModule,
    SettingsModule,
  ],
})
export class AppModule {}
