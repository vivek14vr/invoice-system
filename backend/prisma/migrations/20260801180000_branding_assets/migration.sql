-- Allow admin-uploaded logo and stamp data URLs to be stored in MySQL.
ALTER TABLE `Setting` MODIFY `value` LONGTEXT NOT NULL;
