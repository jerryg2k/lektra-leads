ALTER TABLE `userSettings` ADD `scanKeywords` varchar(500) DEFAULT '';--> statement-breakpoint
ALTER TABLE `userSettings` ADD `scanFrequency` enum('daily','every3days','weekly') NOT NULL DEFAULT 'daily';
