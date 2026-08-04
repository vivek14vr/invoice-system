# Database schema

The application uses MongoDB through Prisma. MongoDB schema and indexes are
synchronized with:

```sh
npm run prisma:push
```

Prisma Migrate is not used for MongoDB. The `migrations` directory contains the
historical MySQL migrations and is retained only as a record of the former SQL
schema.

To copy an existing MySQL installation into an empty MongoDB database, configure
both connection strings in `.env`, then run:

```sh
npm run data:migrate:mysql-to-mongo
```

The importer preserves existing string IDs and relationships. It refuses to
write into non-empty target collections unless `-- --replace` is supplied.
